import { RemapSpectrum512Image7 } from '../../jscolorquantizer/modules/quantizers/spectrum512.js';
import { OklchDistance, rgbToOklch } from '../../jscolorquantizer/modules/quantizers/core.js';
import { createSpectrumCanvas } from './spectrum.js';

export const SPECTRUM512_TARGETS = {
	st512: { bitsPerColor: 3, label: '512 (ST)' },
	ste4096: { bitsPerColor: 4, label: '4096 (STE)' },
	ste32768: { bitsPerColor: 5, label: '32768 (STE Enhanced)' }
};

export const FLOYD_STEINBERG_DITHER_PRESETS = {
	floydSteinberg: {
		label: 'Floyd-Steinberg',
		pattern: [0, 0, 0, 7.0 / 16.0, 0, 0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg85: {
		label: 'Floyd-Steinberg (85%)',
		pattern: [0, 0, 0, 7.0 * 0.85 / 16.0, 0, 0, 3.0 * 0.85 / 16.0, 5.0 * 0.85 / 16.0, 1.0 * 0.85 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg75: {
		label: 'Floyd-Steinberg (75%)',
		pattern: [0, 0, 0, 7.0 * 0.75 / 16.0, 0, 0, 3.0 * 0.75 / 16.0, 5.0 * 0.75 / 16.0, 1.0 * 0.75 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg50: {
		label: 'Floyd-Steinberg (50%)',
		pattern: [0, 0, 0, 7.0 * 0.5 / 16.0, 0, 0, 3.0 * 0.5 / 16.0, 5.0 * 0.5 / 16.0, 1.0 * 0.5 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	falseFloydSteinberg: {
		label: 'False Floyd-Steinberg',
		pattern: [0, 0, 0, 3.0 / 8.0, 0, 0, 0, 3.0 / 8.0, 2.0 / 8.0, 0, 0, 0, 0, 0, 0]
	}
};

const DEFAULT_BITS_PER_COLOR = SPECTRUM512_TARGETS.ste4096.bitsPerColor;
const DEFAULT_DITHER_PATTERN = FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg.pattern;

export function getSpectrum512ColorSlotIndex(x, colorIndex) {
	let temp = 10 * colorIndex;

	if (colorIndex & 1) {
		temp -= 5;
	} else {
		temp += 1;
	}

	if (x < temp) {
		return colorIndex;
	}
	if (x >= temp + 160) {
		return colorIndex + 32;
	}
	return colorIndex + 16;
}

function clampColor(value) {
	if (value < 0) {
		return 0;
	}
	if (value > 255) {
		return 255;
	}
	return value;
}

function quantizeChannel(value, shadesScale, inverseShadesScale) {
	return Math.round(Math.round(value * shadesScale) * inverseShadesScale);
}

function createColorSlots() {
	const slots = [];
	for (let i = 0; i < 48; i += 1) {
		const red = 0;
		const green = 0;
		const blue = 0;
		const count = (i === 0 || i === 32) ? 2 : 0;
		slots.push({
			red,
			green,
			blue,
			oklch: rgbToOklch([red, green, blue]),
			count,
			slotIndex: i
		});
	}
	return slots;
}

function mergeColors(colorA, colorB) {
	const weightA = colorA.count;
	const weightB = colorB.count;
	const total = weightA + weightB;

	colorA.red = Math.round((colorA.red * weightA + colorB.red * weightB) / total);
	colorA.green = Math.round((colorA.green * weightA + colorB.green * weightB) / total);
	colorA.blue = Math.round((colorA.blue * weightA + colorB.blue * weightB) / total);
	colorA.oklch = rgbToOklch([colorA.red, colorA.green, colorA.blue]);
	colorA.count = total;
}

function buildWorkingLine(sourceData, width, y, shadesScale, inverseShadesScale, ditherPattern) {
	const line = new Float32Array(width * 4);

	for (let x = 0; x < width; x += 1) {
		const sourceIndex = (x + y * width) * 4;
		const lineIndex = x * 4;
		line[lineIndex] = sourceData[sourceIndex];
		line[lineIndex + 1] = sourceData[sourceIndex + 1];
		line[lineIndex + 2] = sourceData[sourceIndex + 2];
		line[lineIndex + 3] = sourceData[sourceIndex + 3];
	}

	if (!ditherPattern) {
		return line;
	}

	const right = ditherPattern[3] || 0;
	const right2 = ditherPattern[4] || 0;

	for (let x = 0; x < width; x += 1) {
		const index = x * 4;
		const alpha = line[index + 3];
		if (alpha !== 255) {
			continue;
		}

		const red = clampColor(line[index]);
		const green = clampColor(line[index + 1]);
		const blue = clampColor(line[index + 2]);
		const quantizedRed = quantizeChannel(red, shadesScale, inverseShadesScale);
		const quantizedGreen = quantizeChannel(green, shadesScale, inverseShadesScale);
		const quantizedBlue = quantizeChannel(blue, shadesScale, inverseShadesScale);

		const redError = red - quantizedRed;
		const greenError = green - quantizedGreen;
		const blueError = blue - quantizedBlue;

		line[index] = quantizedRed;
		line[index + 1] = quantizedGreen;
		line[index + 2] = quantizedBlue;

		if (x + 1 < width && right !== 0) {
			const rightIndex = (x + 1) * 4;
			line[rightIndex] -= redError * right;
			line[rightIndex + 1] -= greenError * right;
			line[rightIndex + 2] -= blueError * right;
		}
		if (x + 2 < width && right2 !== 0) {
			const right2Index = (x + 2) * 4;
			line[right2Index] -= redError * right2;
			line[right2Index + 1] -= greenError * right2;
			line[right2Index + 2] -= blueError * right2;
		}
	}

	return line;
}

function fillLineColorSlots(lineData, width, colorSlots) {
	for (let x = 0; x < width; x += 1) {
		const pixelIndex = x * 4;
		const alpha = lineData[pixelIndex + 3];
		if (alpha !== 255) {
			continue;
		}

		const red = clampColor(lineData[pixelIndex]);
		const green = clampColor(lineData[pixelIndex + 1]);
		const blue = clampColor(lineData[pixelIndex + 2]);
		const pixelOklch = rgbToOklch([red, green, blue]);

		const colors = [{ red, green, blue, oklch: pixelOklch, count: 1 }];
		let colorIndex = 0;

		for (; colorIndex < 16; colorIndex += 1) {
			const spectrumColor = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
			if (spectrumColor.red === red && spectrumColor.green === green && spectrumColor.blue === blue) {
				spectrumColor.count += 1;
				break;
			}
			if (spectrumColor.count === 0) {
				spectrumColor.red = red;
				spectrumColor.green = green;
				spectrumColor.blue = blue;
				spectrumColor.oklch = pixelOklch;
				spectrumColor.count = 1;
				break;
			}
			colors.push(spectrumColor);
		}

		if (colorIndex < 16) {
			continue;
		}

		let bestScore = Number.MAX_VALUE;
		let bestA = null;
		let bestB = null;

		for (let indexA = 0; indexA < colors.length - 1; indexA += 1) {
			for (let indexB = indexA + 1; indexB < colors.length; indexB += 1) {
				const colorA = colors[indexA];
				const colorB = colors[indexB];
				if (colorA.slotIndex === 32 || colorB.slotIndex === 32) {
					continue;
				}

				let deltaH = Math.abs(colorA.oklch[2] - colorB.oklch[2]);
				if (deltaH > Math.PI) {
					deltaH = Math.PI * 2 - deltaH;
				}

				const minC = Math.min(colorA.oklch[1], colorB.oklch[1]);
				if (minC > 0.05 && deltaH > Math.PI * (40 / 180)) {
					continue;
				}

				const distance = OklchDistance(colorA.oklch, colorB.oklch);
				const lightnessGap = Math.abs(colorA.oklch[0] - colorB.oklch[0]);
				const chromaGap = Math.abs(colorA.oklch[1] - colorB.oklch[1]);
				const score = distance * (colorA.count + colorB.count) * (1 + lightnessGap) * (1 + chromaGap);

				if (score < bestScore) {
					bestScore = score;
					bestA = colorA;
					bestB = colorB;
				}
			}
		}

		if (!bestA || !bestB) {
			continue;
		}

		if (bestA === colors[0]) {
			mergeColors(bestB, bestA);
		} else if (bestA.slotIndex < bestB.slotIndex) {
			mergeColors(bestA, bestB);
			bestB.red = colors[0].red;
			bestB.green = colors[0].green;
			bestB.blue = colors[0].blue;
			bestB.oklch = colors[0].oklch;
			bestB.count = colors[0].count;
		} else {
			mergeColors(bestB, bestA);
			bestA.red = colors[0].red;
			bestA.green = colors[0].green;
			bestA.blue = colors[0].blue;
			bestA.oklch = colors[0].oklch;
			bestA.count = colors[0].count;
		}
	}
}

function quantizeSlots(colorSlots, shadesScale, inverseShadesScale) {
	for (let i = 0; i < colorSlots.length; i += 1) {
		const slot = colorSlots[i];
		slot.red = quantizeChannel(slot.red, shadesScale, inverseShadesScale);
		slot.green = quantizeChannel(slot.green, shadesScale, inverseShadesScale);
		slot.blue = quantizeChannel(slot.blue, shadesScale, inverseShadesScale);
		slot.oklch = rgbToOklch([slot.red, slot.green, slot.blue]);
	}
}

function remapLine(lineData, targetData, width, y, colorSlots) {
	for (let x = 0; x < width; x += 1) {
		const lineIndex = x * 4;
		const pixelIndex = (x + y * width) * 4;
		const alpha = lineData[lineIndex + 3];
		if (alpha !== 255) {
			continue;
		}

		const red = clampColor(lineData[lineIndex]);
		const green = clampColor(lineData[lineIndex + 1]);
		const blue = clampColor(lineData[lineIndex + 2]);
		const pixelOklch = rgbToOklch([red, green, blue]);

		let closestDistance = Number.MAX_VALUE;
		let remapped = null;

		for (let colorIndex = 0; colorIndex < 16; colorIndex += 1) {
			const slot = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
			const distance = OklchDistance(pixelOklch, slot.oklch);
			if (distance < closestDistance) {
				closestDistance = distance;
				remapped = slot;
			}
		}

		if (!remapped) {
			continue;
		}

		targetData[pixelIndex] = remapped.red;
		targetData[pixelIndex + 1] = remapped.green;
		targetData[pixelIndex + 2] = remapped.blue;
		targetData[pixelIndex + 3] = 255;
	}
}

export function computeSpectrum512LineColorSlots({ sourceCanvas, options = {} }) {
	if (!sourceCanvas) {
		return [];
	}
	const width = sourceCanvas.width;
	const height = sourceCanvas.height;
	if (width < 1 || height < 1) {
		return [];
	}

	const bitsPerColor = Number.isFinite(options.bitsPerColor)
		? options.bitsPerColor
		: DEFAULT_BITS_PER_COLOR;
	const ditherPattern = options.ditherPattern || DEFAULT_DITHER_PATTERN;
	const shadesPerColor = 1 << bitsPerColor;
	const shadesScale = (shadesPerColor - 1) / 255;
	const inverseShadesScale = 1 / shadesScale;

	const sourceContext = sourceCanvas.getContext('2d');
	const sourceImage = sourceContext.getImageData(0, 0, width, height);
	const sourceData = sourceImage.data;
	const lines = new Array(height);

	for (let y = 0; y < height; y += 1) {
		const lineData = buildWorkingLine(
			sourceData,
			width,
			y,
			shadesScale,
			inverseShadesScale,
			ditherPattern
		);
		const colorSlots = createColorSlots();
		fillLineColorSlots(lineData, width, colorSlots);
		quantizeSlots(colorSlots, shadesScale, inverseShadesScale);
		lines[y] = colorSlots.map(slot => ({
			red: slot.red,
			green: slot.green,
			blue: slot.blue
		}));
	}

	return lines;
}

function cloneCanvas(sourceCanvas) {
	const canvas = document.createElement('canvas');
	canvas.width = sourceCanvas.width;
	canvas.height = sourceCanvas.height;
	canvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
	return canvas;
}

export function createSpectrum512ConvertedCanvas(source, options = {}) {
	const resizedCanvas = createSpectrumCanvas(source);
	const convertedCanvas = cloneCanvas(resizedCanvas);
	convertSpectrum512Lines({
		sourceCanvas: resizedCanvas,
		targetCanvas: convertedCanvas,
		yStart: 0,
		yEnd: resizedCanvas.height - 1,
		options
	});
	return convertedCanvas;
}

export function convertSpectrum512Lines({
	sourceCanvas,
	targetCanvas,
	yStart = 0,
	yEnd = null,
	options = {}
}) {
	if (!sourceCanvas || !targetCanvas) {
		return;
	}
	const width = sourceCanvas.width;
	const height = sourceCanvas.height;
	if (width < 1 || height < 1) {
		return;
	}

	const bitsPerColor = Number.isFinite(options.bitsPerColor)
		? options.bitsPerColor
		: DEFAULT_BITS_PER_COLOR;
	const ditherPattern = options.ditherPattern || DEFAULT_DITHER_PATTERN;
	const shadesPerColor = 1 << bitsPerColor;
	const shadesScale = (shadesPerColor - 1) / 255;
	const inverseShadesScale = 1 / shadesScale;

	const startY = Math.max(0, Math.min(height - 1, Math.floor(yStart)));
	const endY = Math.max(startY, Math.min(height - 1, Math.floor(yEnd == null ? height - 1 : yEnd)));

	const sourceContext = sourceCanvas.getContext('2d');
	const targetContext = targetCanvas.getContext('2d');
	const sourceImage = sourceContext.getImageData(0, 0, width, height);
	const targetImage = targetContext.getImageData(0, 0, width, height);
	const sourceData = sourceImage.data;
	const targetData = targetImage.data;

	for (let y = startY; y <= endY; y += 1) {
		const lineData = buildWorkingLine(
			sourceData,
			width,
			y,
			shadesScale,
			inverseShadesScale,
			ditherPattern
		);
		const colorSlots = createColorSlots();
		fillLineColorSlots(lineData, width, colorSlots);
		quantizeSlots(colorSlots, shadesScale, inverseShadesScale);
		remapLine(lineData, targetData, width, y, colorSlots);
	}

	targetContext.putImageData(targetImage, 0, 0);
}

export function createSpectrum512ReferenceCanvas(source, options = {}) {
	const bitsPerColor = Number.isFinite(options.bitsPerColor)
		? options.bitsPerColor
		: DEFAULT_BITS_PER_COLOR;
	const ditherPattern = options.ditherPattern || DEFAULT_DITHER_PATTERN;

	const resizedCanvas = createSpectrumCanvas(source);
	const convertedCanvas = cloneCanvas(resizedCanvas);
	const imageInfos = {};
	RemapSpectrum512Image7(convertedCanvas, imageInfos, bitsPerColor, ditherPattern);
	return convertedCanvas;
}
