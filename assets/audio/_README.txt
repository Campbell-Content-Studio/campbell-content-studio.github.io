Reel score cue (placeholder)

Put the score cue for the hero reel in this folder as:

  reel-score.mp3   (MP3, 44.1 or 48 kHz stereo, 192–256 kbps, peaks no higher than -1 dBTP,
                    ideally exactly 16.0 seconds, the reel's length, with a short fade at the
                    end so it never clicks when it stops)

A cue of exactly 16.0 s ends as the reel loops. A longer one plays out over the start of the
next loop; a shorter one ends before the reel does. Either way the button resets when it ends.

Then, in index.html, find the button with class "sound-toggle" and set
  data-src="assets/audio/reel-score.mp3"

Until data-src is set, the "Sound on" button stays hidden. The reel itself is always muted;
the cue plays only after a visitor presses "Sound on", never automatically. Turning it on
restarts the reel so picture and music start together; it pauses whenever the reel pauses.

(Files whose names start with "_" are not published by GitHub Pages, so this note stays private.)
