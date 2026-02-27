import { PATTERN_CLASSES } from './config/patterns.js';
import { createCanvasDocument } from './canvas/document.js';
import { createViewportScroller } from './canvas/viewport.js';
import { setupFileLoading } from './io/loading.js';
import { setupFileSaving } from './io/saving.js';
import { createToolController } from './tools/controller.js';
import { createToolRegistry } from './tools/registry.js';
import { createToolState } from './tools/state.js';
import { initGemMenus } from './ui/menus.js';
import { initPatternPalette } from './ui/patterns.js';
import { initToolSelection } from './ui/tools.js';
import {
	SPECTRUM_CANVAS_WIDTH,
	SPECTRUM_CANVAS_HEIGHT
} from './imaging/spectrum.js';
import {
	createSpectrum512ConvertedCanvas,
	SPECTRUM512_TARGETS,
	FLOYD_STEINBERG_DITHER_PRESETS
} from './imaging/spectrum512.js';

function createSpectrumBitmapBuffer({ width, height, pixels }, conversionOptions) {
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = width;
	tempCanvas.height = height;

	const tempContext = tempCanvas.getContext('2d');
	tempContext.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);

	const spectrumCanvas = createSpectrum512ConvertedCanvas(tempCanvas, conversionOptions);
	const spectrumContext = spectrumCanvas.getContext('2d');
	const spectrumData = spectrumContext.getImageData(0, 0, spectrumCanvas.width, spectrumCanvas.height);

	return {
		width: spectrumCanvas.width,
		height: spectrumCanvas.height,
		pixels: spectrumData.data
	};
}

const patternsGrid = document.getElementById('patterns-grid');
const menuRoot = document.querySelector('.menu-left');
const canvas = document.getElementById('paint');
const canvasContainer = document.querySelector('.gem-canvas-container');
const titleElement = document.querySelector('.gem-titlebar-name');
const spectrumToggleEntry = document.getElementById('menu-color-spectrum512');
const target512Entry = document.getElementById('menu-color-target-512');
const target4096Entry = document.getElementById('menu-color-target-4096');
const target32768Entry = document.getElementById('menu-color-target-32768');
const ditherFsEntry = document.getElementById('menu-color-dither-fs');
const ditherFs85Entry = document.getElementById('menu-color-dither-fs-85');
const ditherFs75Entry = document.getElementById('menu-color-dither-fs-75');
const ditherFs50Entry = document.getElementById('menu-color-dither-fs-50');
const ditherFalseFsEntry = document.getElementById('menu-color-dither-false-fs');
let spectrum512Enabled = false;
let spectrumTarget = 'ste4096';
let spectrumDither = 'floydSteinberg';
let lastLoadedSource = null;

const targetEntryMap = {
	st512: target512Entry,
	ste4096: target4096Entry,
	ste32768: target32768Entry
};

const ditherEntryMap = {
	floydSteinberg: ditherFsEntry,
	floydSteinberg85: ditherFs85Entry,
	floydSteinberg75: ditherFs75Entry,
	floydSteinberg50: ditherFs50Entry,
	falseFloydSteinberg: ditherFalseFsEntry
};

const setMenuChoiceText = (entry, label, selected) => {
	if (!entry) {
		return;
	}
	entry.textContent = `${selected ? '✓' : ' '} ${label}`;
};

const getSpectrumConversionOptions = () => {
	const target = SPECTRUM512_TARGETS[spectrumTarget] || SPECTRUM512_TARGETS.ste4096;
	const dither = FLOYD_STEINBERG_DITHER_PRESETS[spectrumDither] || FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg;

	return {
		bitsPerColor: target.bitsPerColor,
		ditherPattern: dither.pattern
	};
};

const updateSpectrumMenuEntries = () => {
	if (!spectrumToggleEntry) {
		return;
	}
	spectrumToggleEntry.textContent = `Spectrum 512 ${spectrum512Enabled ? 'On' : 'Off'}`;
	spectrumToggleEntry.setAttribute('aria-pressed', String(spectrum512Enabled));

	Object.entries(SPECTRUM512_TARGETS).forEach(([key, target]) => {
		setMenuChoiceText(targetEntryMap[key], target.label, key === spectrumTarget);
	});

	Object.entries(FLOYD_STEINBERG_DITHER_PRESETS).forEach(([key, preset]) => {
		setMenuChoiceText(ditherEntryMap[key], preset.label, key === spectrumDither);
	});
};

const toggleSpectrum512 = () => {
	spectrum512Enabled = !spectrum512Enabled;
	updateSpectrumMenuEntries();
	renderLoadedSource();
};

if (spectrumToggleEntry) {
	spectrumToggleEntry.addEventListener('click', () => {
		toggleSpectrum512();
	});
}

Object.entries(targetEntryMap).forEach(([key, entry]) => {
	if (!entry) {
		return;
	}
	entry.addEventListener('click', () => {
		spectrumTarget = key;
		updateSpectrumMenuEntries();
		if (spectrum512Enabled && lastLoadedSource) {
			renderLoadedSource();
		}
	});
});

Object.entries(ditherEntryMap).forEach(([key, entry]) => {
	if (!entry) {
		return;
	}
	entry.addEventListener('click', () => {
		spectrumDither = key;
		updateSpectrumMenuEntries();
		if (spectrum512Enabled && lastLoadedSource) {
			renderLoadedSource();
		}
	});
});

updateSpectrumMenuEntries();

const canvasDocument = createCanvasDocument({
	canvas,
	titleElement
});

const computeSpectrumScale = () => {
	if (!canvasContainer) {
		return 1;
	}
	const fitX = Math.floor(canvasContainer.clientWidth / SPECTRUM_CANVAS_WIDTH);
	const fitY = Math.floor(canvasContainer.clientHeight / SPECTRUM_CANVAS_HEIGHT);
	return Math.max(1, Math.min(fitX, fitY));
};

const applyDisplayScale = () => {
	const isSpectrumCanvas = canvas.width === SPECTRUM_CANVAS_WIDTH && canvas.height === SPECTRUM_CANVAS_HEIGHT;
	if (!spectrum512Enabled || !isSpectrumCanvas) {
		canvas.style.width = '';
		canvas.style.height = '';
		canvas.style.imageRendering = '';
		return;
	}
	const scale = computeSpectrumScale();
	canvas.style.width = `${canvas.width * scale}px`;
	canvas.style.height = `${canvas.height * scale}px`;
	canvas.style.imageRendering = 'pixelated';
};

const renderLoadedSource = () => {
	if (!lastLoadedSource) {
		return;
	}

	if (lastLoadedSource.type === 'image') {
		const imageToRender = spectrum512Enabled
			? createSpectrum512ConvertedCanvas(lastLoadedSource.image, getSpectrumConversionOptions())
			: lastLoadedSource.image;
		canvasDocument.setImage({
			image: imageToRender,
			fileName: lastLoadedSource.fileName
		});
		applyDisplayScale();
		viewportScroller.resetPosition();
		return;
	}

	const bitmapToRender = spectrum512Enabled
		? createSpectrumBitmapBuffer(lastLoadedSource.bitmap, getSpectrumConversionOptions())
		: lastLoadedSource.bitmap;
	canvasDocument.setPixelBuffer({
		...bitmapToRender,
		fileName: lastLoadedSource.fileName
	});
	applyDisplayScale();
	viewportScroller.resetPosition();
};

initPatternPalette(patternsGrid, PATTERN_CLASSES);
initGemMenus({ menuRoot });

const viewportScroller = createViewportScroller({
	canvas,
	canvasContainer,
	verticalScrollbar: document.querySelector('.gem-scrollbar.vertical'),
	horizontalScrollbar: document.querySelector('.gem-scrollbar.horizontal')
});

window.addEventListener('resize', () => {
	applyDisplayScale();
	viewportScroller.recalcScrollBounds();
});

const toolState = createToolState('pencil');
const toolRegistry = createToolRegistry();

initToolSelection(document, {
	onToolChange: toolId => {
		toolState.setActiveTool(toolId);
	}
});

createToolController({
	canvas,
	toolState,
	toolRegistry,
	context: canvasDocument.context,
	getVisibleRect: viewportScroller.getVisibleRect
});

setupFileLoading({
	fileInput: document.getElementById('file-open'),
	openMenuItem: document.getElementById('menu-file-open'),
	onImageLoaded: ({ image, fileName }) => {
		lastLoadedSource = {
			type: 'image',
			image,
			fileName
		};
		renderLoadedSource();
	},
	onBitmapLoaded: ({ width, height, pixels, fileName }) => {
		lastLoadedSource = {
			type: 'bitmap',
			bitmap: {
				width,
				height,
				pixels: new Uint8ClampedArray(pixels)
			},
			fileName
		};
		renderLoadedSource();
	}
});

setupFileSaving({
	canvas,
	saveMenuItem: document.getElementById('menu-file-save'),
	saveAsMenuItem: document.getElementById('menu-file-save-as'),
	exportMenuItem: document.getElementById('menu-file-export'),
	getBaseFileName: canvasDocument.getDownloadBaseName
});
