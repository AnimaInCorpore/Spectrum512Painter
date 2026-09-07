import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from './png.mjs';
import { labs, steWord, weight, distance, quantizeImage, convertLine } from './reference.mjs';
import { getSpectrum512ColorSlotIndex as slotAt } from '../../js/imaging/spectrum512-slots.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync('assets', { recursive: true });
function words(name, values) {
	const buffer = Buffer.alloc(values.length * 2);
	values.forEach((v, i) => buffer.writeUInt16BE(v & 65535, i * 2));
	writeFileSync(`assets/${name}`, buffer);
}

const background = readPng('../img/sprite-demo/space-320x200.png');
const sprite = readPng('../img/sprite-demo/sprite-32x32.png');
if (background.width !== 320 || background.height !== 200 || sprite.width !== 32 || sprite.height !== 32) throw Error('Incorrect asset dimensions');
const demoX = 144, demoY = 84;
const source = quantizeImage(background), spriteIds = quantizeImage(sprite, demoX, demoY);
const spriteOdd = quantizeImage(sprite, 1, 0);
const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
if (mask.length !== 128) throw Error('Incorrect mask size');
for (let i = 0; i < 1024; i++) if (Boolean(mask[i >> 3] & (128 >> (i & 7))) !== Boolean(sprite.rgba[i * 4 + 3])) throw Error('Mask mismatch');
words('source.bin', Array.from(source)); words('sprite.bin', Array.from(spriteIds));
words('sprite-odd.bin', Array.from(spriteOdd));
writeFileSync('assets/mask.bin', mask);
words('oklab.bin', labs.flat());
words('squares.bin', Array.from({ length: 255 }, (_, i) => (i - 127) ** 2));
words('ste-colors.bin', Array.from({ length: 4096 }, (_, id) => steWord(id)));
words('weights.bin', Array.from({ length: 325 * 325 }, (_, i) => {
	const a = Math.floor(i / 325), b = i % 325;
	return a + b ? weight(a, b) : 0;
}));
const rows = Buffer.alloc(325 * 4);
for (let i = 0; i < 325; i++) rows.writeUInt32BE(i * 650, i * 4);
writeFileSync('assets/weight-rows.bin', rows);

const checkpoints = Buffer.alloc(200 * 10 * 768);
const backgroundSlots = [];
function encode(source, prefix) {
	const screen = Buffer.alloc(32000), palette = [], rgb = new Uint8Array(320 * 200 * 3);
	for (let y = 1; y < 200; y++) {
		const line = convertLine(source.subarray(y * 320, (y + 1) * 320), prefix === 'background' ? {
			onCheckpoint(x, slots) {
				let offset = y * 7680 + (x / 32) * 768;
				for (const c of slots) for (const v of [c.id, c.count, ...c.sums, ...labs[c.id]]) {
					checkpoints.writeUInt16BE(v & 65535, offset); offset += 2;
				}
			}
		} : undefined);
		line.planar.copy(screen, y * 160); palette.push(...line.slots.map(steWord));
		if (prefix === 'background') backgroundSlots[y] = line.slots;
		rgb.set(line.rgb, y * 960);
	}
	writeFileSync(`assets/${prefix}-screen.bin`, screen); words(`${prefix}-palettes.bin`, palette);
	writePng(`assets/${prefix}.png`, 320, 200, rgb);
}

encode(source, 'background');
writeFileSync('assets/checkpoints.bin', checkpoints);
const composite = source.slice();
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
	const i = y * 32 + x;
	if (mask[i >> 3] & (128 >> (i & 7))) composite[(y + demoY) * 320 + x + demoX] = spriteIds[i];
}
encode(composite, 'reference');

// The optional fast path leaves the background palettes fixed. Cache the exact
// closest accessible entry for each sprite color, row and palette-access band.
const opaqueColors = ids => Array.from(ids).filter((_, i) => mask[i >> 3] & (128 >> (i & 7)));
const spriteColors = [...new Set([...opaqueColors(spriteIds), ...opaqueColors(spriteOdd)])].sort((a,b) => a-b);
if (spriteColors.length > 64) throw Error('Fast path supports up to 64 distinct sprite RGB12 colors');
for (const [name, ids] of [['sprite-codes.bin', spriteIds], ['sprite-codes-odd.bin', spriteOdd]]) {
	writeFileSync(`assets/${name}`, Buffer.from(Array.from(ids, id => Math.max(0, spriteColors.indexOf(id)))));
}
const boundaries = [0];
for (let i = 0; i < 16; i++) { const x = 10*i + (i & 1 ? -5 : 1); boundaries.push(x, x+160); }
boundaries.sort((a,b) => a-b);
const segmentOffsets = Array.from({length:320},(_,x) => (boundaries.findLastIndex(start => start <= x))*64);
words('segment-offsets.bin', segmentOffsets);
const fast = Buffer.alloc(200 * 33 * 64);
for(let y=1;y<200;y++) for(let band=0;band<33;band++) for(let c=0;c<spriteColors.length;c++) {
	let best=Infinity, index=0;
	for(let i=0;i<16;i++) {
		const d=distance(spriteColors[c],backgroundSlots[y][slotAt(boundaries[band],i)]);
		if(d<best) { best=d; index=i; }
	}
	fast[(y*33+band)*64+c]=index;
}
writeFileSync('assets/fast-map.bin',fast);
writeFileSync('assets/sprite-colors.json',JSON.stringify(spriteColors));
const fastIds = (demoX + demoY) & 1 ? spriteOdd : spriteIds;
const fastScreen=readFileSync('assets/background-screen.bin'), fastRgb=new Uint8Array(320*200*3);
for(let sy=0;sy<32;sy++) for(let sx=0;sx<32;sx++) {
	const i=sy*32+sx, x=sx+demoX, y=sy+demoY;
	if(!(mask[i>>3]&(128>>(i&7)))) continue;
	const code=spriteColors.indexOf(fastIds[i]), index=fast[y*2112+segmentOffsets[x]+code];
	for(let p=0;p<4;p++) {
		const offset=y*160+(x>>4)*8+p*2, bit=0x8000>>(x&15);
		fastScreen.writeUInt16BE((fastScreen.readUInt16BE(offset)&~bit)|((index&(1<<p))?bit:0),offset);
	}
}
writeFileSync('assets/fast-screen.bin',fastScreen);
for(let y=1;y<200;y++) for(let x=0;x<320;x++) {
	let index=0;
	for(let p=0;p<4;p++) if(fastScreen.readUInt16BE(y*160+(x>>4)*8+p*2)&(0x8000>>(x&15))) index|=1<<p;
	const id=backgroundSlots[y][slotAt(x,index)];
	fastRgb.set([(id>>8)*17,((id>>4)&15)*17,(id&15)*17],(y*320+x)*3);
}
writePng('assets/fast.png',320,200,fastRgb);
console.log('Generated background, source RGB12, sprite/mask, fixed-point tables and reference image.');
