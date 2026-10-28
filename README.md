# campbell-content-studio.github.io

## Automatic "Behind the craft" row

Once a day, `.github/workflows/update-latest-videos.yml` refreshes the "Behind the craft" row from Adam Campbell Cinema's public YouTube RSS feed (no API key, no quota). The row shows the latest 4 long-form Inside ACC episodes. It currently lives in `/preview/` and will be on the homepage once the new design goes live.

Shorts are skipped. The four featured films are hand-picked and never change automatically. Anything already shown elsewhere on the page never appears in the row, so if you place a video by hand, the row adjusts on the next run.

How it works and how to adjust it:

- **What the script edits.** It rewrites only the HTML between `<!-- auto:inside-acc -->` and `<!-- /auto:inside-acc -->`. Edit everything outside those markers by hand.
- **The rules.** `.github/latest-videos.config.json` holds the number of cards, the IDs and title patterns to leave out, and the topic labels above each title.
  - If a film or music video slips into "Behind the craft", add its ID to `excludeIds`.
  - If an episode is wrongly left out, add its ID to `includeIds`.
  - To set a label by hand, add `"VIDEO_ID": "Label"` to `labels`.
- **Its memory.** The feed lists only the latest 15 uploads, Shorts included, so `.github/latest-videos.state.json` remembers the latest 60 long-form uploads. The workflow maintains it.
  - If the feed was down for several days (the workflow run turns red and GitHub emails you), a new episode may have been missed. Add it at the top of the list as `{"id": "VIDEO_ID", "title": "Title", "published": "2026-11-02T15:00:00+00:00"}`, then run the workflow.
- **Commits and manual runs.** The workflow commits only when something changed. To run it now: Actions → Update latest videos → Run workflow.
- **The 60-day pause.** GitHub pauses scheduled workflows in public repositories after 60 days with no activity. If the row stops updating, open Actions → Update latest videos → Enable workflow.

## Reel sound

The hero reel is always muted. A small "Sound on" button on the reel plays a separate score cue, only when a visitor presses it, never automatically. The button stays hidden until the cue exists: put the file in `preview/assets/audio/` (or `assets/audio/` once the site is at the root) as `reel-score.mp3`, then set `data-src="assets/audio/reel-score.mp3"` on the `sound-toggle` button in `index.html`. Details are in `assets/audio/_README.txt`.
