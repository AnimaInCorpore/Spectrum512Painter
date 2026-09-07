import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.argv[2] || 'verification');
const quality = process.env.QUALITY === '1';
mkdirSync(output, { recursive: true });
const write = (name, text) => writeFileSync(`${output}/${name}.ini`, text + '\n');
write('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${output}/loaded.ini`);
write('loaded', `b pc = TEXT :trace :once :file ${output}/start.ini`);
const markerBreakpoints = quality
	? `b pc = draw_begin :trace :once :file ${output}/begin.ini\nb pc = composite_done :trace :once :file ${output}/composite.ini\nb pc = draw_done :trace :once :file ${output}/done.ini`
	: `b pc = draw_begin :trace :once :file ${output}/begin.ini\nb pc = draw_done :trace :once :file ${output}/done.ini`;
write('start', `symbols ${resolve('program.sym')} TEXT\n${markerBreakpoints}`);
write('begin', `echo DRAW_BEGIN\nevaluate CycleCounter\nw quality_mode $${quality ? '1' : '0'}\n${process.env.RAW ? 'w spectrum_vbl $4e $75\nprofile on\n' : ''}${quality ? `b VBL = 'VBL+1200' :trace :once :file ${output}/progress.ini` : ''}`);
write('progress', `echo PROGRESS\nevaluate (current_x).w\nevaluate (current_y).w\nscreenshot ${output}/progress.png`);
write('composite', 'echo COMPOSITE_DONE\nevaluate CycleCounter');
write('done', `echo DRAW_DONE\nevaluate CycleCounter\n${process.env.RAW ? 'profile off\nprofile stats\nprofile cycles 12\n' : ''}savebin ${output}/screen.bin '(back_screen)' #32000\nsavebin ${output}/palettes.bin '(back_palettes)' #19104\nb VBL = 'VBL+4' :trace :once :file ${output}/capture.ini`);
write('capture', `screenshot ${output}/screen.png\nquit`);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const args = ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on', '--compatible', 'on', '--sound', 'off', '--fast-forward', 'on', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1', '--borders', 'off', '--statusbar', 'off', '--zoom', '1', '--confirm-quit', 'off', '--run-vbls', '20000', '--parse', `${output}/boot.ini`, resolve('SPECTSPR.PRG')];
const processHandle = spawn(hatari, args, { env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy', SDL_RENDER_DRIVER: 'software' } });
let log = '';
for (const stream of [processHandle.stdout, processHandle.stderr]) stream.on('data', data => { log += data; process.stdout.write(data); });
processHandle.on('close', code => {
	writeFileSync(`${output}/hatari.log`, log);
	if (code) { process.exitCode = code; return; }
	const expectedPrefix = quality ? 'reference' : 'fast';
	const expectedFiles = quality
		? [['screen.bin', 'reference-screen.bin'], ['palettes.bin', 'reference-palettes.bin']]
		: [['screen.bin', 'fast-screen.bin'], ['palettes.bin', 'background-palettes.bin']];
	for (const [actual, expected] of expectedFiles) {
		const a = readFileSync(`${output}/${actual}`), b = readFileSync(`assets/${expected}`);
		let differences = 0;
		for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) differences++;
		console.log(`${actual}: ${differences} byte differences against ${expectedPrefix} reference`);
		if (differences || a.length !== b.length) process.exitCode = 1;
	}
});
