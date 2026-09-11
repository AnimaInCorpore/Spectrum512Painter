// Exercise a sustained display and the same cleanup path used by Escape.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLimitedAssets } from './verify-limited-assets.mjs';
import { reuseReference } from './verify-background-reuse.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync(process.execPath, ['tools/generate-limited.mjs'], { stdio: 'inherit' });
verifyLimitedAssets();
const vasm = process.env.VASM || resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
execFileSync(vasm, ['limited-demo.s', '-m68000', '-Ftos', '-L', 'limited.lst', '-o', 'LIMITED.PRG'], { stdio: 'inherit' });
const output = mkdtempSync(resolve(tmpdir(), 'ste-limited-'));
const prg = readFileSync('LIMITED.PRG');
const programMemory = prg.readUInt32BE(2) + prg.readUInt32BE(6) + prg.readUInt32BE(10);
if (programMemory > 4 * 1024 * 1024 - 256 * 1024) throw Error('Program leaves insufficient headroom on a 4 MB STE');
const bases = [0, prg.readUInt32BE(2), prg.readUInt32BE(2) + prg.readUInt32BE(6)];
const symbols = [...readFileSync('limited.lst', 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
	.map(([, name, section, offset]) => `${(bases[Number(section)] + parseInt(offset, 16)).toString(16)} T ${name}`);
writeFileSync(`${output}/symbols`, symbols.join('\n') + '\n');
const ini = (name, contents) => writeFileSync(`${output}/${name}.ini`, contents + '\n');
ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
ini('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
ini('start', `symbols ${output}/symbols TEXT\nb VBL = #1000 :trace :once :file ${output}/capture.ini\nb pc = draw_begin :100 :trace :once :file ${output}/profile.ini\nb pc = display_ready :100 :trace :once :file ${output}/cadence-start.ini\nb pc = display_ready :200 :trace :once :file ${output}/cadence-end.ini`);
ini('cadence-start', `savebin ${output}/vbl-start.bin vbl_counter #4`);
ini('cadence-end', `savebin ${output}/vbl-end.bin vbl_counter #4`);
ini('profile', `echo UPDATE_BEGIN\nevaluate CycleCounter\nprofile on\nb pc = draw_done :trace :once :file ${output}/profile-end.ini`);
ini('profile-end', 'echo UPDATE_END\nevaluate CycleCounter\nprofile off\nprofile stats\nprofile cycles 15');
ini('capture', `b pc = display_ready :trace :once :file ${output}/exit.ini`);
ini('exit', `screenshot ${output}/display.png\nsavebin ${output}/screen.bin '(front_screen)' #32000\nsavebin ${output}/palettes.bin '(front_palettes)' #7236\nsavebin ${output}/background-palettes.bin limited_palettes #12060\nsavebin ${output}/position.bin ball_x #4\nsavebin ${output}/frames.bin frame_count #4\nr pc=quit_demo\nb pc = exit_program :trace :once :file ${output}/restored.ini`);
ini('restored', `echo LIMITED_CLEANUP_COMPLETED\nb VBL = 'VBL+100' :trace :once :file ${output}/done.ini`);
ini('done', `screenshot ${output}/desktop.png\nquit`);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on', '--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1', '--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--confirm-quit', 'off', '--run-vbls', '2000', '--parse', `${output}/boot.ini`, resolve('LIMITED.PRG')];
const run = spawnSync(hatari, args, { encoding: 'utf8', timeout: 30000, env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy' } });
const log = (run.stdout || '') + (run.stderr || '');
writeFileSync(`${output}/hatari.log`, log);
if (run.error || run.status !== 0 || /Bus Error|Address Error|Illegal instruction/i.test(log)) {
	throw Error(`Hatari failed; see ${output}/hatari.log`, { cause: run.error });
}
// The screenshots are produced only after the display and cleanup breakpoints.
readFileSync(`${output}/display.png`);
readFileSync(`${output}/desktop.png`);
const position = readFileSync(`${output}/position.bin`);
const x = position.readUInt16BE(0), y = position.readUInt16BE(2);
const frames = readFileSync(`${output}/frames.bin`).readUInt32BE(0);
if (frames < 100 || x > 288 || y < 1 || y > 168) throw Error(`Invalid motion state: ${x},${y}, frames=${frames}`);
const expected = readFileSync('assets/limited-background.bin');
const expectedPalette = readFileSync('assets/limited-background-palettes.bin');
const colors = readFileSync('assets/limited-sprite-palettes.bin');
const indices = reuseReference().choose(x, y);
const mask = readFileSync('../img/sprite-demo/sprite-mask-32x32.bin');
for (let sy = 0; sy < 32; sy++) {
	for (let bank = 0; bank < 3; bank++) colors.copy(expectedPalette, (y + sy - 1) * 96 + bank * 32 + 20, sy * 12, sy * 12 + 12);
	for (let sx = 0; sx < 32; sx++) {
		const i = sy * 32 + sx;
		if (!(mask[i >> 3] & (128 >> (i & 7)))) continue;
		const bit = 0x8000 >> ((x + sx) & 15);
		for (let p = 0; p < 4; p++) {
			const offset = (y + sy) * 160 + ((x + sx) >> 4) * 8 + p * 2;
			expected.writeUInt16BE((expected.readUInt16BE(offset) & ~bit) | ((indices[i] & (1 << p)) ? bit : 0), offset);
		}
	}
}
if (!expected.equals(readFileSync(`${output}/screen.bin`))) throw Error('Moving frame differs from reference (sprite alignment or background restoration)');
const actualPalette = Buffer.alloc(expectedPalette.length);
const bgPalette = readFileSync(`${output}/background-palettes.bin`), spritePalette = readFileSync(`${output}/palettes.bin`);
for (let row = 0; row < 201; row++) for (let bank = 0; bank < 3; bank++) {
	bgPalette.copy(actualPalette, row * 96 + bank * 32, row * 60 + bank * 20, row * 60 + bank * 20 + 20);
	spritePalette.copy(actualPalette, row * 96 + bank * 32 + 20, row * 36 + bank * 12, row * 36 + bank * 12 + 12);
}
if (!expectedPalette.equals(actualPalette)) throw Error('Palette stream differs from 10+6 reference');
const elapsedVbl = readFileSync(`${output}/vbl-end.bin`).readUInt32BE(0) - readFileSync(`${output}/vbl-start.bin`).readUInt32BE(0);
if (elapsedVbl !== 200) throw Error(`Expected 100 updates in 200 VBLs, got ${elapsedVbl} VBLs`);
console.log(`Cadence: 100 presented updates in ${elapsedVbl} VBLs = ${(6000 / elapsedVbl).toFixed(1)} fps at 60 Hz.`);
console.log(`Verified frame ${frames} at (${x}, ${y}): exact screen and palette match.`);
console.log(`Display and cleanup completed. Screenshots: ${output}`);
