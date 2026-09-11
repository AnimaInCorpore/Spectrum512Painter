# Eight colored, shaded balls

Run `COLORED.PRG` on the same 8 MHz STE / 60 Hz Spectrum raster setup as
`EIGHT.PRG`. Ruby, emerald, sapphire, gold, orange, violet, turquoise and silver
balls move independently and bounce at arbitrary pixel positions. These are
32×32 shaded sprites, preserving the source ball's silhouette, light direction
and highlight; they are not rotating polygon meshes.

Space pauses/resumes, R scatters the balls, and Escape returns to the desktop.
The Q/F palette switches belong to the other demos and are inactive here.

## Color and drawing

The space background and its ten registers are unchanged. Six fixed STE colors
in registers 10–15 are shared by all eight balls. Build-time, sprite-local 4×4
dithering mixes these colors to supply eight apparent tints and intermediate
shades. This is a six-color display approximation; saturated intermediate hues
and gradients are visibly dithered. The pattern travels with each ball.

Each color has sixteen compiled masked blitters, selected by ball identity and
horizontal alignment. No color search, per-pixel mapping or palette rebuilding
runs during animation. A common fixed palette also avoids palette conflicts
when differently colored balls occupy the same scanline. Later balls draw in
front, and all old footprints are restored before any new ball is drawn.

## Build and verification

From `ste/`, run `node tools/verify-colored.mjs`. It generates only `colored-*`
assets and `COLORED.PRG`, verifies all eight blitter sets against an independent
per-pixel compositor in 463 edge/alignment/overlap scenes, and runs 160 scene
updates in cycle-exact Hatari. It checks screen bytes, palette words, motion,
scatter, buffer history and desktop cleanup, and measures complete-scene FPS.
The printed temporary directory contains screenshots and the Hatari log.

Measured with cycle-exact 8 MHz STE emulation: 60 complete scene updates in
596 display VBLs, or **6.04 fps** at the 60 Hz raster rate. Text + data + BSS
use **448,410 bytes**. The existing launch configuration uses 4 MB RAM.

It also rebuilds EIGHT.PRG, EIGHT-RAW.PRG and LIMITED.PRG in a temporary directory
and checks that the shared-source conditional changes leave them byte-identical.
Existing background, movement and restoration assets are reused. `VASM`,
`HATARI` and `TOS` can override the tools in the sibling F030Arcade project.
