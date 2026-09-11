import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coloredPositions } from './colored-reference.mjs';
import { INITIAL_BALLS } from './eight-model.mjs';
import { fullcolorReference } from './fullcolor-reference.mjs';
import { readPng, writePng } from './png.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync(process.execPath, ['tools/generate-fullcolor.mjs'], { stdio: 'inherit' });
const reference = fullcolorReference();
reference.verifyRows();
const output = mkdtempSync(resolve(tmpdir(), 'ste-fullcolor-'));
const vasm = process.env.VASM || resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
execFileSync(vasm, ['fullcolor-demo.s', '-m68000', '-Ftos', '-L', 'fullcolor.lst', '-o', 'FULLBALL.PRG'], { stdio: 'inherit' });
for (const [source, binary] of [['eight-demo.s', 'EIGHT.PRG'], ['eight-raw-demo.s', 'EIGHT-RAW.PRG'], ['limited-demo.s', 'LIMITED.PRG'], ['colored-demo.s', 'COLORED.PRG'], ['main.s', 'SPECTSPR.PRG']]) {
	execFileSync(vasm, [source, '-m68000', '-Ftos', '-o', `${output}/${binary}`], { stdio: 'pipe' });
	assert.ok(readFileSync(binary).equals(readFileSync(`${output}/${binary}`)), `${binary} regression: executable changed`);
}
const prg = readFileSync('FULLBALL.PRG'), text = prg.readUInt32BE(2), data = prg.readUInt32BE(6), bss = prg.readUInt32BE(10), bases = [0, text, text + data];
assert.ok(text + data + bss < 4 * 1024 * 1024 - 256 * 1024, 'Exceeds 4 MB STE memory budget');
const symbols = [...readFileSync('fullcolor.lst', 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
	.map(([, name, section, offset]) => `${(bases[Number(section)] + parseInt(offset, 16)).toString(16)} T ${name}`);
writeFileSync(`${output}/symbols`, symbols.join('\n') + '\n');
const ini = (name, commands) => writeFileSync(`${output}/${name}.ini`, commands + '\n');
const positions = frame => {
	if (frame <= 160) return coloredPositions(frame);
	if (frame === 178) return INITIAL_BALLS;
	if (frame === 177) return Array.from({ length: 8 }, () => [144, 84, 1, 1]);
	const shift = frame - 161;
	return Array.from({ length: 8 }, (_, i) => [i * 32 + shift, shift % 3 ? (i & 1 ? 168 : 1) : 84, 1, 1]);
};
ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
ini('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
const frames = [1, 20, 30, 80, 100, 101, 160, ...Array.from({ length: 18 }, (_, i) => 161 + i)];
ini('start', `symbols ${output}/symbols TEXT\n` + frames.map(n => `b pc = display_ready ${n > 1 ? `:${n} ` : ''}:trace :once :file ${output}/frame-${n}.ini`).join('\n') + `\nb pc = input_done :100 :trace :once :file ${output}/scatter.ini`);
ini('scatter', 'r pc=scatter_now');
for (const n of frames) {
	const commands = [`savebin ${output}/vbl-${n}.bin vbl_counter #4`, `savebin ${output}/screen-${n}.bin '(front_screen)' #32000`, `savebin ${output}/balls-${n}.bin balls #64`, `savebin ${output}/history-${n}.bin '(front_positions)' #32`, `savebin ${output}/palettes-${n}.bin '(front_palettes)' #19392`];
	if (n >= 160 && n < 178) {
		// Hatari's debugger memwrite parser accepts hexadecimal words, but a
		// leading minus is parsed as an option rather than a signed value.
		// Encode the signed ball velocities as their 16-bit two's-complement
		// representation so the injected test state is unambiguous.
		commands.push(`w w balls ${positions(n + 1).flat().map(v => (v & 0xffff).toString(16)).join(' ')}`, 'r pc=draw_begin');
	}
	if (n === 178) commands.push('w w paused 1', `b VBL = 'VBL+3' :trace :once :file ${output}/capture.ini`);
	ini(`frame-${n}`, commands.join('\n'));
}
ini('capture', `screenshot ${output}/display.png\nb pc = poll_input :trace :once :file ${output}/quit.ini`);
ini('quit', `r pc=quit_demo\nb pc = exit_program :trace :once :file ${output}/restored.ini`);
ini('restored', `echo FULLCOLOR_CLEANUP_COMPLETED\nb VBL = 'VBL+100' :trace :once :file ${output}/done.ini`);
ini('done', `screenshot ${output}/desktop.png\nquit`);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on', '--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1', '--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--crt', 'off', '--confirm-quit', 'off', '--run-vbls', '15000', '--parse', `${output}/boot.ini`, resolve('FULLBALL.PRG')];
const run = spawnSync(hatari, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' } });
const log = (run.stdout || '') + (run.stderr || '');
writeFileSync(`${output}/hatari.log`, log);
assert.ok(!run.error && run.status === 0 && !/Bus Error|Address Error|Illegal instruction|ERROR:/i.test(log), `Hatari failed: ${output}/hatari.log`);
assert.ok(log.includes('FULLCOLOR_CLEANUP_COMPLETED'), `Demo did not finish: ${output}/hatari.log`);
for (const n of frames) {
	const balls = positions(n), raw = readFileSync(`${output}/balls-${n}.bin`), history = readFileSync(`${output}/history-${n}.bin`);
	const actual = Array.from({ length: 8 }, (_, i) => Array.from({ length: 4 }, (_, j) => raw.readInt16BE(i * 8 + j * 2)));
	assert.deepEqual(actual, balls, `Motion/scatter mismatch at frame ${n}`);
	actual.forEach((ball, i) => assert.deepEqual([history.readInt16BE(i * 4), history.readInt16BE(i * 4 + 2)], ball.slice(0, 2)));
	const expected = reference.compose(balls);
	assert.ok(expected.screen.equals(readFileSync(`${output}/screen-${n}.bin`)), `Screen mismatch at frame ${n}: ${output}`);
	assert.ok(expected.stream.equals(readFileSync(`${output}/palettes-${n}.bin`)), `Palette mismatch at frame ${n}: ${output}`);
}
const preview = reference.rgb(reference.compose(INITIAL_BALLS));
writePng('assets/fullcolor-preview.png', 320, 200, preview);
const screenshot = readPng(`${output}/display.png`);
let displayDifferences = 0;
const sx = screenshot.width / 320, sy = screenshot.height / 200;
for (let y = 1; y < 200; y++) for (let x = 0; x < 320; x++) {
	const offset = (Math.floor(y * sy) * screenshot.width + Math.floor(x * sx)) * 4;
	if ([0, 1, 2].some(c => Math.abs(screenshot.rgba[offset + c] - preview[(y * 320 + x) * 3 + c]) > 1)) displayDifferences++;
}
console.log(`Raster RGB comparison: ${displayDifferences} differing pixels. Screenshot: ${output}/display.png`);
assert.equal(displayDifferences, 0, 'Displayed raster colors differ from the composited reference');
const vbl = n => readFileSync(`${output}/vbl-${n}.bin`).readUInt32BE(0);
console.log(`Full-color balls: 60 updates / ${vbl(80) - vbl(20)} VBLs = ${(3600 / (vbl(80) - vbl(20))).toFixed(2)} fps. RAM: ${text + data + bss} bytes.`);
console.log(`Verified nearest-color rows, all alignments, dense overlap, motion, scatter, screen/palette buffers, raster RGB and desktop cleanup. Original binaries unchanged. Results: ${output}`);
