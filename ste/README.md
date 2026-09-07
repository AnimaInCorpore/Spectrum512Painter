# STE moving-sprite demo

This is a self-contained 68000/STE program that displays the generated
320×200 Spectrum 512 background and moves a masked 32×32 ball at arbitrary
pixel positions.  The default path keeps the background's serialized 48-entry
palette stream and uses generated lookup tables to choose the closest
accessible STE colour for each opaque sprite pixel.  Press `Q` to switch to a
full line rebuild with checkpointed palette state; press `Q` again to return to
the fast path.  `SPACE` pauses the motion and `ESC` exits to the desktop.

## Build

From this directory:

```sh
node tools/build.mjs
```

The build regenerates the binary assets from `img/sprite-demo/`, assembles
`main.s`, and writes `SPECTSPR.PRG`.

## Hatari verification

The default verification checks the fast path against `assets/fast-screen.bin`
and the immutable background palette stream:

```sh
node tools/emulate.mjs verification-fast
```

The full quality path is selected with `QUALITY=1` and is checked against the
serialized reference image and palettes:

```sh
QUALITY=1 RAW=1 node tools/emulate.mjs verification-quality
```

On an 8 MHz Hatari STE, the measured fast sprite update is about 216,000 CPU
cycles (roughly 27 ms of 68000 time, before the display's VBL pacing).  The
quality rebuild is about 55.4 million cycles (roughly 6.9 seconds), so it is
intended for occasional high-quality redraws rather than animation.

The generated program currently targets a 4 MB STE configuration because the
precomputed checkpoints, lookup maps, source data, and double screen buffers
are deliberately kept in the executable for predictable timing.
