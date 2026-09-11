# Eight independent STE balls

`EIGHT.PRG` is a separate demo. `LIMITED.PRG` remains the one-ball demo.
Eight masked 32×32 balls move independently over the same 320×200 background.
Their positions and velocities are updated on the Atari, not played back from
a recorded trajectory. Each ball bounces at the display edges; balls can pass
over one another, with later balls drawn in front.

## Controls

- **Space:** pause/resume.
- **R:** scatter all eight to new pseudorandom positions and directions.
- **Q:** toggle background-color reuse (enabled initially).
- **F:** toggle adaptive per-scanline sprite palettes (enabled initially).
- **Escape:** restore the Atari desktop.

## Palette and performance

The background retains hardware registers 0–9 and its three Spectrum palette
writes per scanline. The six sprite registers (10–15) retain the same logical
indices and compiled planar blitters, but the STE words can now be selected per
scanline. The runtime builds a 202-byte line table from the current ball
positions and copies the precomputed source-row palette for the frontmost ball
on each active line. No color-distance search runs on the Atari.

Press **F** to return to the original shared six-color palette path. This keeps
the original renderer available for comparison; **Q** still independently
controls the existing background-color reuse corrections.

Background-color reuse is precomputed for every legal position, but only
applied when the background color is at least twice as close in squared Oklab
error as the dedicated sprite color. This keeps the eight-ball lookup data and
drawing cost bounded.
For the supplied asset, the row palettes reduce the isolated ball's opaque
pixel color error by about 19% relative to the fixed six-color palette. The
existing selective reuse reduces the all-position error by 12.68% relative to
the dedicated sprite colors used by the generated lookup data. Neither palette
conversion nor color-distance searches run during animation.

Measured in cycle-exact Hatari at **8 MHz / 4 MB STE / 60 Hz raster**:

| Mode | Complete eight-ball scene updates |
| --- | ---: |
| Adaptive row palette plus selective background reuse | about 3.2 fps |
| Adaptive row palette only (Q) | about 4.0 fps |

These are complete scene frame rates, not per-ball rates. The display raster
continues at 60 Hz. Text + data + BSS use about 3.56 MiB; run with 4 MB RAM.
The palette, blitters, row table and color corrections are prepared on the host
at build time, while movement, line-table assembly, restoration and drawing run
on the STE. The legacy palette stream remains in the executable and is selected
with **F**.

## Build and verification

From `ste/`, run:

```sh
node tools/verify-eight.mjs
```

The script generates separate `eight-*` assets, builds `EIGHT.PRG`, checks 465
edge/overlap/scatter scenes in both color modes, then runs 260 complete scene
updates in Hatari. It verifies exact screen bytes, all eight positions and
velocities, front-buffer position history, randomization, mode switching,
palette data and desktop cleanup. It also rebuilds the one-ball program in a
temporary directory and checks that its executable remains byte-identical.
Screenshots and logs are saved in the printed temporary directory.

The two screen buffers each retain their own old-position history. Every old
footprint is restored before any new ball is drawn, preventing overlapping
balls from erasing one another. Screens and position history are switched
together at VBL; no partially updated eight-ball frame is presented.

`VASM`, `HATARI` and `TOS` environment variables override the default tools/ROM
paths in the sibling `F030Arcade` project. Existing `limited-background*` assets
are reused without rewriting them; if missing, the one-ball asset generator
creates them first.
