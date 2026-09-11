import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coloredReference, coloredPositions, verifyColoredBlitters } from './colored-reference.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync(process.execPath, ['tools/generate-colored.mjs'], { stdio: 'inherit' });
const reference = coloredReference();
verifyColoredBlitters(reference);
const output = mkdtempSync(resolve(tmpdir(), 'ste-colored-'));
const vasm = process.env.VASM || resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
execFileSync(vasm, ['colored-demo.s', '-m68000', '-Ftos', '-L', 'colored.lst', '-o', 'COLORED.PRG'], { stdio: 'inherit' });
for (const [source, binary] of [['eight-demo.s', 'EIGHT.PRG'], ['eight-raw-demo.s', 'EIGHT-RAW.PRG'], ['limited-demo.s', 'LIMITED.PRG']]) {
	execFileSync(vasm, [source, '-m68000', '-Ftos', '-o', `${output}/${binary}`], { stdio: 'pipe' });
	assert.ok(readFileSync(binary).equals(readFileSync(`${output}/${binary}`)), `${binary} regression: executable changed`);
}
const prg = readFileSync('COLORED.PRG');
const text = prg.readUInt32BE(2), data = prg.readUInt32BE(6), bss = prg.readUInt32BE(10), bases = [0, text, text + data];
const symbols = [...readFileSync('colored.lst', 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
	.map(([, name, section, offset]) => `${(bases[Number(section)] + parseInt(offset, 16)).toString(16)} T ${name}`);
writeFileSync(`${output}/symbols`, symbols.join('\n') + '\n');
const ini = (name, commands) => writeFileSync(`${output}/${name}.ini`, commands + '\n');
ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
ini('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
const frames = [1, 20, 30, 80, 100, 101, 160];
ini('start', `symbols ${output}/symbols TEXT\n` + frames.map(n => `b pc = display_ready ${n > 1 ? `:${n} ` : ''}:trace :once :file ${output}/frame-${n}.ini`).join('\n') + `\nb pc = input_done :100 :trace :once :file ${output}/scatter.ini`);
ini('scatter', 'r pc=scatter_now');
for (const n of frames) {
	const commands = [`savebin ${output}/vbl-${n}.bin vbl_counter #4`, `savebin ${output}/screen-${n}.bin '(front_screen)' #32000`, `savebin ${output}/balls-${n}.bin balls #64`, `savebin ${output}/history-${n}.bin '(front_positions)' #32`];
	if (n === 30 || n === 160) commands.push(`screenshot ${output}/display-${n}.png`);
	if (n === 160) commands.push(`savebin ${output}/palettes.bin '(front_palettes)' #7272`, 'r pc=quit_demo', `b pc = exit_program :trace :once :file ${output}/restored.ini`);
	ini(`frame-${n}`, commands.join('\n'));
}
ini('restored', `echo COLORED_CLEANUP_COMPLETED\nb VBL = 'VBL+100' :trace :once :file ${output}/done.ini`);
ini('done', `screenshot ${output}/desktop.png\nquit`);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on', '--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1', '--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--crt', 'off', '--confirm-quit', 'off', '--run-vbls', '5000', '--parse', `${output}/boot.ini`, resolve('COLORED.PRG')];
const run = spawnSync(hatari, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' } });
const log = (run.stdout || '') + (run.stderr || '');
writeFileSync(`${output}/hatari.log`, log);
assert.ok(!run.error && run.status === 0 && !/Bus Error|Address Error|Illegal instruction|ERROR:/i.test(log), `Hatari failed: ${output}/hatari.log`);
assert.ok(log.includes('COLORED_CLEANUP_COMPLETED'), 'Demo did not finish / exit');
for (const n of frames) {
	const balls = coloredPositions(n), raw = readFileSync(`${output}/balls-${n}.bin`), history = readFileSync(`${output}/history-${n}.bin`);
	const actual = Array.from({ length: 8 }, (_, i) => Array.from({ length: 4 }, (_, j) => raw.readInt16BE(i * 8 + j * 2)));
	assert.deepEqual(actual, balls, `Motion/scatter mismatch at frame ${n}`);
	actual.forEach((ball, i) => assert.deepEqual([history.readInt16BE(i * 4), history.readInt16BE(i * 4 + 2)], ball.slice(0, 2)));
	assert.ok(reference.compose(balls).equals(readFileSync(`${output}/screen-${n}.bin`)), `Screen mismatch at frame ${n}`);
}
assert.ok(readFileSync('assets/colored-sprite-stream.bin').equals(readFileSync(`${output}/palettes.bin`)), 'Palette stream mismatch');
const vbl = n => readFileSync(`${output}/vbl-${n}.bin`).readUInt32BE(0);
console.log(`Colored balls: 60 updates / ${vbl(80) - vbl(20)} VBLs = ${(3600 / (vbl(80) - vbl(20))).toFixed(2)} fps. RAM: ${text + data + bss} bytes.`);
console.log(`Verified pixels, palettes, motion, scatter, overlap restoration and desktop cleanup. All three original binaries unchanged. Results: ${output}`);
