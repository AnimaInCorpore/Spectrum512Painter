// Whole-bitmap transforms. Each takes { width, height, pixels } and returns a new state.

function mapPixels(state, mapIndex) {
	const { width, height, pixels } = state;
	const out = new Uint8ClampedArray(pixels.length);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const src = mapIndex(x, y, width, height) * 4;
			const dst = (y * width + x) * 4;
			out[dst] = pixels[src];
			out[dst + 1] = pixels[src + 1];
			out[dst + 2] = pixels[src + 2];
			out[dst + 3] = pixels[src + 3];
		}
	}
	return { width, height, pixels: out };
}

export function flipHorizontal(state) {
	return mapPixels(state, (x, y, w) => y * w + (w - 1 - x));
}

export function flipVertical(state) {
	return mapPixels(state, (x, y, w, h) => (h - 1 - y) * w + x);
}

export function invertColors(state) {
	const pixels = new Uint8ClampedArray(state.pixels);
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = 255 - pixels[i];
		pixels[i + 1] = 255 - pixels[i + 1];
		pixels[i + 2] = 255 - pixels[i + 2];
	}
	return { width: state.width, height: state.height, pixels };
}

export function clearToWhite(state) {
	return { width: state.width, height: state.height, pixels: new Uint8ClampedArray(state.pixels.length).fill(255) };
}

// Applies a whole-bitmap transform to just the pixels inside rect.
export function restrictToRect(transform, rect) {
	return state => {
		if (!rect) {
			return transform(state);
		}
		const sub = new Uint8ClampedArray(rect.width * rect.height * 4);
		for (let y = 0; y < rect.height; y += 1) {
			const from = ((rect.y + y) * state.width + rect.x) * 4;
			sub.set(state.pixels.subarray(from, from + rect.width * 4), y * rect.width * 4);
		}
		const changed = transform({ width: rect.width, height: rect.height, pixels: sub });
		const pixels = new Uint8ClampedArray(state.pixels);
		for (let y = 0; y < rect.height; y += 1) {
			const to = ((rect.y + y) * state.width + rect.x) * 4;
			pixels.set(changed.pixels.subarray(y * rect.width * 4, (y + 1) * rect.width * 4), to);
		}
		return { width: state.width, height: state.height, pixels };
	};
}
