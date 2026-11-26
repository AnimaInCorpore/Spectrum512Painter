// Records a program in Hatari (8 MHz STE, cycle exact) as MP4: from 2 seconds after it was loaded, SECONDS (10)
// seconds of every 60 Hz frame. Hatari records from power-on (its debugger cannot start the recording), so ffmpeg
// cuts the video at the VBL that the log names, and doubles the pixels without smoothing.
// node tools/record-blit.mjs <PROGRAM.PRG> <video.mp4>
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const [program, video] = process.argv.slice(2).map(path => resolve(path));
if (!program || !video) throw Error('node tools/record-blit.mjs <PROGRAM.PRG> <video.mp4>');
const seconds = Number(process.env.SECONDS || 10);
const hatari = process.env.HATARI || resolve('../../F030Arcade/third_party/hatari/build/src/hatari');
const tos = process.env.TOS || resolve('../../F030Arcade/third_party/tos/tos206de.img');
const work = resolve('verification-record');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const ini = (name, text) => writeFileSync(`${work}/${name}.ini`, text + '\n');
ini('boot', `b GemdosOpcode = 0x4b && OsCallParam = 0 :trace :once :file ${work}/loaded.ini`);
ini('loaded', `b VBL = 'VBL+120' :trace :once :file ${work}/start.ini`);
ini('start', `echo RECORD_START\nevaluate VBL\nb VBL = 'VBL+${seconds * 60}' :trace :once :file ${work}/stop.ini`);
ini('stop', 'quit');
const run = spawnSync(hatari, ['--tos', tos, '--machine', 'ste', '--memsize', '4', '--cpulevel', '0', '--cpuclock', '8', '--cpu-exact', 'on',
	'--compatible', 'on', '--sound', 'off', '--fast-forward', 'off', '--fast-boot', 'on', '--frameskips', '0', '--spec512', '1',
	'--borders', 'off', '--statusbar', 'off', '--drive-led', 'off', '--zoom', '1', '--confirm-quit', 'off',
	'--avirecord', 'on', '--avi-vcodec', 'png', '--avi-fps', '60', '--avi-file', `${work}/record.avi`, '--run-vbls', String(seconds * 60 + 6000),
	'--parse', `${work}/boot.ini`, program],
	{ env: { ...process.env, SDL_VIDEODRIVER: 'dummy', SDL_AUDIODRIVER: 'dummy', SDL_RENDER_DRIVER: 'software' }, encoding: 'utf8', maxBuffer: 1 << 26 });
const log = run.stdout + run.stderr; // the debugger writes to stderr
writeFileSync(`${work}/hatari.log`, log);
const start = Number(log.match(/RECORD_START> evaluate VBL\n= [^\n]*#(\d+) \(dec\)/)[1]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start / 60), '-i', `${work}/record.avi`, '-t', String(seconds), '-vf', 'scale=iw*2:ih*2:flags=neighbor',
	'-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', video], { stdio: 'inherit' });
console.log(`${video} written`);
