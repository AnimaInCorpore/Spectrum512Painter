# Eight full-color STE balls

`FULLBALL.PRG` draws eight independently moving, shaded 32×32 balls over the
320×200 Spectrum 512 space background. Ruby, emerald, sapphire, gold, orange,
violet, turquoise and silver are rendered from the source shading without
dithering. The balls can overlap and move at arbitrary pixel positions.

Every affected scanline may use all 16 STE palette registers. The build creates
palette families for the active hue combinations (including a universal family
for dense overlaps), remaps only the background rows touched by the balls, and
uses precomputed 16-way planar sprite rows. Runtime drawing therefore performs
no color-distance search and does not dither; it copies cached rows and applies
the aligned masked blitter.

The STE still exposes 16 registers at a time, so “all colors” means the complete
4096-color STE gamut is available to the precomputed palette choices—not all
4096 colors simultaneously. The prepared tables occupy about 3.2 MB; with
code and BSS the program uses about 3.43 MB and targets a 4 MB STE.

Space pauses/resumes the motion, `R` scatters the balls, and Escape restores the
desktop. Build the data and program with:

```sh
node tools/generate-fullcolor.mjs
vasm fullcolor-demo.s -m68000 -Ftos -o FULLBALL.PRG
```

To launch it in the bundled Hatari STE setup, use the `--auto` path from the
project's `ste` directory:

```sh
hatari --tos ../../F030Arcade/third_party/tos/tos206de.img \
  --harddrive . --machine ste --memsize 4 --auto C:\\FULLBALL.PRG
```
