# campbell-content-studio.github.io

## Automatic video rows

Once a day, `.github/workflows/update-latest-videos.yml` refreshes two rows on the homepage from the channels' public YouTube RSS feeds (no API key, no quota):

- **Behind the craft**: the latest 4 long-form Inside ACC episodes from Adam Campbell Cinema.
- **Latest from The Grim Script**: the latest 4 long-form episodes.

Shorts are skipped. The four featured films and The Grim Script's featured episode are hand-picked and never change automatically.

- The script rewrites only the HTML between `<!-- auto:NAME -->` and `<!-- /auto:NAME -->`. Edit anything outside those markers by hand as usual.
- The rules live in `.github/latest-videos.config.json`: the number of cards, the video IDs and title patterns to leave out, and the topic labels shown above each title. To set a label by hand, add `"VIDEO_ID": "Label"` to `labels`.
- `.github/latest-videos.state.json` remembers every long-form upload seen so far, because each feed only lists the latest 15 uploads, Shorts included. The workflow maintains it.
- The workflow commits only when something changed. To run it now, open Actions → Update latest videos → Run workflow.
