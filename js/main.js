import { PATTERN_CLASSES } from './config/patterns.js';
import { GEM_256_COLORS } from './config/colors.js';
import { createCanvasDocument } from './canvas/document.js';
import { createViewportScroller } from './canvas/viewport.js';
import { setupFileLoading } from './io/loading.js';
import { setupFileSaving } from './io/saving.js';
import { createToolController } from './tools/controller.js';
import { createToolRegistry } from './tools/registry.js';
import { createToolState } from './tools/state.js';
import { initGemMenus } from './ui/menus.js';
import { initColorPalette } from './ui/colors.js';
import { initPatternPalette } from './ui/patterns.js';
import { initToolSelection } from './ui/tools.js';
import {
	createSpectrumCanvas,
	SPECTRUM_CANVAS_WIDTH,
	SPECTRUM_CANVAS_HEIGHT
} from './imaging/spectrum.js';
import {
	convertSpectrum512Lines,
	SPECTRUM512_TARGETS,
	FLOYD_STEINBERG_DITHER_PRESETS
} from './imaging/spectrum512.js';

const patternsGrid = document.getElementById('patterns-grid');
const colorGrid = document.getElementById('color-grid');
const foregroundSwatch = document.getElementById('color-foreground');
const backgroundSwatch = document.getElementById('color-background');
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

let spectrum512Enabled = true;
let spectrumTarget = 'ste4096';
let spectrumDither = 'floydSteinberg';
let lastLoadedSource = null;
let sourceRevision = 0;
let spectrumSession = null;
let viewportScroller = null;
const DITHER_MENU_ENABLED = false;

const canvasDocument = createCanvasDocument({
	canvas,
	titleElement
});

function getSpectrumConversionOptions() {
	const target = SPECTRUM512_TARGETS[spectrumTarget] || SPECTRUM512_TARGETS.ste4096;
	return {
		bitsPerColor: target.bitsPerColor,
		ditherPattern: null
	};
}

function setMenuChoiceText(entry, label, selected) {
	if (!entry) {
		return;
	}
	entry.textContent = `${selected ? '✓' : ' '} ${label}`;
}

function updateSpectrumMenuEntries() {
	if (spectrumToggleEntry) {
		spectrumToggleEntry.textContent = `Spectrum 512 ${spectrum512Enabled ? 'On' : 'Off'}`;
		spectrumToggleEntry.setAttribute('aria-pressed', String(spectrum512Enabled));
	}

	Object.entries(SPECTRUM512_TARGETS).forEach(([key, target]) => {
		setMenuChoiceText(targetEntryMap[key], target.label, key === spectrumTarget);
	});

	Object.entries(FLOYD_STEINBERG_DITHER_PRESETS).forEach(([key, preset]) => {
		setMenuChoiceText(ditherEntryMap[key], preset.label, key === spectrumDither);
		const entry = ditherEntryMap[key];
		if (!entry) {
			return;
		}
		entry.classList.toggle('disabled', !DITHER_MENU_ENABLED);
		entry.setAttribute('aria-disabled', String(!DITHER_MENU_ENABLED));
	});
}

function computeSpectrumScale() {
	if (!canvasContainer) {
		return 1;
	}
	const fitX = Math.floor(canvasContainer.clientWidth / SPECTRUM_CANVAS_WIDTH);
	const fitY = Math.floor(canvasContainer.clientHeight / SPECTRUM_CANVAS_HEIGHT);
	return Math.max(1, Math.min(fitX, fitY));
}

function applyDisplayScale() {
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
}

function toCanvasFromBitmap(bitmap) {
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = bitmap.width;
	tempCanvas.height = bitmap.height;
	const tempContext = tempCanvas.getContext('2d');
	tempContext.putImageData(new ImageData(new Uint8ClampedArray(bitmap.pixels), bitmap.width, bitmap.height), 0, 0);
	return tempCanvas;
}

function getBaseSourceForSpectrum() {
	if (!lastLoadedSource) {
		return null;
	}
	if (lastLoadedSource.type === 'image') {
		return lastLoadedSource.image;
	}
	return toCanvasFromBitmap(lastLoadedSource.bitmap);
}

function scheduleSpectrumDirtyConversion(session, minY, maxY) {
	const clampedMin = Math.max(0, Math.min(SPECTRUM_CANVAS_HEIGHT - 1, Math.floor(minY)));
	const clampedMax = Math.max(clampedMin, Math.min(SPECTRUM_CANVAS_HEIGHT - 1, Math.floor(maxY)));

	session.dirtyMinY = session.dirtyMinY == null ? clampedMin : Math.min(session.dirtyMinY, clampedMin);
	session.dirtyMaxY = session.dirtyMaxY == null ? clampedMax : Math.max(session.dirtyMaxY, clampedMax);

	if (session.rafId != null) {
		return;
	}

	session.rafId = window.requestAnimationFrame(() => {
		session.rafId = null;
		if (session.dirtyMinY == null || session.dirtyMaxY == null || !spectrum512Enabled || session !== spectrumSession) {
			session.dirtyMinY = null;
			session.dirtyMaxY = null;
			return;
		}
		convertSpectrum512Lines({
			sourceCanvas: session.baseCanvas,
			targetCanvas: canvas,
			yStart: session.dirtyMinY,
			yEnd: session.dirtyMaxY,
			options: getSpectrumConversionOptions()
		});
		session.dirtyMinY = null;
		session.dirtyMaxY = null;
	});
}

function createSpectrumDrawContextProxy(session) {
	const baseContext = session.baseContext;
	const proxy = {};

	Object.defineProperty(proxy, 'fillStyle', {
		get() {
			return baseContext.fillStyle;
		},
		set(value) {
			baseContext.fillStyle = value;
		}
	});

	proxy.createImageData = (...args) => baseContext.createImageData(...args);
	proxy.getImageData = (...args) => baseContext.getImageData(...args);
	proxy.putImageData = (imageData, x, y) => {
		baseContext.putImageData(imageData, x, y);
		scheduleSpectrumDirtyConversion(session, y, y + imageData.height - 1);
	};
	proxy.fillRect = (x, y, width, height) => {
		baseContext.fillRect(x, y, width, height);
		scheduleSpectrumDirtyConversion(session, y, y + height - 1);
	};

	return proxy;
}

function createSpectrumSession() {
	const source = getBaseSourceForSpectrum();
	if (!source) {
		return null;
	}

	const baseCanvas = createSpectrumCanvas(source);
	const baseContext = baseCanvas.getContext('2d');
	const session = {
		revision: sourceRevision,
		baseCanvas,
		baseContext,
		drawContext: null,
		dirtyMinY: null,
		dirtyMaxY: null,
		rafId: null
	};
	session.drawContext = createSpectrumDrawContextProxy(session);
	return session;
}

function ensureSpectrumSession() {
	if (spectrumSession && spectrumSession.revision === sourceRevision) {
		return spectrumSession;
	}
	spectrumSession = createSpectrumSession();
	return spectrumSession;
}

function renderSpectrumSession({ resetScroll = true } = {}) {
	const session = ensureSpectrumSession();
	if (!session) {
		return;
	}

	canvasDocument.setImage({
		image: session.baseCanvas,
		fileName: lastLoadedSource ? lastLoadedSource.fileName : 'UNTITLED'
	});
	convertSpectrum512Lines({
		sourceCanvas: session.baseCanvas,
		targetCanvas: canvas,
		yStart: 0,
		yEnd: SPECTRUM_CANVAS_HEIGHT - 1,
		options: getSpectrumConversionOptions()
	});
	applyDisplayScale();
	if (resetScroll && viewportScroller) {
		viewportScroller.resetPosition();
	}
}

function renderOriginalLoadedSource({ resetScroll = true } = {}) {
	if (!lastLoadedSource) {
		return;
	}

	if (lastLoadedSource.type === 'image') {
		canvasDocument.setImage({
			image: lastLoadedSource.image,
			fileName: lastLoadedSource.fileName
		});
	} else {
		canvasDocument.setPixelBuffer({
			width: lastLoadedSource.bitmap.width,
			height: lastLoadedSource.bitmap.height,
			pixels: new Uint8ClampedArray(lastLoadedSource.bitmap.pixels),
			fileName: lastLoadedSource.fileName
		});
	}

	applyDisplayScale();
	if (resetScroll && viewportScroller) {
		viewportScroller.resetPosition();
	}
}

function renderLoadedSource({ resetScroll = true } = {}) {
	if (!lastLoadedSource) {
		return;
	}
	if (spectrum512Enabled) {
		renderSpectrumSession({ resetScroll });
		return;
	}
	renderOriginalLoadedSource({ resetScroll });
}

function clearSpectrumSession() {
	if (spectrumSession && spectrumSession.rafId != null) {
		window.cancelAnimationFrame(spectrumSession.rafId);
	}
	spectrumSession = null;
}

function createDefaultBlankSource() {
	const width = SPECTRUM_CANVAS_WIDTH;
	const height = SPECTRUM_CANVAS_HEIGHT;
	const pixels = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = 255;
		pixels[i + 1] = 255;
		pixels[i + 2] = 255;
		pixels[i + 3] = 255;
	}
	return {
		type: 'bitmap',
		bitmap: { width, height, pixels },
		fileName: 'UNTITLED'
	};
}

function initializeDefaultDocument() {
	if (lastLoadedSource) {
		return;
	}
	lastLoadedSource = createDefaultBlankSource();
	sourceRevision += 1;
	clearSpectrumSession();
	renderLoadedSource();
}

if (spectrumToggleEntry) {
	spectrumToggleEntry.addEventListener('click', () => {
		spectrum512Enabled = !spectrum512Enabled;
		updateSpectrumMenuEntries();
		renderLoadedSource();
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
			renderSpectrumSession({ resetScroll: false });
		}
	});
});

Object.entries(ditherEntryMap).forEach(([key, entry]) => {
	if (!entry) {
		return;
	}
	entry.addEventListener('click', () => {
		if (!DITHER_MENU_ENABLED) {
			return;
		}
		spectrumDither = key;
		updateSpectrumMenuEntries();
		if (spectrum512Enabled && lastLoadedSource) {
			renderSpectrumSession({ resetScroll: false });
		}
	});
});

updateSpectrumMenuEntries();

initPatternPalette(patternsGrid, PATTERN_CLASSES);
initGemMenus({ menuRoot });

viewportScroller = createViewportScroller({
	canvas,
	canvasContainer,
	verticalScrollbar: document.querySelector('.gem-scrollbar.vertical'),
	horizontalScrollbar: document.querySelector('.gem-scrollbar.horizontal')
});

window.addEventListener('resize', () => {
	applyDisplayScale();
	if (viewportScroller) {
		viewportScroller.recalcScrollBounds();
	}
});

const toolState = createToolState('pencil');
const toolRegistry = createToolRegistry();

initColorPalette({
	colorGrid,
	foregroundSwatch,
	backgroundSwatch,
	colors: GEM_256_COLORS,
	toolState
});

initToolSelection(document, {
	onToolChange: toolId => {
		toolState.setActiveTool(toolId);
	}
});

const toolController = createToolController({
	canvas,
	toolState,
	toolRegistry,
	context: canvasDocument.context,
	getVisibleRect: () => viewportScroller.getVisibleRect()
});

toolController.setCanvasResolver(() => canvas);
toolController.setContextResolver(() => {
	if (spectrum512Enabled && spectrumSession) {
		return spectrumSession.drawContext;
	}
	return canvasDocument.context;
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
		sourceRevision += 1;
		clearSpectrumSession();
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
		sourceRevision += 1;
		clearSpectrumSession();
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

initializeDefaultDocument();
