# yt-download

A local web interface for [yt-dlp](https://github.com/yt-dlp/yt-dlp). Paste a link, pick a quality, watch it come down.

Nothing is hosted: the server runs on your own machine and the files land in your own folder.

```sh
brew install yt-dlp ffmpeg
npm install
npm start            # http://127.0.0.1:5175
```

## Why this exists

`yt-dlp <url>` already works, so this only earns its place by doing the parts that are annoying by hand:

- **Choosing a format.** YouTube offers a dozen streams per video and none of them is both video and audio at a watchable quality. The UI shows four presets and the size each one would actually produce.
- **Seeing what is happening.** A progress bar, the merge step, and the final file name — which cannot be predicted in advance (see below).
- **Playlists and channels** expand into a queue that runs one at a time and survives individual failures.
- **From your phone**, if you start it with `--host 0.0.0.0` on the same network.

It is a window onto yt-dlp, not a replacement for it. Every download is still yt-dlp doing the work.

## Usage

```sh
npm start                              # 127.0.0.1:5175, saves to ~/Downloads
npm start -- --dir ~/Music --port 8080
npm start -- --host 0.0.0.0            # reachable from the local network
npm run dev                            # Vite with hot reload + the API alongside it
```

In development open **http://localhost:5173** rather than `http://127.0.0.1:5173` — Vite binds to
`[::1]` only, so the IPv4 spelling refuses the connection. `npm start` binds IPv4 and does not have
this quirk.

`--host 0.0.0.0` means anyone on that network can queue downloads and write files on this machine. That is why loopback is the default and the flag has to be typed out.

## What it does not do

- **No sign-in.** Private, members-only and age-restricted videos need an account, and this does not carry cookies.
- **No subtitles, thumbnails, metadata embedding, chapter splitting or SponsorBlock.** All are yt-dlp flags away; none are wired up.
- **Not a general downloader.** yt-dlp supports well over a thousand sites; only YouTube is designed and tested for here.
- **Nothing is deployed.** A hosted version would have its datacentre IP blocked within days, so this is local by design rather than by omission.

Downloading is between you and the terms of whatever you download from.

## Technically

Node 24 runs the server directly from TypeScript — no build step and no runtime dependency for it. The browser UI is Vite + React, and the palette is carried over from [pdf-tools](https://github.com/petervasil1234/pdf-tools) and [hypo-calculator](https://github.com/petervasil1234/hypo-calculator).

```
server/parse.ts     yt-dlp output lines → typed events
server/formats.ts   preset → yt-dlp selector, plus size estimates
server/errors.ts    stderr → a message worth reading
server/queue.ts     serial queue, injectable runner
server/ytdlp.ts     the only module that spawns anything
server/index.ts     http, JSON routes, server-sent events
shared/types.ts     the contract between server and UI
```

yt-dlp is called as a **command**, not imported as a Python library. That way Homebrew owns its version — and it ships a new one nearly every week, because YouTube keeps changing the signature challenge its stream URLs are protected by. A pinned dependency would make that treadmill ours.

Progress arrives over server-sent events: the server knows exactly when something changed, and nothing ever needs to travel the other way.

### Three things the tests pin down

Each of these was wrong in the first draft and was caught by checking against yt-dlp itself rather than by reasoning about it.

1. **The output extension cannot be predicted.** Merging picks the container, so `bv*+ba` on a vp9 video produces `.webm`, not `.mp4`. The final name is read from `--print after_move:%(filepath)s` and nowhere else.
2. **Size estimates must follow yt-dlp's own ordering.** `yt-dlp -J` returns formats worst-to-best by its preference, so the *last* match is the one that gets picked. Taking the largest file instead overstated one real video by 56%.
3. **Progress needs a stub to test.** A short video finishes before a single progress event can be observed, so the spawn tests run against a fake `yt-dlp` script. Without it there would be no evidence the bar ever moves.

### Locally

```sh
npm test        # 52 tests, no network and no yt-dlp needed
npm run typecheck
npm run build
```

The test suite deliberately touches neither the network nor yt-dlp, so it cannot start failing because YouTube changed something.
