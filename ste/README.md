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

## Blitter ball demo (`blit.s`)

A 32×32 ball with 6 colors (registers 10-15) over `SPACE.TGA` in Spectrum 512 mode, drawn by the Blitter with
the routines of the stefastbobs2 sprite compiler. The picture is converted twice by the jscolorquantizer
converter (`UpdateSpectrum512RectangleST2`, checker 4): with all 16 registers and with registers 0-9 only. Then the
brute force optimizer of the painter (`js/imaging/spectrum512-bruteforce.js`, with `colorCount` 16 or 10 and the
border slots 0 and 32 locked) refines every line palette, and every pixel gets its nearest visible entry. That
removes most of the horizontal stripes: the mean OKLAB error per pixel goes from 2.097 to 1.783 with 16 registers
and from 3.487 to 2.904 with 10 (about what 12 registers give without it). It only changes the precomputed
pictures, not the cycles of the demo.

Fewer registers for the picture, converter alone and with the brute force pass (mean OKLAB error per pixel):

| Registers | 16 | 12 | 10 | 8 | 6 | 4 |
|---|---|---|---|---|---|---|
| Converter | 2.097 | 2.879 | 3.487 | 4.333 | 5.613 | 8.140 |
| + brute force | 1.783 | 2.412 | 2.904 | 3.638 | 4.710 | 6.656 |

Looked at side by side, 10 is the useful minimum: 8 with the brute force pass is about as good as 10 without it,
with clear stripes in the planets and the ring, at 6 the planets break up into bands and 4 is unusable.

The ball has a checker dither as well: a pixel takes the mix (average in linear light) of two neighbouring shades
where that mix is nearer to its color than one shade, the darker shade on even, the lighter on odd sprite pixels.
The pattern belongs to the sprite and moves with it; the shape and so the Blitter routines stay the same. The six
shades are chosen for the dithered result (k-means, then one shade at a time replaced by a color of the ball while
that lowers the error): `$222 $444 $777 $999 $bbb $eee`. Mean OKLAB error of the ball: 0.0340 with the nearest of
the k-means shades, 0.0199 with the checker, 0.0187 with the chosen shades (`assets/blit-ball-preview.png` shows the
source and the three).

* `BLITBAND.PRG` (`-DBAND=1`): the picture with 16 registers; only the 32 lines of the ball show the 10 register
  version, whose registers 10-15 hold the ball colors. These lines move with the ball (Blitter line copies of the
  bitmap and the palettes).
* `BLIT10.PRG` (`-DBAND=0`): the 10 register version everywhere, fixed palettes.

```sh
node tools/generate-blit.mjs      # pictures, ball, assets/blit-ball.s (needs ../../stefastbobs2)
node tools/emulate-blit.mjs       # builds both programs and checks them in Hatari
```

The VBL only swaps the buffer pointers and starts MFP timer A, whose interrupt runs the timed palette writes of
`raster.s` (copied to `blit-raster.s`) shortly before the picture. So the main loop also gets the top border:
about 23,000 free cycles a frame at 60 Hz instead of 13,700. Timer C is off while the demo runs.
The screen address has to be written before the VBL that shows the new screen (the main loop does it after
drawing): written in the VBL it only takes effect one frame later, and the bitmap would show with the palettes of
the other buffer.

Measured in Hatari (8 MHz STE, cycle exact, 280 frames): both run at 60 fps, and the shown screen, palettes and
the screenshot match the expected picture exactly.

| Vertical speed | `BLITBAND.PRG` | `BLIT10.PRG` |
|---|---|---|
| 1 px / frame | 14,050 cycles a frame | 8,480 |
| 2 px / frame | 17,960 | 8,480 |
| 3 px / frame | 21,860 | 8,480 |

Several balls (`-DBAND=0 -DBALLS=n`, up to 12, all with the same colors) with a new picture every `FRAME_VBLS`
VBLs: all old balls get the picture back, then all new ones are drawn as one chain of routines (ball 0 in front).
The screen address goes out in the frame before the one that shows the new picture. About 8,100 cycles a ball;
measured at 60/3 = 20 fps (`BALLS=n FRAME_VBLS=3 VARIANTS=limited node tools/emulate-blit.mjs`, program
`BALLSn.PRG`), all with the exact expected screen, palettes and screenshot:

| Balls | Cycles per picture | Frame rate |
|---|---|---|
| 6 | 48,940 | 20 fps |
| 7 | 56,980 | 20 fps |
| 8 | 64,980 (max 66,290) | 20 fps |
| 9 | 73,120 | 15 fps |
| 10 | 81,220 | 15 fps |

So 8 balls at 20 fps (`BALLS8.PRG`), with about 3,000 cycles to spare.

`node tools/record-blit.mjs BALLS8.PRG videos/balls8.mp4` records 10 seconds of a program in Hatari as MP4
(every 60 Hz frame, from 2 seconds after it was loaded, pixels doubled).

The band costs about 3,900 cycles per pixel of vertical speed (the lines that enter and leave the band, two frames
of movement because of the double buffer). Not tested: the keys (SPACE, ESC) and real hardware.
