# Promo

The source of the Kombinat promo video: about a minute at 1920×1080 and 30 fps, with a voiceover. Every frame comes from this folder and the demo website, so a change to the video is a change to the code.

## Commands

Run them from the repo root. Recording needs ffmpeg (`brew install ffmpeg`) and Playwright's Chromium (`pnpm --filter promo exec playwright install chromium`).

```bash
pnpm --filter promo dev                       # play the scenes at http://localhost:5175
pnpm --filter promo snapshot webhook 2 6.5    # save moments of a scene to out/snapshots
pnpm --filter promo record                    # record every segment and render out/kombinat.mp4
pnpm --filter promo record webhook tour       # record only these, reuse the frames of the rest
pnpm --filter promo voice                     # turn the voiceover takes into clips at one pace
pnpm --filter promo thumbnail                 # render the YouTube thumbnail to out/thumbnail.png
pnpm --filter promo readme-gif                # record the dashboard GIF of the root README
```

`record` builds the website and the scenes, then writes to `out/`, which git ignores:

- `kombinat.mp4`: the video with the voiceover, and `kombinat-silent.mp4` without it.
- `poster.png`: the last frame of the routine file scene.
- `frames/<segment>/`: the captured frames, which `record <segment>` reuses for the segments it does not name.
- `clips/`: each segment as its own video.

`thumbnail` renders `src/stills/thumbnail-still.tsx`, which shows the same routine file as the video next to a run of it.

`readme-gif` builds the website, clicks through its dashboard with the steps in `scripts/readme-tour.ts` and writes `.github/assets/dashboard.gif`, which the root README shows under Monitoring. Run it again when the dashboard changes, and commit the GIF.

## How it works

`src/timeline.ts` lists the segments in order with their lengths: the scenes and one dashboard tour.

- A scene is a React component in `src/scenes/` that draws one moment from `time`, the seconds since it started. `src/motion.ts` turns time into progress and styles. The recorder seeks the scene to every frame and takes a screenshot, so a scene looks the same on any machine, CSS animations included.
- The dashboard tour, `scripts/capture-tour.ts`, clicks through the built website with a drawn cursor and captions, and records it in real time through the Chrome DevTools screencast.
- `scripts/render-video.ts` encodes each segment and joins them with crossfades.

To change a text, a timing or a layout, edit the scene, check it with `dev` or `snapshot`, then record that scene again. To add a scene, add its name and length to the timeline and its component to `src/scenes/index.ts`.

The tour shows the website's sample data, so a change there, such as a new routine, can move what the tour points at.

## Voiceover

`src/narration.ts` holds the script: one line per segment, or per tour caption with `cue`. The voice is Fish Audio's Sarah, with the model Fish Audio Drama 3 at speed 1x, and it reads Kombinat as Kombinaht, said as in Russian.

1. In Fish Audio's text to speech, generate each line as `toSpokenText` gives it. Save both takes as `out/voice/raw/<number>-<segment>-a.mp3` and `-b.mp3`, such as `04-home-b.mp3`, numbered from 1 in the order of the script.
2. Run `pnpm --filter promo voice`. It trims the silence around each take, stretches it to one pace, at most 15% and without changing the pitch, evens out the loudness and keeps the take that needed the least stretching. A line's `take` picks one by hand. It warns when a scene is too short for its line.
3. Run `pnpm --filter promo record`, which lays the clips over the video.

A line starts just after the crossfade into its segment. The tour records when each caption appears, in `out/frames/tour/marks.json`, so a tour line with `cue` starts with that caption. The home scene lights up each card when the voice names it, at the times in `mentionedAt`, so move those when the home line changes.
