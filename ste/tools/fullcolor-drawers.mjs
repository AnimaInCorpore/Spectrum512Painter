export function rowDrawers(mask) {
	const masks = Buffer.alloc(16 * 32 * 6);
	const lines = ['full_drawers:', ...Array.from({ length: 16 }, (_, s) => `\tdc.l full_row_${s}`)];
	const shift = (op, size, amount, reg) => {
		while (amount > 0) { const n = Math.min(amount, 8); lines.push(`\t${op}.${size} #${n},${reg}`); amount -= n; }
	};
	for (let s = 0; s < 16; s++) {
		for (let y = 0; y < 32; y++) {
			const bits = mask.readUInt32BE(y * 4), words = [bits >>> (16 + s), (bits >>> s) & 65535, s ? (bits << (16 - s)) & 65535 : 0];
			words.forEach((v, group) => masks.writeUInt16BE((~v) & 65535, (s * 32 + y) * 6 + group * 2));
		}
		lines.push(`full_row_${s}:`);
		for (let p = 0; p < 4; p++) {
			lines.push('\tmove.l (a0)+,d0');
			if (s) { lines.push('\tmove.l d0,d1'); shift('lsr', 'l', s, 'd0'); }
			lines.push('\tswap d0', `\tand.w d3,${p * 2}(a1)`, `\tor.w d0,${p * 2}(a1)`, '\tswap d0', `\tand.w d4,${8 + p * 2}(a1)`, `\tor.w d0,${8 + p * 2}(a1)`);
			if (s) { shift('lsl', 'w', 16 - s, 'd1'); lines.push(`\tand.w d5,${16 + p * 2}(a1)`, `\tor.w d1,${16 + p * 2}(a1)`); }
		}
		lines.push('\trts');
	}
	return { masks, code: lines.join('\n') + '\n' };
}
