import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eightReference, expectedBalls, verifyEightAssets } from './eight-reference.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync(process.execPath, ['tools/generate-eight.mjs'], { stdio: 'inherit' });
const reference = eightReference();
verifyEightAssets(reference);
const vasm = process.env.VASM || resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
execFileSync(vasm, ['eight-demo.s', '-m68000', '-Ftos', '-L', 'eight.lst', '-o', 'EIGHT.PRG'], { stdio: 'inherit' });
const output = mkdtempSync(resolve(tmpdir(), 'ste-eight-'));
// Conditional shared raster wiring must leave the existing single-ball binary intact.
execFileSync(vasm, ['limited-demo.s', '-m68000', '-Ftos', '-o', `${output}/single-regression.prg`], { stdio: 'pipe' });
assert.ok(readFileSync('LIMITED.PRG').equals(readFileSync(`${output}/single-regression.prg`)), 'Single-ball build changed');
const prg = readFileSync('EIGHT.PRG');
const textSize = prg.readUInt32BE(2), dataSize = prg.readUInt32BE(6), bssSize = prg.readUInt32BE(10);
assert.ok(textSize + dataSize + bssSize < 4 * 1024 * 1024 - 256 * 1024);
const bases = [0, textSize, textSize + dataSize];
const symbols = [...readFileSync('eight.lst', 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
	.map(([, name, section, offset]) => `${(bases[Number(section)] + parseInt(offset, 16)).toString(16)} T ${name}`);
writeFileSync(`${output}/symbols`, symbols.join('\n') + '\n');
const ini = (name, commands) => writeFileSync(`${output}/${name}.ini`, commands + '\n');
ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
ini('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
const hits = [1, 20, 30, 80, 100, 101, 180, 181, 200, 260];
ini('start', `symbols ${output}/symbols TEXT\n` + hits.map(n => `b pc = display_ready ${n > 1 ? `:${n} ` : ''}:trace :once :file ${output}/frame-${n}.ini`).join('\n') + `\nb pc = input_done :100 :trace :once :file ${output}/scatter.ini`);
ini('scatter', `r pc=scatter_now\nb pc = input_done :80 :trace :once :file ${output}/toggle.ini`);
ini('toggle', 'r pc=toggle_reuse_now');
for (const n of hits) {
	const commands = [`savebin ${output}/vbl-${n}.bin vbl_counter #4`];
	if ([1, 30, 101, 180, 181, 260].includes(n)) commands.push(`savebin ${output}/screen-${n}.bin '(front_screen)' #32000`, `savebin ${output}/balls-${n}.bin balls #64`, `savebin ${output}/history-${n}.bin '(front_positions)' #32`, `screenshot ${output}/display-${n}.png`);
	if (n === 260) commands.push(`savebin ${output}/palettes.bin '(front_palettes)' #7272`, 'r pc=quit_demo', `b pc = exit_program :trace :once :file ${output}/restored.ini`);
	ini(`frame-${n}`, commands.join('\n'));
}
ini('restored', `echo EIGHT_CLEANUP_COMPLETED\nb VBL = 'VBL+100' :trace :once :file ${output}/done.ini`);
ini('done', `screenshot ${output}/desktop.png\nquit`);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on', '--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1', '--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--confirm-quit', 'off', '--run-vbls', '10000', '--parse', `${output}/boot.ini`, resolve('EIGHT.PRG')];
const run = spawnSync(hatari, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' } });
const log = (run.stdout || '') + (run.stderr || '');
writeFileSync(`${output}/hatari.log`, log);
if (run.error || run.status !== 0 || /Bus Error|Address Error|Illegal instruction|ERROR:/i.test(log)) throw Error(`Hatari failed: ${output}/hatari.log`, { cause: run.error });
for (const n of [1, 30, 101, 180, 181, 260]) {
	const expected = expectedBalls(n), raw = readFileSync(`${output}/balls-${n}.bin`), history = readFileSync(`${output}/history-${n}.bin`);
	const actual = Array.from({ length: 8 }, (_, i) => Array.from({ length: 4 }, (_, j) => raw.readInt16BE(i * 8 + j * 2)));
	assert.deepEqual(actual, expected, `Motion/scatter mismatch at frame ${n}`);
	actual.forEach((ball, i) => assert.deepEqual([history.readInt16BE(i * 4), history.readInt16BE(i * 4 + 2)], ball.slice(0, 2)));
	assert.ok(reference.compose(actual, n <= 180).equals(readFileSync(`${output}/screen-${n}.bin`)), `Screen mismatch at frame ${n}`);
}
assert.ok(reference.paletteStream(expectedBalls(260), true).equals(readFileSync(`${output}/palettes.bin`)), 'Adaptive row palette stream mismatch');
readFileSync(`${output}/desktop.png`);
for (const [mode, from, to] of [['adaptive palette + background reuse', 20, 80], ['adaptive palette only', 200, 260]]) {
	const elapsed = readFileSync(`${output}/vbl-${to}.bin`).readUInt32BE(0) - readFileSync(`${output}/vbl-${from}.bin`).readUInt32BE(0);
	console.log(`${mode}: ${to - from} complete eight-ball updates / ${elapsed} VBLs = ${((to - from) * 60 / elapsed).toFixed(2)} fps.`);
}
console.log(`Verified eight independent balls, overlaps, runtime scatter, color-mode toggle and desktop cleanup. RAM: ${textSize + dataSize + bssSize} bytes. Results: ${output}`);
