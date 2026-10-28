# campbell-content-studio.github.io

## Automatic video rows

Once a day, `.github/workflows/update-latest-videos.yml` refreshes two rows on the site from the channels' public YouTube RSS feeds (no API key, no quota). The rows currently live in `/preview/` and will be on the homepage once the new design goes live:

- **Behind the craft**: the latest 4 long-form Inside ACC episodes from Adam Campbell Cinema.
- **Latest from The Grim Script**: the latest 4 long-form episodes.

Shorts are skipped. Anything already shown elsewhere on the page never appears in these rows, which covers the four featured films and The Grim Script's featured episode. Those are hand-picked: to swap one, edit its card as usual and the rows adjust on the next run.

How it works and how to adjust it:

- **What the script edits.** It rewrites only the HTML between `<!-- auto:NAME -->` and `<!-- /auto:NAME -->`. Edit everything outside those markers by hand.
- **The rules.** `.github/latest-videos.config.json` holds the number of cards, the IDs and title patterns to leave out, and the topic labels above each title.
  - If a film or music video slips into "Behind the craft", add its ID to `excludeIds`.
  - If an episode is wrongly left out, add its ID to `includeIds`.
  - To set a label by hand, add `"VIDEO_ID": "Label"` to `labels`.
- **Its memory.** Each feed lists only the latest 15 uploads, Shorts included, so `.github/latest-videos.state.json` remembers the latest 60 long-form uploads per channel. The workflow maintains it.
  - If the feeds were down for several days (the workflow run turns red and GitHub emails you), a new episode may have been missed. Add it at the top of its channel's list as `{"id": "VIDEO_ID", "title": "Title", "published": "2026-11-02T15:00:00+00:00"}`, then run the workflow.
- **Commits and manual runs.** The workflow commits only when something changed. To run it now: Actions → Update latest videos → Run workflow.
- **The 60-day pause.** GitHub pauses scheduled workflows in public repositories after 60 days with no activity. If the rows stop updating, open Actions → Update latest videos → Enable workflow.
