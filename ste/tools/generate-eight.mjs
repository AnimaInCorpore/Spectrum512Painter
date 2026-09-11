import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPng } from './png.mjs';
import { quantizeImage } from './reference.mjs';
import { sharedPalette, closestIndex, paletteRows, rowPalettes, independentRowPalettes, paletteLookup, opaquePixels, shiftedSprite } from './eight-assets.mjs';
import { compileSprite } from './compile-sprite.mjs';
import { compileRestores } from './compile-restores.mjs';
import { createBackgroundReuse, buildReusePatches } from './background-reuse.mjs';
import { INITIAL_BALLS } from './eight-model.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
if (!existsSync('assets/limited-background-stream.bin')) execFileSync(process.execPath, ['tools/generate-limited.mjs'], { stdio: 'inherit' });
const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
const ids = quantizeImage(readPng('../img/sprite-demo/sprite-32x32.png'), 144, 84);
const palette = sharedPalette(ids, mask);
const indices = Buffer.alloc(ids.length);
ids.forEach((id, i) => indices[i] = 10 + closestIndex(id, palette));
const palettes = paletteRows(palette);
const fidelityRows = rowPalettes(ids, mask, palette);
const rawRows = independentRowPalettes(ids, mask);
const rawLookup = paletteLookup(ids, mask, rawRows);
const rawPixels = opaquePixels(ids, mask);
const reuse = createBackgroundReuse(readFileSync('assets/limited-background-palettes.bin'), palettes, ids, indices, mask);
// Eight sprites share both color registers. The fidelity build retains every
// background-color choice that improves squared error by at least 2x; Q can
// disable corrections at runtime for the faster shared-six-color comparison.
const visited = new Set();
for (const pixel of reuse.pixels) if (!visited.has(pixel.costs)) {
	visited.add(pixel.costs);
	for (let i = 0; i < pixel.costs.length; i++) if (pixel.costs[i] * 2 >= pixel.error) pixel.costs[i] = pixel.error;
}
const patches = buildReusePatches(reuse);
writeFileSync('assets/eight-sprite-indices.bin', indices);
writeFileSync('assets/eight-sprite-palettes.bin', palettes);
writeFileSync('assets/eight-row-palettes.bin', fidelityRows);
writeFileSync('assets/eight-raw-row-palettes.bin', rawRows);
writeFileSync('assets/eight-raw-lookup.bin', rawLookup);
writeFileSync('assets/eight-raw-pixels.bin', rawPixels);
writeFileSync('assets/eight-sprite-stream.bin', paletteRows(palette, 202, 3));
writeFileSync('assets/eight-sprite-code.s', compileSprite(shiftedSprite(indices, mask)));
writeFileSync('assets/eight-restore-code.s', compileRestores(mask));
writeFileSync('assets/eight-reuse-index.bin', patches.offsets);
writeFileSync('assets/eight-reuse-patches.bin', patches.patches);
writeFileSync('assets/eight-reuse-code.bin', patches.code);
writeFileSync('assets/eight-initial.s', ['balls:', ...INITIAL_BALLS.map(ball => `\tdc.w ${ball.join(',')}`), 'history0:', '\trept 8', '\tdc.w 0,-1', '\tendr', 'history1:', '\trept 8', '\tdc.w 0,-1', '\tendr', ''].join('\n'));
console.log(`Shared STE RGB12 palette: ${palette.map(id => id.toString(16).padStart(3, '0')).join(', ')}`);
