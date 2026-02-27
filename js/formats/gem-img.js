function readWordBE(bytes, offset) {
	return (bytes[offset] << 8) | bytes[offset + 1];
}

function hasVerticalReplicationMarker(bytes, offset) {
	return (
		offset + 3 < bytes.length &&
		bytes[offset] === 0x00 &&
		bytes[offset + 1] === 0x00 &&
		bytes[offset + 2] === 0xff
	);
}

function decodeScanlineRle(bytes, offset, expectedLength, patternLength) {
	const output = new Uint8Array(expectedLength);
	let outPos = 0;
	let pos = offset;

	while (outPos < expectedLength) {
		if (pos >= bytes.length) {
			throw new Error('Unexpected end of IMG stream while decoding scanline.');
		}

		const code = bytes[pos++];
		if (code === 0x80) {
			if (pos >= bytes.length) {
				throw new Error('Malformed IMG bit-string item.');
			}
			const count = bytes[pos++];
			if (pos + count > bytes.length) {
				throw new Error('IMG bit-string exceeds file size.');
			}
			const writeCount = Math.min(count, expectedLength - outPos);
			output.set(bytes.subarray(pos, pos + writeCount), outPos);
			outPos += writeCount;
			pos += count;
			continue;
		}

		if (code === 0x00) {
			if (pos >= bytes.length) {
				throw new Error('Malformed IMG pattern-run item.');
			}
			const runLength = bytes[pos++];
			if (patternLength <= 0 || pos + patternLength > bytes.length) {
				throw new Error('Invalid IMG pattern definition.');
			}
			const pattern = bytes.subarray(pos, pos + patternLength);
			pos += patternLength;
			for (let i = 0; i < runLength && outPos < expectedLength; i += 1) {
				const writeLen = Math.min(patternLength, expectedLength - outPos);
				output.set(pattern.subarray(0, writeLen), outPos);
				outPos += writeLen;
			}
			continue;
		}

		const isBlack = (code & 0x80) !== 0;
		const runBytes = code & 0x7f;
		const value = isBlack ? 0xff : 0x00;
		for (let i = 0; i < runBytes && outPos < expectedLength; i += 1) {
			output[outPos++] = value;
		}
	}

	return { data: output, nextOffset: pos };
}

function buildDefaultPalette(planes) {
	const colorCount = 1 << Math.min(planes, 8);
	const palette = new Array(colorCount);
	if (planes === 1) {
		palette[0] = [255, 255, 255];
		palette[1] = [0, 0, 0];
		return palette;
	}

	// Classic GEM/VDI 16-color default palette (Atari ST style).
	const gem16 = [
		[255, 255, 255], // 0 white
		[255, 0, 0],     // 1 red
		[0, 255, 0],     // 2 green
		[255, 255, 0],   // 3 yellow
		[0, 0, 255],     // 4 blue
		[255, 0, 255],   // 5 magenta
		[0, 255, 255],   // 6 cyan
		[170, 170, 170], // 7 light gray
		[85, 85, 85],    // 8 dark gray
		[255, 170, 170], // 9 light red
		[170, 255, 170], // 10 light green
		[255, 255, 170], // 11 light yellow
		[170, 170, 255], // 12 light blue
		[255, 170, 255], // 13 light magenta
		[170, 255, 255], // 14 light cyan
		[0, 0, 0]        // 15 black
	];
	if (planes <= 4) {
		for (let i = 0; i < colorCount; i += 1) {
			palette[i] = gem16[i % gem16.length];
		}
		return palette;
	}

	for (let i = 0; i < colorCount; i += 1) {
		const value = Math.round((i / Math.max(1, colorCount - 1)) * 255);
		palette[i] = [value, value, value];
	}
	return palette;
}

function componentFromPlaneGroup(rowData, bytesPerPlane, x, planeStart, planeCount) {
	let value = 0;
	const byteOffset = x >> 3;
	const bitMask = 1 << (7 - (x & 7));
	for (let bit = 0; bit < planeCount; bit += 1) {
		const planeByte = rowData[(planeStart + bit) * bytesPerPlane + byteOffset];
		if ((planeByte & bitMask) !== 0) {
			// True-color pseudo-plane groups are documented in component order (RRRRR GGGGGG BBBBB / RRRRRRRR GGGGGGGG BBBBBBBB).
			// Interpret each group from most-significant bit to least-significant bit.
			value |= (1 << ((planeCount - 1) - bit));
		}
	}
	return value;
}

function scaleComponentTo8(value, bits) {
	const max = (1 << bits) - 1;
	return Math.round((value / max) * 255);
}

function rasterizeTrueColorRow(rowData, width, bytesPerPlane, planes, imageData, rowIndex) {
	const has565 = planes === 16;
	const redBits = has565 ? 5 : 8;
	const greenBits = has565 ? 6 : 8;
	const blueBits = has565 ? 5 : 8;

	const redStart = 0;
	const greenStart = redStart + redBits;
	const blueStart = greenStart + greenBits;

	for (let x = 0; x < width; x += 1) {
		const r = componentFromPlaneGroup(rowData, bytesPerPlane, x, redStart, redBits);
		const g = componentFromPlaneGroup(rowData, bytesPerPlane, x, greenStart, greenBits);
		const b = componentFromPlaneGroup(rowData, bytesPerPlane, x, blueStart, blueBits);

		const dst = ((rowIndex * width) + x) * 4;
		imageData[dst] = scaleComponentTo8(r, redBits);
		imageData[dst + 1] = scaleComponentTo8(g, greenBits);
		imageData[dst + 2] = scaleComponentTo8(b, blueBits);
		imageData[dst + 3] = 255;
	}
}

function tryReadXimgPalette(bytes, headerWords, planes) {
	const colorCount = 1 << Math.min(planes, 8);
	if (headerWords < 11 || planes <= 1 || planes > 8) {
		return null;
	}

	const signatureOffset = 8 * 2;
	if (signatureOffset + 3 >= bytes.length) {
		return null;
	}
	const signature =
		String.fromCharCode(bytes[signatureOffset]) +
		String.fromCharCode(bytes[signatureOffset + 1]) +
		String.fromCharCode(bytes[signatureOffset + 2]) +
		String.fromCharCode(bytes[signatureOffset + 3]);
	if (signature !== 'XIMG') {
		return null;
	}

	const paletteStart = 11 * 2;
	const wordsRequired = 11 + colorCount * 3;
	if (headerWords < wordsRequired) {
		return null;
	}
	if (paletteStart + colorCount * 6 > bytes.length) {
		return null;
	}

	const palette = new Array(colorCount);
	let pos = paletteStart;
	for (let i = 0; i < colorCount; i += 1) {
		const r = readWordBE(bytes, pos); pos += 2;
		const g = readWordBE(bytes, pos); pos += 2;
		const b = readWordBE(bytes, pos); pos += 2;
		palette[i] = [
			Math.max(0, Math.min(255, Math.round((r / 1000) * 255))),
			Math.max(0, Math.min(255, Math.round((g / 1000) * 255))),
			Math.max(0, Math.min(255, Math.round((b / 1000) * 255)))
		];
	}
	return palette;
}

function rasterizePlanarRow(rowData, width, planes, palette, imageData, rowIndex) {
	const bytesPerPlane = Math.ceil(width / 8);
	for (let x = 0; x < width; x += 1) {
		let colorIndex = 0;
		const byteOffset = x >> 3;
		const bitMask = 1 << (7 - (x & 7));
		for (let plane = 0; plane < planes; plane += 1) {
			const planeByte = rowData[plane * bytesPerPlane + byteOffset];
			if ((planeByte & bitMask) !== 0) {
				colorIndex |= (1 << plane);
			}
		}
		const color = palette[colorIndex] || [0, 0, 0];
		const dst = ((rowIndex * width) + x) * 4;
		imageData[dst] = color[0];
		imageData[dst + 1] = color[1];
		imageData[dst + 2] = color[2];
		imageData[dst + 3] = 255;
	}
}

export function decodeGemImg(arrayBuffer) {
	const bytes = new Uint8Array(arrayBuffer);
	if (bytes.length < 16) {
		throw new Error('File too small to be a GEM IMG.');
	}

	const version = readWordBE(bytes, 0);
	const headerWords = readWordBE(bytes, 2);
	const planes = readWordBE(bytes, 4);
	const patternLength = readWordBE(bytes, 6);
	const width = readWordBE(bytes, 12);
	const height = readWordBE(bytes, 14);

	if (version !== 1) {
		throw new Error(`Unsupported IMG version: ${version}`);
	}
	if (headerWords < 8) {
		throw new Error('Invalid IMG header length.');
	}
	if (width <= 0 || height <= 0) {
		throw new Error('Invalid IMG dimensions.');
	}
	const isIndexed = planes >= 1 && planes <= 8;
	const isTrueColor = planes === 16 || planes === 24;
	if (!isIndexed && !isTrueColor) {
		throw new Error(`Unsupported IMG plane count: ${planes}`);
	}

	const headerBytes = headerWords * 2;
	if (headerBytes > bytes.length) {
		throw new Error('IMG header exceeds file size.');
	}

	const bytesPerPlane = Math.ceil(width / 8);
	const scanlineLength = bytesPerPlane * planes;
	const palette = isIndexed
		? (tryReadXimgPalette(bytes, headerWords, planes) || buildDefaultPalette(planes))
		: null;

	const rgba = new Uint8ClampedArray(width * height * 4);
	let pos = headerBytes;
	let y = 0;

	while (y < height) {
		let repeatCount = 1;
		if (hasVerticalReplicationMarker(bytes, pos)) {
			repeatCount = bytes[pos + 3] || 1;
			pos += 4;
		}

		const decoded = decodeScanlineRle(bytes, pos, scanlineLength, patternLength);
		pos = decoded.nextOffset;

		const maxRepeat = Math.min(repeatCount, height - y);
		for (let r = 0; r < maxRepeat; r += 1) {
			if (isIndexed) {
				rasterizePlanarRow(decoded.data, width, planes, palette, rgba, y);
			} else {
				rasterizeTrueColorRow(decoded.data, width, bytesPerPlane, planes, rgba, y);
			}
			y += 1;
		}
	}

	return {
		width,
		height,
		pixels: rgba
	};
}
