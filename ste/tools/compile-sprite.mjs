// Emit 68000 blitters specialized to each alignment, mask and color word.
export function compileSprite(shifted) {
	const lines = ['sprite_drawers:'];
	for (let shift = 0; shift < 16; shift++) lines.push(`\tdc.l sprite_draw_${shift}`);
	for (let shift = 0; shift < 16; shift++) {
		lines.push(`sprite_draw_${shift}:`);
		for (let y = 0; y < 32; y++) for (let group = 0; group < 3; group++) {
			const source = shift * 960 + y * 30 + group * 10;
			const mask = shifted.readUInt16BE(source);
			if (mask === 0xffff) continue;
			for (let pair = 0; pair < 2; pair++) {
				const target = `${y * 160 + group * 8 + pair * 4}(a1)`;
				const bits = shifted.readUInt32BE(source + 2 + pair * 4);
				if (!mask) lines.push(`\tmove.l #$${bits.toString(16)},${target}`);
				else {
					lines.push(`\tandi.l #$${(mask * 65537).toString(16)},${target}`);
					if (bits) lines.push(`\tori.l #$${bits.toString(16)},${target}`);
				}
			}
		}
		lines.push('\trts');
	}
	return lines.join('\n') + '\n';
}
