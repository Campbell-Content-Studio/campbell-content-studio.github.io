Reel score cue (placeholder)

Put the 15–20 second score cue for the hero reel in this folder as:

  reel-score.mp3   (MP3, 44.1 or 48 kHz stereo, 192–256 kbps, peaks no higher than -1 dBTP,
                    with a short fade at the end so the loop point never clicks)

Then, in index.html, find the button with class "sound-toggle" and set
  data-src="assets/audio/reel-score.mp3"

Until data-src is set, the "Sound on" button stays hidden. The reel itself is always muted;
the cue plays only after a visitor presses "Sound on", never automatically. Turning it on
restarts the reel so picture and music start together; it pauses whenever the reel pauses.

(Files whose names start with "_" are not published by GitHub Pages, so this note stays private.)
