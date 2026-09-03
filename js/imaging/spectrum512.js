import { OklabDistance, rgbToOklab } from '../vendor/jscolorquantizer/quantizers/core.js';
import { optimizeSpectrum512LineSlotsBruteForceBatch } from './spectrum512-bruteforce-webgl.js';

const DITHER_MODE_ERROR_DIFFUSION = 'errorDiffusion';
const DITHER_MODE_CHECKS = 'checks';
const OPTIMIZER_MODE_GREEDY = 'greedy';
const OPTIMIZER_MODE_BRUTE_FORCE_WEBGL = 'bruteForceWebgl';

export const SPECTRUM512_OPTIMIZER_MODES = {
	greedy: OPTIMIZER_MODE_GREEDY,
	bruteForceWebgl: OPTIMIZER_MODE_BRUTE_FORCE_WEBGL
};

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
const MIN_BITS_PER_COLOR = 1;
const MAX_BITS_PER_COLOR = 8;
const DEFAULT_DITHER_PATTERN = FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg.pattern;
const SLOT_COUNT = 48;
const LOGICAL_COLOR_COUNT = 16;
const BACKGROUND_SLOT_INDEX = 0;
const RESERVED_BACKGROUND_SLOT_INDEX = 32;
const ERROR_DIFFUSION_NEIGHBORS = [
	{ patternIndex: 3, dx: 1, dy: 0 },
	{ patternIndex: 4, dx: 2, dy: 0 },
	{ patternIndex: 5, dx: -2, dy: 1 },
	{ patternIndex: 6, dx: -1, dy: 1 },
	{ patternIndex: 7, dx: 0, dy: 1 },
	{ patternIndex: 8, dx: 1, dy: 1 },
	{ patternIndex: 9, dx: 2, dy: 1 },
	{ patternIndex: 10, dx: -2, dy: 2 },
	{ patternIndex: 11, dx: -1, dy: 2 },
	{ patternIndex: 12, dx: 0, dy: 2 },
	{ patternIndex: 13, dx: 1, dy: 2 },
	{ patternIndex: 14, dx: 2, dy: 2 }
];

function getOklabChroma(oklab) {
	return Math.sqrt(oklab[1] * oklab[1] + oklab[2] * oklab[2]);
}

const BLACK_OKLAB = rgbToOklab([0, 0, 0]);
const BLACK_OKLAB_CHROMA = getOklabChroma(BLACK_OKLAB);

function resolveDitherOptions(options) {
	if (options.ditherMode === DITHER_MODE_CHECKS) {
		return { mode: DITHER_MODE_CHECKS, pattern: null };
	}
	const hasPattern = Array.isArray(options.ditherPattern) && options.ditherPattern.length > 0;
	return {
		mode: DITHER_MODE_ERROR_DIFFUSION,
		pattern: hasPattern ? options.ditherPattern : DEFAULT_DITHER_PATTERN
	};
}

function resolveOptimizerMode(options) {
	return options.optimizerMode === OPTIMIZER_MODE_BRUTE_FORCE_WEBGL
		? OPTIMIZER_MODE_BRUTE_FORCE_WEBGL
		: OPTIMIZER_MODE_GREEDY;
}

function resolveBitsPerColor(options) {
	if (!Number.isFinite(options.bitsPerColor)) {
		return DEFAULT_BITS_PER_COLOR;
	}
	return Math.max(
		MIN_BITS_PER_COLOR,
		Math.min(MAX_BITS_PER_COLOR, Math.floor(options.bitsPerColor))
	);
}

function createQuantizationScale(bitsPerColor) {
	const shadesPerColor = 1 << bitsPerColor;
	const shadesScale = (shadesPerColor - 1) / 255;
	return { shadesScale, inverseShadesScale: 1 / shadesScale };
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

function setColorAppearance(color) {
	color.oklab = rgbToOklab([color.red, color.green, color.blue]);
	color.chroma = getOklabChroma(color.oklab);
	return color;
}

function copyColorInto(target, source) {
	target.red = source.red;
	target.green = source.green;
	target.blue = source.blue;
	target.oklab = source.oklab;
	target.chroma = source.chroma;
	target.count = source.count;
}

function createColorSlots() {
	const slots = new Array(SLOT_COUNT);
	for (let i = 0; i < SLOT_COUNT; i += 1) {
		const isReserved = i === BACKGROUND_SLOT_INDEX || i === RESERVED_BACKGROUND_SLOT_INDEX;
		slots[i] = {
			red: 0,
			green: 0,
			blue: 0,
			oklab: BLACK_OKLAB,
			chroma: BLACK_OKLAB_CHROMA,
			count: isReserved ? 2 : 0,
			slotIndex: i
		};
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
	colorA.count = total;
	setColorAppearance(colorA);
}

function diffuseErrorToNeighbor({
	intermediateData,
	width,
	height,
	x,
	y,
	redError,
	greenError,
	blueError,
	ditherPattern,
	neighbor
}) {
	const weight = ditherPattern[neighbor.patternIndex] || 0;
	if (weight === 0) {
		return;
	}
	const targetX = x + neighbor.dx;
	const targetY = y + neighbor.dy;
	if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
		return;
	}
	const targetIndex = (targetX + targetY * width) * 4;
	if (intermediateData[targetIndex + 3] !== 255) {
		return;
	}
	intermediateData[targetIndex] += redError * weight;
	intermediateData[targetIndex + 1] += greenError * weight;
	intermediateData[targetIndex + 2] += blueError * weight;
}

function diffuseQuantizationError({
	intermediateData,
	width,
	height,
	x,
	y,
	redError,
	greenError,
	blueError,
	ditherPattern
}) {
	for (let i = 0; i < ERROR_DIFFUSION_NEIGHBORS.length; i += 1) {
		diffuseErrorToNeighbor({
			intermediateData,
			width,
			height,
			x,
			y,
			redError,
			greenError,
			blueError,
			ditherPattern,
			neighbor: ERROR_DIFFUSION_NEIGHBORS[i]
		});
	}
}

function buildErrorDiffusionIntermediateImage(
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

			diffuseQuantizationError({
				intermediateData,
				width,
				height,
				x,
				y,
				redError,
				greenError,
				blueError,
				ditherPattern
			});
		}
	}

	return intermediateData;
}

function createOklabLightnessCache() {
	const cache = new Map();
	return (red, green, blue) => {
		const key = (red << 16) | (green << 8) | blue;
		let lightness = cache.get(key);
		if (lightness === undefined) {
			lightness = rgbToOklab([red, green, blue])[0];
			cache.set(key, lightness);
		}
		return lightness;
	};
}

function compareChecksColorsByLightness(colorA, colorB, getLightness) {
	const lightnessA = getLightness(colorA.red, colorA.green, colorA.blue);
	const lightnessB = getLightness(colorB.red, colorB.green, colorB.blue);
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

function pickChecksColorByParity(baseColor, secondColor, x, y, getLightness) {
	let darker = baseColor;
	let lighter = secondColor;
	if (compareChecksColorsByLightness(darker, lighter, getLightness) > 0) {
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
	const getLightness = createOklabLightnessCache();

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
				y,
				getLightness
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
	return buildErrorDiffusionIntermediateImage(
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

function findClosestColorPairToMerge(colors) {
	let bestScore = Number.MAX_VALUE;
	let bestA = null;
	let bestB = null;

	for (let indexA = 0; indexA < colors.length - 1; indexA += 1) {
		const colorA = colors[indexA];
		if (colorA.slotIndex === RESERVED_BACKGROUND_SLOT_INDEX) {
			continue;
		}

		for (let indexB = indexA + 1; indexB < colors.length; indexB += 1) {
			const colorB = colors[indexB];
			if (colorB.slotIndex === RESERVED_BACKGROUND_SLOT_INDEX) {
				continue;
			}

			const distance = OklabDistance(colorA.oklab, colorB.oklab);
			const lightnessGap = Math.abs(colorA.oklab[0] - colorB.oklab[0]);
			const chromaGap = Math.abs(colorA.chroma - colorB.chroma);
			const score = distance * (colorA.count + colorB.count) * (1 + lightnessGap) * (1 + chromaGap);

			if (score < bestScore) {
				bestScore = score;
				bestA = colorA;
				bestB = colorB;
			}
		}
	}

	return { bestA, bestB };
}

function makeRoomForPixelColor(colors) {
	const { bestA, bestB } = findClosestColorPairToMerge(colors);
	if (!bestA || !bestB) {
		return;
	}

	if (bestA === colors[0]) {
		mergeColors(bestB, bestA);
		return;
	}

	if (bestA.slotIndex < bestB.slotIndex) {
		mergeColors(bestA, bestB);
		copyColorInto(bestB, colors[0]);
		return;
	}

	mergeColors(bestB, bestA);
	copyColorInto(bestA, colors[0]);
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

		const pixelColor = setColorAppearance({ red, green, blue, count: 1 });
		const colors = [pixelColor];
		let colorIndex = 0;

		for (; colorIndex < LOGICAL_COLOR_COUNT; colorIndex += 1) {
			const spectrumColor = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
			if (spectrumColor.red === red && spectrumColor.green === green && spectrumColor.blue === blue) {
				spectrumColor.count += 1;
				break;
			}
			if (spectrumColor.count === 0) {
				copyColorInto(spectrumColor, pixelColor);
				break;
			}
			colors.push(spectrumColor);
		}

		if (colorIndex === LOGICAL_COLOR_COUNT) {
			makeRoomForPixelColor(colors);
		}
	}
}

function quantizeSlots(colorSlots, shadesScale, inverseShadesScale) {
	for (let i = 0; i < colorSlots.length; i += 1) {
		const slot = colorSlots[i];
		slot.red = quantizeChannel(slot.red, shadesScale, inverseShadesScale);
		slot.green = quantizeChannel(slot.green, shadesScale, inverseShadesScale);
		slot.blue = quantizeChannel(slot.blue, shadesScale, inverseShadesScale);
		setColorAppearance(slot);
	}
}

function applyOptimizedSlotsToColorSlots(colorSlots, optimizedSlots) {
	if (!optimizedSlots || optimizedSlots.length !== colorSlots.length) {
		return;
	}
	for (let i = 0; i < colorSlots.length; i += 1) {
		const slot = colorSlots[i];
		slot.red = optimizedSlots[i].red;
		slot.green = optimizedSlots[i].green;
		slot.blue = optimizedSlots[i].blue;
		setColorAppearance(slot);
	}
}

function buildLineColorSlotsBase({
	lineData,
	width,
	shadesScale,
	inverseShadesScale
}) {
	const colorSlots = createColorSlots();
	fillLineColorSlots(lineData, width, colorSlots);
	quantizeSlots(colorSlots, shadesScale, inverseShadesScale);
	return colorSlots;
}

function createLineProcessingEntries({
	intermediateData,
	width,
	yStart,
	yEnd,
	shadesScale,
	inverseShadesScale
}) {
	const lineCount = yEnd - yStart + 1;
	const entries = new Array(lineCount);
	let entryIndex = 0;

	for (let y = yStart; y <= yEnd; y += 1) {
		const lineData = getIntermediateLine(intermediateData, width, y);
		entries[entryIndex] = {
			y,
			lineData,
			colorSlots: buildLineColorSlotsBase({
				lineData,
				width,
				shadesScale,
				inverseShadesScale
			})
		};
		entryIndex += 1;
	}

	return entries;
}

function applyBruteForceOptimizationToEntries({ entries, width, bitsPerColor }) {
	if (!entries || entries.length < 1) {
		return;
	}

	const optimizedEntries = optimizeSpectrum512LineSlotsBruteForceBatch({
		lines: entries.map(entry => ({
			lineData: entry.lineData,
			initialSlots: entry.colorSlots
		})),
		width,
		bitsPerColor
	});

	for (let i = 0; i < entries.length; i += 1) {
		applyOptimizedSlotsToColorSlots(entries[i].colorSlots, optimizedEntries[i]);
	}
}

function fillLineSlotsAtX(lineSlots, colorSlots, x) {
	for (let colorIndex = 0; colorIndex < LOGICAL_COLOR_COUNT; colorIndex += 1) {
		lineSlots[colorIndex] = colorSlots[getSpectrum512ColorSlotIndex(x, colorIndex)];
	}
}

function findClosestSlot(pixelOklab, lineSlots) {
	let closestDistance = Number.MAX_VALUE;
	let closestSlot = null;

	for (let i = 0; i < lineSlots.length; i += 1) {
		const candidate = lineSlots[i];
		const distance = OklabDistance(pixelOklab, candidate.oklab);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestSlot = candidate;
		}
	}

	return closestSlot;
}

function remapLine(
	lineData,
	targetData,
	width,
	y,
	colorSlots
) {
	const lineSlots = new Array(LOGICAL_COLOR_COUNT);

	for (let x = 0; x < width; x += 1) {
		const lineIndex = x * 4;
		const alpha = lineData[lineIndex + 3];
		if (alpha !== 255) {
			continue;
		}

		fillLineSlotsAtX(lineSlots, colorSlots, x);

		const red = clampColor(lineData[lineIndex]);
		const green = clampColor(lineData[lineIndex + 1]);
		const blue = clampColor(lineData[lineIndex + 2]);
		const remapped = findClosestSlot(rgbToOklab([red, green, blue]), lineSlots);

		if (!remapped) {
			continue;
		}

		const pixelIndex = (x + y * width) * 4;
		targetData[pixelIndex] = remapped.red;
		targetData[pixelIndex + 1] = remapped.green;
		targetData[pixelIndex + 2] = remapped.blue;
		targetData[pixelIndex + 3] = 255;
	}
}

function clampLineIndex(value, fallback, lastLine) {
	if (value == null) {
		return fallback;
	}
	const index = Math.floor(value);
	if (!Number.isFinite(index)) {
		return fallback;
	}
	if (index < 0) {
		return 0;
	}
	if (index > lastLine) {
		return lastLine;
	}
	return index;
}

function resolveLineRange(yStart, yEnd, height, ditherOptions) {
	const lastLine = height - 1;
	const startY = clampLineIndex(yStart, 0, lastLine);

	// Error diffusion pushes quantization error onto the next two lines, and each of those
	// lines then re-diffuses its own error. A change on one line therefore reaches every
	// line below it, so anything short of a repaint to the bottom leaves stale pixels.
	if (ditherOptions.mode === DITHER_MODE_ERROR_DIFFUSION) {
		return { startY, endY: lastLine };
	}

	return { startY, endY: Math.max(startY, clampLineIndex(yEnd, lastLine, lastLine)) };
}

function prepareSpectrum512Lines({ sourceCanvas, yStart, yEnd, options }) {
	if (!sourceCanvas) {
		return null;
	}
	const width = sourceCanvas.width;
	const height = sourceCanvas.height;
	if (width < 1 || height < 1) {
		return null;
	}

	const bitsPerColor = resolveBitsPerColor(options);
	const ditherOptions = resolveDitherOptions(options);
	const { shadesScale, inverseShadesScale } = createQuantizationScale(bitsPerColor);
	const { startY, endY } = resolveLineRange(yStart, yEnd, height, ditherOptions);

	const sourceContext = sourceCanvas.getContext('2d');
	const sourceData = sourceContext.getImageData(0, 0, width, height).data;
	const intermediateData = buildSecondIntermediateImage(
		sourceData,
		width,
		height,
		shadesScale,
		inverseShadesScale,
		ditherOptions
	);
	const entries = createLineProcessingEntries({
		intermediateData,
		width,
		yStart: startY,
		yEnd: endY,
		shadesScale,
		inverseShadesScale
	});

	if (resolveOptimizerMode(options) === OPTIMIZER_MODE_BRUTE_FORCE_WEBGL) {
		applyBruteForceOptimizationToEntries({
			entries,
			width,
			bitsPerColor
		});
	}

	return { width, height, entries };
}

function collectLineColorSlots({ height, entries }) {
	const lines = new Array(height);
	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];
		lines[entry.y] = entry.colorSlots.map(slot => ({
			red: slot.red,
			green: slot.green,
			blue: slot.blue
		}));
	}
	return lines;
}

/**
 * Converts the requested line range of `sourceCanvas` into `targetCanvas` and returns the
 * 48 Spectrum color slots per converted line, indexed by line number. Lines outside the
 * converted range are left empty. Error diffusion modes always convert down to the last
 * line regardless of `yEnd`, because their dither state cascades downwards.
 */
export function convertSpectrum512Lines({
	sourceCanvas,
	targetCanvas,
	yStart = 0,
	yEnd = null,
	options = {}
}) {
	if (!targetCanvas) {
		return [];
	}
	const prepared = prepareSpectrum512Lines({ sourceCanvas, yStart, yEnd, options });
	if (!prepared) {
		return [];
	}

	const targetContext = targetCanvas.getContext('2d');
	const targetImage = targetContext.getImageData(0, 0, prepared.width, prepared.height);
	const targetData = targetImage.data;

	for (let i = 0; i < prepared.entries.length; i += 1) {
		const entry = prepared.entries[i];
		remapLine(
			entry.lineData,
			targetData,
			prepared.width,
			entry.y,
			entry.colorSlots
		);
	}

	targetContext.putImageData(targetImage, 0, 0);

	return collectLineColorSlots(prepared);
}
