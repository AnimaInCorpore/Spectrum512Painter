// Specialize the common double-buffer motion deltas. Other moves retain the
// general restore path, so arbitrary positioning remains supported.
export function compileRestores(mask) {
	const opaque = (x, y) => x >= 0 && x < 32 && y >= 0 && y < 32 && (mask[(y * 32 + x) >> 3] & (128 >> (x & 7)));
	const labels = [], bodies = [];
	for (const dx of [-6, 0, 6]) for (const dy of [-4, 0, 4]) for (let shift = 0; shift < 16; shift++) {
		const label = `restore_overlap_${labels.length}`;
		labels.push(label);
		bodies.push(`${label}:`);
		for (let y = 0; y < 32; y++) for (let group = 0; group < (shift ? 3 : 2); group++) {
			let needed = false;
			for (let bit = 0; bit < 16; bit++) {
				const x = group * 16 + bit - shift;
				if (opaque(x, y) && !opaque(x - dx, y - dy)) needed = true;
			}
			if (!needed) continue;
			for (let pair = 0; pair < 2; pair++) {
				const offset = y * 160 + group * 8 + pair * 4;
				bodies.push(`\tmove.l ${offset}(a0),${offset}(a1)`);
			}
		}
		bodies.push('\trts');
	}
	return ['overlap_restorers:', ...labels.map(label => `\tdc.l ${label}`), ...bodies].join('\n') + '\n';
}
