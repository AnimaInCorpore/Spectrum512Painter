import { createSpectrumCanvas, SPECTRUM_CANVAS_HEIGHT, SPECTRUM_CANVAS_WIDTH } from '../imaging/spectrum.js';
import {
	computeSpectrum512LineColorSlots,
	convertSpectrum512Lines,
	getSpectrum512ColorSlotIndex
} from '../imaging/spectrum512.js';

const SPU_GRAPHICS_BYTES = (SPECTRUM_CANVAS_WIDTH * SPECTRUM_CANVAS_HEIGHT) / 2;
const SPU_PALETTE_BYTES = 48 * 2 * (SPECTRUM_CANVAS_HEIGHT - 1);
const SPU_TOTAL_BYTES = SPU_GRAPHICS_BYTES + SPU_PALETTE_BYTES;
const SPU_ACTIVE_HEIGHT = SPECTRUM_CANVAS_HEIGHT - 1;

function createCanvasClone(sourceCanvas) {
	const canvas = document.createElement('canvas');
	canvas.width = sourceCanvas.width;
	canvas.height = sourceCanvas.height;
	canvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
	return canvas;
}

function createNormalizedSpuSource(sourceCanvas) {
	if (sourceCanvas.width === SPECTRUM_CANVAS_WIDTH && sourceCanvas.height === SPECTRUM_CANVAS_HEIGHT) {
		return createCanvasClone(sourceCanvas);
	}

	// SPU files typically carry visible content on raster lines 1..199.
	if (sourceCanvas.width === SPECTRUM_CANVAS_WIDTH && sourceCanvas.height === SPU_ACTIVE_HEIGHT) {
		const canvas = document.createElement('canvas');
		canvas.width = SPECTRUM_CANVAS_WIDTH;
		canvas.height = SPECTRUM_CANVAS_HEIGHT;
		const context = canvas.getContext('2d');
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(sourceCanvas, 0, 1);
		return canvas;
	}

	return createSpectrumCanvas(sourceCanvas);
}

function findPixelColorIndex(x, slots, red, green, blue) {
	for (let colorIndex = 0; colorIndex < 16; colorIndex += 1) {
		const slot = slots[getSpectrum512ColorSlotIndex(x, colorIndex)];
		if (slot.red === red && slot.green === green && slot.blue === blue) {
			return colorIndex;
		}
	}
	return 0;
}

function writeBitplanes(data, imageData, lineSlots) {
	const width = SPECTRUM_CANVAS_WIDTH;

	for (let y = 1; y < SPECTRUM_CANVAS_HEIGHT; y += 1) {
		const slots = lineSlots[y] || [];
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = (x + y * width) * 4;
			const red = imageData[pixelIndex];
			const green = imageData[pixelIndex + 1];
			const blue = imageData[pixelIndex + 2];
			const colorIndex = findPixelColorIndex(x, slots, red, green, blue);

			const wordDataIndex = (x >> 4) * 8 + y * width / 2;
			const bitIndex = x & 0x0f;

			for (let planeIndex = 0; planeIndex < 4; planeIndex += 1) {
				const byteOffset = wordDataIndex + planeIndex * 2;
				let word = (data[byteOffset] << 8) | data[byteOffset + 1];
				if (colorIndex & (1 << planeIndex)) {
					word |= 1 << (15 - bitIndex);
				}
				data[byteOffset] = (word >> 8) & 0xff;
				data[byteOffset + 1] = word & 0xff;
			}
		}
	}
}

function packSpuColorWord(color, bitsPerColor) {
	const mask = bitsPerColor === 3 ? 0xe0 : 0xf0;
	let word = ((color.red & mask) << 4) | (color.green & mask) | ((color.blue & mask) >> 4);
	word = ((word & 0x111) << 3) | ((word & 0xeee) >> 1);
	if (bitsPerColor === 5) {
		word += ((color.red & 0x08) << 12) | ((color.green & 0x08) << 11) | ((color.blue & 0x08) << 10);
	}
	return word;
}

function writePalettes(data, lineSlots, bitsPerColor) {
	let offset = SPU_GRAPHICS_BYTES;

	for (let y = 1; y < SPECTRUM_CANVAS_HEIGHT; y += 1) {
		const slots = lineSlots[y] || [];
		for (let slotIndex = 0; slotIndex < 48; slotIndex += 1) {
			const color = slots[slotIndex] || { red: 0, green: 0, blue: 0 };
			const word = packSpuColorWord(color, bitsPerColor);
			data[offset++] = (word >> 8) & 0xff;
			data[offset++] = word & 0xff;
		}
	}
}

function inferBitsPerColor(data, paletteOffset) {
	if (data[0] === 0x35 && data[1] === 0x42 && data[2] === 0x49 && data[3] === 0x54) {
		return 5;
	}

	let allEvenNibbles = true;
	for (let i = paletteOffset; i < data.length; i += 2) {
		const word = (data[i] << 8) | data[i + 1];
		const unpacked = unpackSpuColorWord(word, 4);
		if ((unpacked.redNibble & 1) !== 0 || (unpacked.greenNibble & 1) !== 0 || (unpacked.blueNibble & 1) !== 0) {
			allEvenNibbles = false;
			break;
		}
	}
	return allEvenNibbles ? 3 : 4;
}

function unpackWordColorBits(word) {
	let packed = 0;
	for (let bit = 0; bit <= 11; bit += 1) {
		const sourceBit = (bit % 4 === 0) ? bit + 3 : bit - 1;
		packed |= ((word >> sourceBit) & 1) << bit;
	}
	return packed;
}

function unpackSpuColorWord(word, bitsPerColor) {
	const packed = unpackWordColorBits(word);
	const redNibble = (packed >> 8) & 0x0f;
	const greenNibble = (packed >> 4) & 0x0f;
	const blueNibble = packed & 0x0f;

	if (bitsPerColor === 5) {
		const red5 = (redNibble << 1) | ((word >> 15) & 1);
		const green5 = (greenNibble << 1) | ((word >> 14) & 1);
		const blue5 = (blueNibble << 1) | ((word >> 13) & 1);
		return {
			red: Math.round((red5 * 255) / 31),
			green: Math.round((green5 * 255) / 31),
			blue: Math.round((blue5 * 255) / 31),
			redNibble,
			greenNibble,
			blueNibble
		};
	}

	if (bitsPerColor === 3) {
		return {
			red: Math.round(((redNibble >> 1) * 255) / 7),
			green: Math.round(((greenNibble >> 1) * 255) / 7),
			blue: Math.round(((blueNibble >> 1) * 255) / 7),
			redNibble,
			greenNibble,
			blueNibble
		};
	}

	return {
		red: Math.round((redNibble * 255) / 15),
		green: Math.round((greenNibble * 255) / 15),
		blue: Math.round((blueNibble * 255) / 15),
		redNibble,
		greenNibble,
		blueNibble
	};
}

function decodePalettes(data, bitsPerColor) {
	const lineSlots = new Array(SPECTRUM_CANVAS_HEIGHT);
	lineSlots[0] = new Array(48).fill(null).map(() => ({ red: 0, green: 0, blue: 0 }));

	let offset = SPU_GRAPHICS_BYTES;
	for (let y = 1; y < SPECTRUM_CANVAS_HEIGHT; y += 1) {
		const slots = new Array(48);
		for (let slotIndex = 0; slotIndex < 48; slotIndex += 1) {
			const word = (data[offset] << 8) | data[offset + 1];
			offset += 2;
			const color = unpackSpuColorWord(word, bitsPerColor);
			slots[slotIndex] = { red: color.red, green: color.green, blue: color.blue };
		}
		lineSlots[y] = slots;
	}

	return lineSlots;
}

function decodeColorIndex(data, x, y) {
	const wordDataIndex = (x >> 4) * 8 + y * SPECTRUM_CANVAS_WIDTH / 2;
	const bitIndex = x & 0x0f;
	let colorIndex = 0;

	for (let planeIndex = 0; planeIndex < 4; planeIndex += 1) {
		const byteOffset = wordDataIndex + planeIndex * 2;
		const word = (data[byteOffset] << 8) | data[byteOffset + 1];
		const bit = (word >> (15 - bitIndex)) & 1;
		colorIndex |= bit << planeIndex;
	}

	return colorIndex;
}

export function decodeSpectrumSpu(arrayBuffer) {
	const data = new Uint8Array(arrayBuffer);
	if (data.length !== SPU_TOTAL_BYTES) {
		throw new Error(`Invalid SPU size. Expected ${SPU_TOTAL_BYTES} bytes, got ${data.length}.`);
	}

	const bitsPerColor = inferBitsPerColor(data, SPU_GRAPHICS_BYTES);
	const lineSlots = decodePalettes(data, bitsPerColor);
	const pixels = new Uint8ClampedArray(SPECTRUM_CANVAS_WIDTH * SPU_ACTIVE_HEIGHT * 4);

	for (let y = 1; y < SPECTRUM_CANVAS_HEIGHT; y += 1) {
		const slots = lineSlots[y] || lineSlots[1] || lineSlots[0];
		const outputY = y - 1;
		for (let x = 0; x < SPECTRUM_CANVAS_WIDTH; x += 1) {
			const colorIndex = decodeColorIndex(data, x, y);
			const slotIndex = getSpectrum512ColorSlotIndex(x, colorIndex);
			const color = slots[slotIndex] || { red: 0, green: 0, blue: 0 };
			const pixelIndex = (x + outputY * SPECTRUM_CANVAS_WIDTH) * 4;
			pixels[pixelIndex] = color.red;
			pixels[pixelIndex + 1] = color.green;
			pixels[pixelIndex + 2] = color.blue;
			pixels[pixelIndex + 3] = 255;
		}
	}

	return {
		width: SPECTRUM_CANVAS_WIDTH,
		height: SPU_ACTIVE_HEIGHT,
		pixels,
		bitsPerColor
	};
}

export function encodeSpectrumSpu({ sourceCanvas, bitsPerColor = 4, ditherPattern = null }) {
	if (!sourceCanvas) {
		throw new Error('No source canvas available for SPU encoding.');
	}

	const spectrumSource = createNormalizedSpuSource(sourceCanvas);
	if (spectrumSource.width !== SPECTRUM_CANVAS_WIDTH || spectrumSource.height !== SPECTRUM_CANVAS_HEIGHT) {
		throw new Error('SPU encoding requires a 320x200 source.');
	}

	const convertedCanvas = createCanvasClone(spectrumSource);
	convertSpectrum512Lines({
		sourceCanvas: spectrumSource,
		targetCanvas: convertedCanvas,
		yStart: 0,
		yEnd: SPECTRUM_CANVAS_HEIGHT - 1,
		options: { bitsPerColor, ditherPattern }
	});

	const lineSlots = computeSpectrum512LineColorSlots({
		sourceCanvas: spectrumSource,
		options: { bitsPerColor, ditherPattern }
	});

	const convertedData = convertedCanvas
		.getContext('2d')
		.getImageData(0, 0, SPECTRUM_CANVAS_WIDTH, SPECTRUM_CANVAS_HEIGHT).data;

	const data = new Uint8Array(SPU_GRAPHICS_BYTES + SPU_PALETTE_BYTES);
	if (bitsPerColor === 5) {
		data[0] = 0x35;
		data[1] = 0x42;
		data[2] = 0x49;
		data[3] = 0x54;
	}

	writeBitplanes(data, convertedData, lineSlots);
	writePalettes(data, lineSlots, bitsPerColor);
	return data;
}
