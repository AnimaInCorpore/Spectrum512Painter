import { RemapSpectrum512Image7 } from '../vendor/jscolorquantizer/quantizers/spectrum512.js';
import { OklabDistance, rgbToOklab } from '../vendor/jscolorquantizer/quantizers/core.js';
import { createSpectrumCanvas } from './spectrum.js';

const DITHER_MODE_ERROR_DIFFUSION = 'errorDiffusion';
const DITHER_MODE_CHECKS = 'checks';

export const SPECTRUM512_TARGETS = {
	st512: { bitsPerColor: 3, label: '512 (ST)' },
	ste4096: { bitsPerColor: 4, label: '4096 (STE)' },
	ste32768: { bitsPerColor: 5, label: '32768 (STE Enhanced)' }
};

export const FLOYD_STEINBERG_DITHER_PRESETS = {
	checks: {
		label: 'Checks (Error Pair)',
		mode: DITHER_MODE_CHECKS,
		pattern: null
	},
	floydSteinberg: {
		label: 'Floyd-Steinberg',
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: [0, 0, 0, 7.0 / 16.0, 0, 0, 3.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg85: {
		label: 'Floyd-Steinberg (85%)',
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: [0, 0, 0, 7.0 * 0.85 / 16.0, 0, 0, 3.0 * 0.85 / 16.0, 5.0 * 0.85 / 16.0, 1.0 * 0.85 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg75: {
		label: 'Floyd-Steinberg (75%)',
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: [0, 0, 0, 7.0 * 0.75 / 16.0, 0, 0, 3.0 * 0.75 / 16.0, 5.0 * 0.75 / 16.0, 1.0 * 0.75 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	floydSteinberg50: {
		label: 'Floyd-Steinberg (50%)',
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: [0, 0, 0, 7.0 * 0.5 / 16.0, 0, 0, 3.0 * 0.5 / 16.0, 5.0 * 0.5 / 16.0, 1.0 * 0.5 / 16.0, 0, 0, 0, 0, 0, 0]
	},
	falseFloydSteinberg: {
		label: 'False Floyd-Steinberg',
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: [0, 0, 0, 3.0 / 8.0, 0, 0, 0, 3.0 / 8.0, 2.0 / 8.0, 0, 0, 0, 0, 0, 0]
	}
};

const DEFAULT_BITS_PER_COLOR = SPECTRUM512_TARGETS.ste4096.bitsPerColor;
const DEFAULT_DITHER_PATTERN = FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg.pattern;

function resolveDitherOptions(options) {
	const mode = options.ditherMode === DITHER_MODE_CHECKS
		? DITHER_MODE_CHECKS
		: DITHER_MODE_ERROR_DIFFUSION;
	const pattern = mode === DITHER_MODE_ERROR_DIFFUSION
		&& Array.isArray(options.ditherPattern)
		&& options.ditherPattern.length > 0
		? options.ditherPattern
		: (mode === DITHER_MODE_ERROR_DIFFUSION ? DEFAULT_DITHER_PATTERN : null);
	return { mode, pattern };
}

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

function getOklabChroma(oklab) {
	return Math.sqrt(oklab[1] * oklab[1] + oklab[2] * oklab[2]);
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
			oklab: rgbToOklab([red, green, blue]),
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
	colorA.oklab = rgbToOklab([colorA.red, colorA.green, colorA.blue]);
	colorA.count = total;
}

function buildPosterizedIntermediateImage(
	sourceData,
	width,
	height,
	shadesScale,
	inverseShadesScale,
	ditherPattern
) {
	const intermediateData = new Float32Array(sourceData.length);
	for (let i = 0; i < sourceData.length; i += 1) {
		intermediateData[i] = sourceData[i];
	}

	const right = ditherPattern[3] || 0;
	const right2 = ditherPattern[4] || 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = (x + y * width) * 4;
			const alpha = intermediateData[pixelIndex + 3];
			if (alpha !== 255) {
				continue;
			}

			const red = clampColor(intermediateData[pixelIndex]);
			const green = clampColor(intermediateData[pixelIndex + 1]);
			const blue = clampColor(intermediateData[pixelIndex + 2]);
			const quantizedRed = quantizeChannel(red, shadesScale, inverseShadesScale);
			const quantizedGreen = quantizeChannel(green, shadesScale, inverseShadesScale);
			const quantizedBlue = quantizeChannel(blue, shadesScale, inverseShadesScale);

			const redError = red - quantizedRed;
			const greenError = green - quantizedGreen;
			const blueError = blue - quantizedBlue;

			intermediateData[pixelIndex] = quantizedRed;
			intermediateData[pixelIndex + 1] = quantizedGreen;
			intermediateData[pixelIndex + 2] = quantizedBlue;

			if (x + 1 < width && right !== 0) {
				const rightIndex = pixelIndex + 4;
				intermediateData[rightIndex] += redError * right;
				intermediateData[rightIndex + 1] += greenError * right;
				intermediateData[rightIndex + 2] += blueError * right;
			}
			if (x + 2 < width && right2 !== 0) {
				const right2Index = pixelIndex + 8;
				intermediateData[right2Index] += redError * right2;
				intermediateData[right2Index + 1] += greenError * right2;
				intermediateData[right2Index + 2] += blueError * right2;
			}
		}
	}

	return intermediateData;
}

function compareChecksColorsByLightness(colorA, colorB) {
	const lightnessA = rgbToOklab([colorA.red, colorA.green, colorA.blue])[0];
	const lightnessB = rgbToOklab([colorB.red, colorB.green, colorB.blue])[0];
	if (lightnessA !== lightnessB) {
		return lightnessA - lightnessB;
	}
	if (colorA.red !== colorB.red) {
		return colorA.red - colorB.red;
	}
	if (colorA.green !== colorB.green) {
		return colorA.green - colorB.green;
	}
	return colorA.blue - colorB.blue;
}

function pickChecksColorByParity(baseColor, secondColor, x, y) {
	let darker = baseColor;
	let lighter = secondColor;
	if (compareChecksColorsByLightness(darker, lighter) > 0) {
		darker = secondColor;
		lighter = baseColor;
	}
	const lineIsEven = (y & 1) === 0;
	const columnIsEven = (x & 1) === 0;
	const useDarker = lineIsEven ? columnIsEven : !columnIsEven;
	return useDarker ? darker : lighter;
}

function buildChecksIntermediateImage(sourceData, width, height, shadesScale, inverseShadesScale) {
	const intermediateData = new Float32Array(sourceData.length);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = (x + y * width) * 4;
			const alpha = sourceData[pixelIndex + 3];
			intermediateData[pixelIndex + 3] = alpha;
			if (alpha !== 255) {
				intermediateData[pixelIndex] = sourceData[pixelIndex];
				intermediateData[pixelIndex + 1] = sourceData[pixelIndex + 1];
				intermediateData[pixelIndex + 2] = sourceData[pixelIndex + 2];
				continue;
			}

			const sourceRed = sourceData[pixelIndex];
			const sourceGreen = sourceData[pixelIndex + 1];
			const sourceBlue = sourceData[pixelIndex + 2];

			const baseRed = quantizeChannel(sourceRed, shadesScale, inverseShadesScale);
			const baseGreen = quantizeChannel(sourceGreen, shadesScale, inverseShadesScale);
			const baseBlue = quantizeChannel(sourceBlue, shadesScale, inverseShadesScale);

			const redError = sourceRed - baseRed;
			const greenError = sourceGreen - baseGreen;
			const blueError = sourceBlue - baseBlue;

			const secondRed = quantizeChannel(clampColor(sourceRed + redError), shadesScale, inverseShadesScale);
			const secondGreen = quantizeChannel(clampColor(sourceGreen + greenError), shadesScale, inverseShadesScale);
			const secondBlue = quantizeChannel(clampColor(sourceBlue + blueError), shadesScale, inverseShadesScale);

			const selected = pickChecksColorByParity(
				{ red: baseRed, green: baseGreen, blue: baseBlue },
				{ red: secondRed, green: secondGreen, blue: secondBlue },
				x,
				y
			);
			intermediateData[pixelIndex] = selected.red;
			intermediateData[pixelIndex + 1] = selected.green;
			intermediateData[pixelIndex + 2] = selected.blue;
		}
	}

	return intermediateData;
}

function buildSecondIntermediateImage(
	sourceData,
	width,
	height,
	shadesScale,
	inverseShadesScale,
	ditherOptions
) {
	if (ditherOptions.mode === DITHER_MODE_CHECKS) {
		return buildChecksIntermediateImage(sourceData, width, height, shadesScale, inverseShadesScale);
	}
	return buildPosterizedIntermediateImage(
		sourceData,
		width,
		height,
		shadesScale,
		inverseShadesScale,
		ditherOptions.pattern || DEFAULT_DITHER_PATTERN
	);
}

function getIntermediateLine(intermediateData, width, y) {
	const line = new Float32Array(width * 4);
	const sourceOffset = y * width * 4;
	for (let i = 0; i < width * 4; i += 1) {
		line[i] = intermediateData[sourceOffset + i];
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
		const pixelOklab = rgbToOklab([red, green, blue]);

		const colors = [{ red, green, blue, oklab: pixelOklab, count: 1 }];
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
				spectrumColor.oklab = pixelOklab;
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

				const distance = OklabDistance(colorA.oklab, colorB.oklab);
				const lightnessGap = Math.abs(colorA.oklab[0] - colorB.oklab[0]);
				const chromaGap = Math.abs(getOklabChroma(colorA.oklab) - getOklabChroma(colorB.oklab));
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
			bestB.oklab = colors[0].oklab;
			bestB.count = colors[0].count;
		} else {
			mergeColors(bestB, bestA);
			bestA.red = colors[0].red;
			bestA.green = colors[0].green;
			bestA.blue = colors[0].blue;
			bestA.oklab = colors[0].oklab;
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
		slot.oklab = rgbToOklab([slot.red, slot.green, slot.blue]);
	}
}

function getLineSlotsAtX(colorSlots, x) {
	const slots = new Array(16);
	for (let colorIndex = 0; colorIndex < 16; colorIndex += 1) {
		slots[colorIndex] = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
	}
	return slots;
}

function updateLineSlotsAtX(lineSlots, colorSlots, x) {
	for (let colorIndex = 0; colorIndex < 16; colorIndex += 1) {
		const slot = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
		if (lineSlots[colorIndex] === slot) {
			continue;
		}
		lineSlots[colorIndex] = slot;
	}
}

function findClosestSlotMatch(pixelOklab, lineSlots) {
	let closestDistance = Number.MAX_VALUE;
	let slot = null;

	for (let i = 0; i < lineSlots.length; i += 1) {
		const candidate = lineSlots[i];
		const distance = OklabDistance(pixelOklab, candidate.oklab);
		if (distance < closestDistance) {
			closestDistance = distance;
			slot = candidate;
		}
	}

	return { slot, distance: closestDistance };
}

function remapLine(
	lineData,
	targetData,
	width,
	y,
	colorSlots
) {
	const lineSlots = getLineSlotsAtX(colorSlots, 0);

	for (let x = 0; x < width; x += 1) {
		if (x > 0) {
			updateLineSlotsAtX(lineSlots, colorSlots, x);
		}

		const lineIndex = x * 4;
		const pixelIndex = (x + y * width) * 4;
		const alpha = lineData[lineIndex + 3];
		if (alpha !== 255) {
			continue;
		}

		const red = clampColor(lineData[lineIndex]);
		const green = clampColor(lineData[lineIndex + 1]);
		const blue = clampColor(lineData[lineIndex + 2]);
		const pixelOklab = rgbToOklab([red, green, blue]);
		const closestSlotMatch = findClosestSlotMatch(pixelOklab, lineSlots);
		const remapped = closestSlotMatch.slot;

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
	const ditherOptions = resolveDitherOptions(options);
	const shadesPerColor = 1 << bitsPerColor;
	const shadesScale = (shadesPerColor - 1) / 255;
	const inverseShadesScale = 1 / shadesScale;

	const sourceContext = sourceCanvas.getContext('2d');
	const sourceImage = sourceContext.getImageData(0, 0, width, height);
	const sourceData = sourceImage.data;
	const intermediateData = buildSecondIntermediateImage(
		sourceData,
		width,
		height,
		shadesScale,
		inverseShadesScale,
		ditherOptions
	);
	const lines = new Array(height);

	for (let y = 0; y < height; y += 1) {
		const lineData = getIntermediateLine(intermediateData, width, y);
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
	const ditherOptions = resolveDitherOptions(options);
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
	const intermediateData = buildSecondIntermediateImage(
		sourceData,
		width,
		height,
		shadesScale,
		inverseShadesScale,
		ditherOptions
	);

	for (let y = startY; y <= endY; y += 1) {
		const lineData = getIntermediateLine(intermediateData, width, y);
		const colorSlots = createColorSlots();
		fillLineColorSlots(lineData, width, colorSlots);
		quantizeSlots(colorSlots, shadesScale, inverseShadesScale);
		remapLine(
			lineData,
			targetData,
			width,
			y,
			colorSlots
		);
	}

	targetContext.putImageData(targetImage, 0, 0);
}

export function createSpectrum512ReferenceCanvas(source, options = {}) {
	const bitsPerColor = Number.isFinite(options.bitsPerColor)
		? options.bitsPerColor
		: DEFAULT_BITS_PER_COLOR;
	const ditherOptions = resolveDitherOptions(options);

	const resizedCanvas = createSpectrumCanvas(source);
	const convertedCanvas = cloneCanvas(resizedCanvas);
	const imageInfos = {};
	RemapSpectrum512Image7(
		convertedCanvas,
		imageInfos,
		bitsPerColor,
		ditherOptions.mode === DITHER_MODE_ERROR_DIFFUSION ? ditherOptions.pattern : null
	);
	return convertedCanvas;
}
