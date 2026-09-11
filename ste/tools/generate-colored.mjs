import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from './png.mjs';
import { paletteRows, shiftedSprite } from './eight-assets.mjs';
import { compileSprite } from './compile-sprite.mjs';
import { BALL_PALETTE, BALL_TINTS, coloredSprites } from './colored-sprites.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
const sprites = coloredSprites(readPng('../img/sprite-demo/sprite-32x32.png'), mask);
const code = ['colored_drawers:', ...sprites.map((_, i) => `\tdc.l color${i}_drawers`), 'sprite_drawers equ color0_drawers'];
for (let i = 0; i < sprites.length; i++) {
	code.push(compileSprite(shiftedSprite(sprites[i], mask)).replaceAll('sprite_draw', `color${i}_draw`));
}
writeFileSync('assets/colored-sprite-code.s', code.join('\n'));
writeFileSync('assets/colored-sprite-indices.bin', Buffer.concat(sprites));
writeFileSync('assets/colored-sprite-stream.bin', paletteRows(BALL_PALETTE, 202, 3));
const preview = Buffer.alloc(320 * 48 * 3, 40);
for (let ball = 0; ball < 8; ball++) for (let i = 0; i < 1024; i++) {
	if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
	const id = BALL_PALETTE[sprites[ball][i] - 10];
	const offset = ((8 + (i >> 5)) * 320 + ball * 40 + 4 + (i & 31)) * 3;
	preview.set([id >> 8, (id >> 4) & 15, id & 15].map(v => v * 17), offset);
}
writePng('assets/colored-balls.png', 320, 48, preview);
console.log(`Prepared eight shaded balls: ${BALL_TINTS.map(([name]) => name).join(', ')}.`);
