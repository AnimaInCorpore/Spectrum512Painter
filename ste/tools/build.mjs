import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
execFileSync(process.execPath, ['tools/generate.mjs'], { stdio: 'inherit' });
const sibling = resolve('../../F030Arcade/third_party/vasm/vasmm68k_mot');
const vasm = process.env.VASM || (existsSync(sibling) ? sibling : 'vasmm68k_mot');
execFileSync(vasm, ['main.s', '-m68000', '-Ftos', '-L', 'program.lst', '-o', 'SPECTSPR.PRG'], { stdio: 'inherit' });
const prg = readFileSync('SPECTSPR.PRG');
const textSize = prg.readUInt32BE(2), dataSize = prg.readUInt32BE(6);
const sections = [0, textSize, textSize + dataSize];
const symbols = [...readFileSync('program.lst', 'utf8').matchAll(/^(\w+)\s+(0[012]):([0-9A-F]{8})\s*$/gm)]
	.map(([, name, section, offset]) => `${(sections[Number(section)] + parseInt(offset, 16)).toString(16)} T ${name}`);
writeFileSync('program.sym', symbols.join('\n') + '\n');
console.log(`Built ${prg.length} byte TOS program and ${symbols.length} debugger symbols.`);
