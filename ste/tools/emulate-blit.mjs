// Builds blit.s (BAND=1 and BAND=0), runs each in Hatari for FRAMES presented frames and reports:
// the cycles of the drawing per frame, the cycles the display routine leaves per frame, frames per VBL, and
// whether the shown screen and palettes match the expected picture for the ball position of that buffer.
// node tools/emulate-blit.mjs [outdir]       env: FRAMES (300), SPEED_X, SPEED_Y, BALLS, FRAME_VBLS, VARIANTS (band,limited)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { readPng } from './png.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const { render } = await import('./generate-blit.mjs');
const frames = Number(process.env.FRAMES || 300), balls = Number(process.env.BALLS || 1), frameVbls = Number(process.env.FRAME_VBLS || 1);
const sibling = resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
const vasm = process.env.VASM || (existsSync(sibling) ? sibling : 'vasmm68k_mot');
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const hz = 8010613;

async function run(variant) {
	const output = resolve(process.argv[2] || 'verification-blit', variant);
	const name = variant === 'band' ? 'BLITBAND' : balls > 1 ? `BALLS${balls}` : 'BLIT10';
	mkdirSync(output, { recursive: true });
	const defines = [`-DBAND=${variant === 'band' ? 1 : 0}`];
	for (const key of ['SPEED_X', 'SPEED_Y', 'TIMER_A_TICKS', 'BALLS', 'FRAME_VBLS']) if (process.env[key]) defines.push(`-D${key}=${process.env[key]}`);
	execFileSync(vasm, ['-quiet', 'blit.s', '-m68000', '-Ftos', ...defines, '-L', `${output}/blit.lst`, '-o', `${name}.PRG`], { stdio: 'inherit' });
	const prg = readFileSync(`${name}.PRG`), textSize = prg.readUInt32BE(2), dataSize = prg.readUInt32BE(6);
	const sections = [0, textSize, textSize + dataSize];
	const symbols = [...readFileSync(`${output}/blit.lst`, 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
		.map(([, symbol, section, offset]) => `${(sections[Number(section)] + parseInt(offset, 16)).toString(16)} T ${symbol}`);
	writeFileSync(`${output}/blit.sym`, symbols.join('\n') + '\n');

	const ini = (file, text) => writeFileSync(`${output}/${file}.ini`, text + '\n');
	ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
	ini('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
	// Marks from frame 20 on: the start and end of the drawing and of the display routine.
	ini('start', `symbols ${output}/blit.sym TEXT\nb pc = draw_begin :20 :trace :once :file ${output}/measure.ini`);
	ini('measure', [
		`b pc = draw_begin :trace :file ${output}/mark-begin.ini`,
		`b pc = draw_done :trace :file ${output}/mark-done.ini`,
		`b pc = spectrum_vbl :trace :file ${output}/mark-vbl.ini`,
		`b pc = vbl_end :trace :file ${output}/mark-vblend.ini`,
		`b pc = spectrum_raster :trace :file ${output}/mark-raster.ini`,
		`b pc = raster_return :trace :file ${output}/mark-return.ini`,
		...(process.env.PROFILE ? ['profile on'] : []), 'echo MARK_START', 'evaluate CycleCounter', 'evaluate (vbl_counter).l',
		`b pc = draw_begin :${frames - 20} :trace :once :file ${output}/final.ini`].join('\n'));
	for (const mark of ['begin', 'done', 'vbl', 'vblend', 'raster', 'return']) ini(`mark-${mark}`, `echo MARK_${mark.toUpperCase()}\nevaluate CycleCounter`);
	ini('final', [
		'bc', 'echo MARK_FINAL', 'evaluate CycleCounter', 'evaluate (vbl_counter).l', ...(process.env.PROFILE ? ['profile off', `profile save ${output}/profile.txt`] : []),
		`savebin ${output}/front-screen.bin '(front_screen)' #32000`,
		`savebin ${output}/front-palettes.bin '(front_palettes)' #19104`,
		`savebin ${output}/state.bin screen_0 #4`, `savebin ${output}/front.bin front_screen #4`,
		`savebin ${output}/buffers.bin buffer_0 #${balls * 8}`,
		'setopt --fast-forward off', `b VBL = 'VBL+3' :trace :once :file ${output}/capture.ini`].join('\n')); // fast forward skips rendering
	ini('capture', [`screenshot ${output}/screen.png`, `savebin ${output}/shown-palettes.bin '(display_palettes_pointer)' #19104`,
		`savebin ${output}/video.bin $ff8200 #16`, `savebin ${output}/screens.bin front_screen #8`, `savebin ${output}/buffers-shot.bin buffer_0 #${balls * 8}`,
		`savebin ${output}/palette-pointers.bin front_palettes #8`, 'quit'].join('\n'));
	const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on',
		'--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1',
		'--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--confirm-quit', 'off', '--run-vbls', String(frames * frameVbls * 2 + 2000),
		'--parse', `${output}/boot.ini`, resolve(`${name}.PRG`)];
	const child = spawn(hatari, args, { env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy', SDL_RENDER_DRIVER: 'software' } });
	let log = '';
	for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { log += data; });
	await new Promise(done => child.on('close', done));
	writeFileSync(`${output}/hatari.log`, log);
	if (!log.includes('MARK_FINAL')) { console.log(log.slice(-2000)); throw Error(`${variant}: did not reach frame ${frames}`); }

	// CycleCounter values in the order of the marks.
	const marks = [...log.matchAll(/MARK_(\w+)> evaluate [^\n]*\n= [^\n]*#(\d+) \(dec\)/g)].map(([, mark, value]) => ({ mark, value: Number(value) }));
	const vbls = [...log.matchAll(/evaluate \(vbl_counter\)\.l\n[^\n]*\n= [^\n]*#(\d+) \(dec\)/g)].map(m => Number(m[1]));
	// The VBL (swap, start of timer A) and the timed palette writes can interrupt the drawing: their time inside
	// a drawing is not counted. Free: from the end of the palette writes to the VBL, and from the end of the VBL
	// to the start of the palette writes.
	const work = [], free = [];
	let begin = null, start = null, interrupted = 0, freeTime = 0, ret = null, vblEnd = null;
	for (const { mark, value } of marks) {
		if (mark === 'BEGIN') { begin = value; interrupted = 0; }
		if (mark === 'VBL' || mark === 'RASTER') { start = value; if (mark === 'VBL' && ret !== null) freeTime = value - ret; if (mark === 'RASTER' && vblEnd !== null) { free.push(freeTime + value - vblEnd); vblEnd = null; } }
		if (mark === 'VBLEND' || mark === 'RETURN') { if (begin !== null && start !== null) interrupted += value - start; start = null; }
		if (mark === 'VBLEND') vblEnd = value;
		if (mark === 'RETURN') ret = value;
		if (mark === 'DONE' && begin !== null) { work.push(value - begin - interrupted); begin = null; }
	}
	const stats = list => { const s = [...list].sort((a, b) => a - b); return `median ${s[s.length >> 1]}, max ${s[s.length - 1]}`; };
	const vblCount = vbls[1] - vbls[0], frameCount = frames - 20;

	// The shown buffer has the balls at the positions stored for it.
	const positions = (buffers, front) => {
		const offset = front === screen0 ? 0 : balls * 4;
		return Array.from({ length: balls }, (_, k) => [buffers.readInt16BE(offset + k * 4), buffers.readInt16BE(offset + k * 4 + 2)]);
	};
	const front = readFileSync(`${output}/front.bin`).readUInt32BE(0), screen0 = readFileSync(`${output}/state.bin`).readUInt32BE(0);
	const shownBalls = positions(readFileSync(`${output}/buffers.bin`), front);
	const expected = render(variant, shownBalls);
	const screen = readFileSync(`${output}/front-screen.bin`), palettes = readFileSync(`${output}/front-palettes.bin`);
	let screenDiff = 0, paletteDiff = 0;
	for (let i = 160; i < 32000; i++) if (screen[i] !== expected.screen[i]) screenDiff++;
	for (let i = 0; i < 19104; i++) if (palettes[i] !== expected.palettes[i]) paletteDiff++;
	console.log(`${variant}, ${balls} ball(s): drawing per picture ${stats(work)} cycles; free per frame ${stats(free)} cycles; ` +
		`${frameCount} pictures in ${vblCount} VBLs (${(60 * frameCount / vblCount).toFixed(1)} fps)`);
	console.log(`${variant}: shown buffer: ${screenDiff} screen bytes and ${paletteDiff} palette bytes differ from the expected picture`);

	// The screenshot shows the frame that has just ended: the buffer that was in front then (dumped before the VBL
	// swaps). Hatari draws its drive LED into the top right corner, which is left out.
	const shotFront = readFileSync(`${output}/screens.bin`).readUInt32BE(0);
	const shotBalls = positions(readFileSync(`${output}/buffers-shot.bin`), shotFront);
	const shot = readPng(`${output}/screen.png`), scale = shot.width / 320, rgb = render(variant, shotBalls).rgb;
	let differ = 0;
	for (let py = 1; py < 200; py++) for (let px = 0; px < 320; px++) {
		if (py < 8 && px >= 300) continue;
		const s = (py * scale * shot.width + px * scale) * 4, o = (py * 320 + px) * 3;
		if (shot.rgba[s] !== rgb[o] || shot.rgba[s + 1] !== rgb[o + 1] || shot.rgba[s + 2] !== rgb[o + 2]) differ++;
	}
	console.log(`${variant}: screenshot: ${differ} pixels differ from the expected picture`);
	return screenDiff + paletteDiff + differ;
}

let bad = 0;
for (const variant of (process.env.VARIANTS || 'band,limited').split(',')) bad += await run(variant);
process.exitCode = bad ? 1 : 0;
