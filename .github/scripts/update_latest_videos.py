#!/usr/bin/env python3
"""Refresh the auto-updated video rows on the site from public YouTube RSS feeds.

Runs daily from .github/workflows/update-latest-videos.yml. It needs no API key
and uses no quota:

1. Read each channel's public RSS feed (its latest 15 uploads) and keep only
   long-form videos. The feed links Shorts as /shorts/<id>, so they are dropped.
2. Merge them into .github/latest-videos.state.json. The feed alone is too short
   when a channel posts many Shorts, so the state file remembers every long-form
   upload seen so far.
3. Pick the newest videos for each row (rules in .github/latest-videos.config.json),
   confirm each one is public and embeddable through YouTube oEmbed, and rewrite
   the HTML between <!-- auto:NAME --> and <!-- /auto:NAME --> in each page.

Files are written only when their content changes, so the workflow commits only
real updates. If YouTube is unreachable, the existing rows are left as they are.
"""

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / ".github" / "latest-videos.config.json"
STATE_PATH = ROOT / ".github" / "latest-videos.state.json"

FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={}"
OEMBED_URL = "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D{}"
THUMB_URL = "https://i.ytimg.com/vi/{}/{}.jpg"
WATCH_URL = "https://www.youtube.com/watch?v={}"
USER_AGENT = "campbellcontentstudio.ca latest-videos updater"

NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
SHORTS_TAG = re.compile(r"#shorts?\b", re.I)
# mqdefault (320x180) and hqdefault (480x360) exist for every video; these two may not.
OPTIONAL_THUMBS = (("sddefault", 640), ("maxresdefault", 1280))
UNAVAILABLE = {400, 401, 403, 404}
MAX_STORED_PER_CHANNEL = 60


def warn(message):
    print(f"::warning::{message}")


def fetch(url, method="GET", attempts=3):
    """Return (status, body). status is None when the server could not be reached."""
    for attempt in range(attempts):
        request = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code != 429:
                return error.code, b""
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        if attempt < attempts - 1:
            time.sleep(3 * (attempt + 1))
    return None, b""


def read_feed(channel_id):
    """Long-form uploads from the channel feed, or None if the feed is unavailable."""
    status, body = fetch(FEED_URL.format(channel_id))
    if status != 200:
        warn(f"Feed for {channel_id} returned {status}; keeping the current rows.")
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError as error:
        warn(f"Feed for {channel_id} could not be parsed ({error}); keeping the current rows.")
        return None
    videos = []
    for entry in root.findall("a:entry", NS):
        video_id = (entry.findtext("yt:videoId", "", NS) or "").strip()
        title = (entry.findtext("a:title", "", NS) or "").strip()
        link = entry.find("a:link", NS)
        href = link.get("href", "") if link is not None else ""
        if not VIDEO_ID.match(video_id) or not title or "/shorts/" in href or SHORTS_TAG.search(title):
            continue
        videos.append({"id": video_id, "title": title, "published": entry.findtext("a:published", None, NS)})
    return videos


def published_ts(video):
    try:
        return datetime.fromisoformat(video["published"]).timestamp()
    except (TypeError, ValueError, KeyError):
        return None


def merge(stored, fresh):
    """Add new uploads and refresh titles and dates. Seeds without a date sort last, in order."""
    by_id = {video["id"]: video for video in stored}
    for video in fresh:
        known = by_id.get(video["id"])
        if known is None:
            stored.append(video)
            by_id[video["id"]] = video
            continue
        for key in ("title", "published"):
            if video.get(key) and known.get(key) != video[key]:
                known[key] = video[key]
    stored.sort(key=lambda v: (published_ts(v) is None, -(published_ts(v) or 0)))
    del stored[MAX_STORED_PER_CHANNEL:]


def check_oembed(video):
    """True if public and embeddable, False if not, None if YouTube could not be reached."""
    status, body = fetch(OEMBED_URL.format(video["id"]))
    if status == 200:
        try:
            title = (json.loads(body).get("title") or "").strip()
        except ValueError:
            return None
        if title:
            video["title"] = title
        return True
    if status in UNAVAILABLE:
        return False
    return None


def thumb_widths(video):
    """Optional thumbnail sizes known to exist. Once found they are remembered, never dropped."""
    have = set(video.get("thumbs", []))
    for name, _ in OPTIONAL_THUMBS:
        if name not in have:
            status, _ = fetch(THUMB_URL.format(video["id"], name), method="HEAD", attempts=2)
            if status == 200:
                have.add(name)
    found = [name for name, _ in OPTIONAL_THUMBS if name in have]
    if found:
        video["thumbs"] = found
    return found


def label_for(video, row):
    if video["id"] in row.get("labels", {}):
        return row["labels"][video["id"]]
    for pattern, label in row.get("labelRules", []):
        if re.search(pattern, video["title"], re.I):
            return label
    return row.get("fallbackLabel", "")


def pick(stored, row):
    excluded_ids = set(row.get("excludeIds", []))
    excluded_titles = [re.compile(p, re.I) for p in row.get("excludeTitlePatterns", [])]
    picked = []
    for video in stored:
        if len(picked) == row["count"]:
            break
        if video["id"] in excluded_ids or any(p.search(video["title"]) for p in excluded_titles):
            continue
        available = check_oembed(video)
        if available is False:
            warn(f"Skipping {video['id']} ({video['title']}): not public or not embeddable.")
            continue
        picked.append(video)
    return picked


def render_item(video, index, row):
    vid = video["id"]
    title = html.escape(video["title"], quote=True)
    label = html.escape(label_for(video, row), quote=True)
    heading = row.get("heading", "h3")
    srcset = [f"{THUMB_URL.format(vid, 'mqdefault')} 320w", f"{THUMB_URL.format(vid, 'hqdefault')} 480w"]
    widths = dict(OPTIONAL_THUMBS)
    srcset += [f"{THUMB_URL.format(vid, name)} {widths[name]}w" for name in thumb_widths(video)]
    delay = "" if index == 0 else f' style="--d:{index * 0.08:.2f}s"'.replace(":0.", ":.")
    watch = WATCH_URL.format(vid)
    return [
        f'<li class="ep reveal"{delay}>',
        f'  <a class="ep-card" href="{watch}" data-yt="{vid}" data-title="{title}">',
        f'    <div class="thumb"><img src="{THUMB_URL.format(vid, "mqdefault")}" srcset="{", ".join(srcset)}" sizes="{row["sizes"]}" width="1280" height="720" loading="lazy" decoding="async" alt=""></div>',
        '    <div class="ep-text">',
        f'      <p class="ep-cat billing">{label}</p>',
        f'      <{heading}>{title}</{heading}>',
        '      <p class="ep-cue billing" aria-hidden="true"><span class="tri"></span>Play here</p>',
        '    </div>',
        '  </a>',
        f'  <a class="watch" href="{watch}">Watch on YouTube<span class="sr">: {title}</span> <span class="ext" aria-hidden="true">↗</span></a>',
        '</li>',
    ]


def replace_region(page, name, rendered):
    """Swap the lines between the markers for rendered lines, indented like the opening marker."""
    pattern = re.compile(r"^([ \t]*)<!-- auto:%s -->\n.*?^[ \t]*<!-- /auto:%s -->$" % (name, name), re.M | re.S)
    match = pattern.search(page)
    if not match:
        return page, False
    indent = match.group(1)
    lines = [f"<!-- auto:{name} -->", *rendered, f"<!-- /auto:{name} -->"]
    return page[: match.start()] + "\n".join(indent + line for line in lines) + page[match.end():], True


def write_if_changed(path, text):
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    state = json.loads(STATE_PATH.read_text(encoding="utf-8")) if STATE_PATH.exists() else {}
    rows = config["rows"]

    for channel_id in sorted({row["channelId"] for row in rows.values()}):
        fresh = read_feed(channel_id)
        if fresh is not None:
            merge(state.setdefault(channel_id, []), fresh)

    rendered = {}
    for name, row in rows.items():
        chosen = pick(state.get(row["channelId"], []), row)
        if len(chosen) < row.get("minCount", row["count"]):
            warn(f"Only {len(chosen)} videos for '{name}'; keeping the current row.")
            continue
        rendered[name] = [line for index, video in enumerate(chosen) for line in render_item(video, index, row)]

    pages_found = 0
    changed = []
    for relative in config["pages"]:
        path = ROOT / relative
        if not path.exists():
            continue
        page = path.read_text(encoding="utf-8")
        for name, lines in rendered.items():
            page, found = replace_region(page, name, lines)
            pages_found += found
        if write_if_changed(path, page):
            changed.append(relative)

    if pages_found == 0 and rendered:
        print("::error::No <!-- auto:... --> markers found in any configured page.")
        return 1

    state_text = json.dumps(state, indent=2, ensure_ascii=False) + "\n"
    if write_if_changed(STATE_PATH, state_text):
        changed.append(str(STATE_PATH.relative_to(ROOT)))

    print("Updated: " + ", ".join(changed) if changed else "No changes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
