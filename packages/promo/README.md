# Promo

The source of the Kombinat promo video: about a minute at 1920×1080 and 30 fps, without sound. Every frame comes from this folder and the demo website, so a change to the video is a change to the code.

## Commands

Run them from the repo root. Recording needs ffmpeg (`brew install ffmpeg`) and Playwright's Chromium (`pnpm --filter promo exec playwright install chromium`).

```bash
pnpm --filter promo dev                       # play the scenes at http://localhost:5175
pnpm --filter promo snapshot webhook 2 6.5    # save moments of a scene to out/snapshots
pnpm --filter promo record                    # record every segment and render out/kombinat.mp4
pnpm --filter promo record webhook tour       # record only these, reuse the frames of the rest
```

`record` builds the website and the scenes, then writes to `out/`, which git ignores:

- `kombinat.mp4`: the video.
- `poster.png`: the last frame of the title, for a thumbnail.
- `frames/<segment>/`: the captured frames, which `record <segment>` reuses for the segments it does not name.
- `clips/`: each segment as its own video.

## How it works

`src/timeline.ts` lists the segments in order with their lengths: the scenes and one dashboard tour.

- A scene is a React component in `src/scenes/` that draws one moment from `time`, the seconds since it started. `src/motion.ts` turns time into progress and styles. The recorder seeks the scene to every frame and takes a screenshot, so a scene looks the same on any machine, CSS animations included.
- The dashboard tour, `scripts/capture-tour.ts`, clicks through the built website with a drawn cursor and captions, and records it in real time through the Chrome DevTools screencast.
- `scripts/render-video.ts` encodes each segment and joins them with crossfades.

To change a text, a timing or a layout, edit the scene, check it with `dev` or `snapshot`, then record that scene again. To add a scene, add its name and length to the timeline and its component to `src/scenes/index.ts`.

The tour shows the website's sample data, so a change there, such as a new routine, can move what the tour points at.
