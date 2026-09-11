# STE moving-sprite demo

For the separate eight-ball version, see [EIGHT-BALLS.md](EIGHT-BALLS.md)
and run `EIGHT.PRG`.

For eight differently colored, shaded balls, run `COLORED.PRG` and see
[COLORED-BALLS.md](COLORED-BALLS.md).

For the full-fidelity, no-dither version, run `FULLBALL.PRG` and see
[FULLCOLOR-BALLS.md](FULLCOLOR-BALLS.md).

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

## Moving ball with 10+6 registers

`LIMITED.PRG` displays the background using indices 0–9 and a bouncing ball
using six dedicated colors in indices 10–15 **plus any closer background
color accessible at the sprite pixel's screen coordinate**. The ten background registers change during the three
Spectrum palette writes (up to 30 background entries per scanline). The six
sprite registers repeat across the writes. All colors come from the STE's
4096-color gamut. Ties retain the dedicated sprite color. Borrowed colors may
change with position; this minimizes per-pixel color error, not temporal error.
The 32×32 ball moves at pixel-aligned positions within x=0..288 and y=1..168.
Space pauses/resumes it; Escape returns to the desktop. Row zero is reserved
for raster synchronization.

Sixteen compiled, pre-shifted masked blitters eliminate color searches during
animation, skip transparent groups and directly write fully opaque groups.
Each update restores the previous footprint (two or three 16-pixel groups per
row), draws the ball, applies sparse precomputed XOR corrections to borrow
background colors, and selects a vertical window in a padded sprite palette
stream. Common motion deltas skip restoration beneath the new opaque ball;
other deltas retain a general restore path. Double-buffered screens and their palette pointers are presented
together at VBL. Background pixels/palettes remain immutable; sprite dithering
travels with the ball. Independent background/sprite palette sources preserve
the raster write timing while replacing the former 3,241,728-byte palette
table with 12,060 + 15,552 bytes. The reuse tables contain a 194,208-byte position
index, 2,091,594 bytes of deduplicated patch lists and a 1,060,384-byte dictionary
of fixed-size 68000 correction routines. Text + data + BSS total about 3.56 MB;
this targets a **4 MB STE**, not a stock 1 MB machine.

Background conversion compares a ten-color row palette against a restricted
serialized Spectrum merge, keeping the lower-error result per row. For the
included space image, fixed-point Oklab squared error decreases from 2,970,919
to 1,621,116 (45.4%). This is the build-time metric against quantized STE source
pixels, not a claim of an equivalent percentage improvement in perceived quality.

Across all 48,552 legal ball positions, borrowing background colors lowers the
ball's fixed-point Oklab squared error from 376,229,448 to 317,219,202 (15.68%).
The dedicated six-color result remains the fallback for every pixel. No color
distance search occurs at runtime. `assets/limited-dedicated.png` and
`assets/limited.png` provide the centered before/after previews.

With background-color reuse enabled, the optimized demo measures **30 fps** on the cycle-exact 8 MHz STE setup:
100 updates in 200 VBLs at 60 Hz, compared with about 15 fps for the initial
moving 10+6 version. The raster display still runs at 60 Hz. Each ball position
lasts two display frames during the measured 100-update interval. Arbitrary
large jumps can cost more than the specialized bouncing-ball motion. The
remaining limit is drawing time outside the Spectrum raster routine.

Build and verify it with `node tools/verify-limited.mjs`. This regenerates the
assets, checks the generated blitters and color reuse at 1,250 edge/interior
positions, all 168 palette windows and all 144 overlap restorers, assembles the viewer, runs 1,000
VBLs in Hatari, compares the moving
frame's entire screen and palette stream with a reference, measures cadence,
then exercises its exit path and saves display and desktop screenshots in a
temporary directory.
Hardware access and VBL installation run through XBIOS Supexec.
