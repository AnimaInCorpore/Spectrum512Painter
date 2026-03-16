import { PATTERN_CLASSES } from './config/patterns.js';
import { GEM_256_COLORS } from './config/colors.js';
import { createCanvasDocument } from './canvas/document.js';
import { createHistoryManager } from './canvas/history.js';
import { createViewportScroller } from './canvas/viewport.js';
import { setupFileLoading } from './io/loading.js';
import { setupFileSaving } from './io/saving.js';
import { createToolController } from './tools/controller.js';
import { createToolRegistry } from './tools/registry.js';
import { createToolState } from './tools/state.js';
import { initGemMenus } from './ui/menus.js';
import { initColorPalette } from './ui/colors.js';
import { initLineSizeSlider } from './ui/line-size.js';
import { initPatternPalette } from './ui/patterns.js';
import { initShapeModeControl } from './ui/shape-mode.js';
import { initToolSelection } from './ui/tools.js';
import { initUndoRedoControls } from './ui/undo-redo.js';
import {
	createSpectrumCanvas,
	SPECTRUM_CANVAS_WIDTH,
	SPECTRUM_CANVAS_HEIGHT
} from './imaging/spectrum.js';
import {
	convertSpectrum512Lines,
	SPECTRUM512_TARGETS,
	FLOYD_STEINBERG_DITHER_PRESETS,
	SPECTRUM512_OPTIMIZER_MODES
} from './imaging/spectrum512.js';

const patternsGrid = document.getElementById('patterns-grid');
const colorGrid = document.getElementById('color-grid');
const foregroundSwatch = document.getElementById('color-foreground');
const backgroundSwatch = document.getElementById('color-background');
const menuRoot = document.querySelector('.menu-left');
const canvas = document.getElementById('paint');
const canvasArea = document.querySelector('.gem-canvas-area');
const canvasContainer = document.querySelector('.gem-canvas-container');
const titleElement = document.querySelector('.gem-titlebar-name');
const spectrumToggleEntry = document.getElementById('menu-color-spectrum512');
const target512Entry = document.getElementById('menu-color-target-512');
const target4096Entry = document.getElementById('menu-color-target-4096');
const target32768Entry = document.getElementById('menu-color-target-32768');
const ditherChecksEntry = document.getElementById('menu-color-dither-checks');
const ditherFsEntry = document.getElementById('menu-color-dither-fs');
const ditherFs85Entry = document.getElementById('menu-color-dither-fs-85');
const ditherFs75Entry = document.getElementById('menu-color-dither-fs-75');
const ditherFs50Entry = document.getElementById('menu-color-dither-fs-50');
const ditherFalseFsEntry = document.getElementById('menu-color-dither-false-fs');
const bruteForceShaderEntry = document.getElementById('menu-options-bruteforce-shader');
const undoMenuItem = document.getElementById('menu-options-undo');
const redoMenuItem = document.getElementById('menu-options-redo');

const targetEntryMap = {
	st512: target512Entry,
	ste4096: target4096Entry,
	ste32768: target32768Entry
};

const ditherEntryMap = {
	checks: ditherChecksEntry,
	floydSteinberg: ditherFsEntry,
	floydSteinberg85: ditherFs85Entry,
	floydSteinberg75: ditherFs75Entry,
	floydSteinberg50: ditherFs50Entry,
	falseFloydSteinberg: ditherFalseFsEntry
};

let spectrum512Enabled = true;
let spectrumTarget = 'ste4096';
let spectrumDither = 'checks';
let bruteForceShaderEnabled = false;
let lastLoadedSource = null;
let sourceRevision = 0;
let spectrumSession = null;
let viewportScroller = null;
let displayZoomScale = 1;
const DITHER_MENU_ENABLED = true;
const BITS_TO_SPECTRUM_TARGET = {
	3: 'st512',
	4: 'ste4096',
	5: 'ste32768'
};
const MAX_HISTORY_STEPS = 32;
const EDIT_ZOOM_SCALE = 4;

const canvasDocument = createCanvasDocument({
	canvas,
	titleElement
});

function readCanvasBitmapState(sourceCanvas) {
	if (!sourceCanvas) {
		return null;
	}
	const context = sourceCanvas.getContext('2d');
	if (!context) {
		return null;
	}
	const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
	return {
		width: sourceCanvas.width,
		height: sourceCanvas.height,
		pixels: new Uint8ClampedArray(imageData.data)
	};
}

function getEditableSourceCanvas() {
	if (spectrum512Enabled) {
		const session = ensureSpectrumSession();
		if (session && session.baseCanvas) {
			return session.baseCanvas;
		}
	}
	return canvas;
}

function persistBitmapState(state, { invalidateSpectrumSession = false } = {}) {
	if (!state || !state.pixels) {
		return;
	}
	const fileName = lastLoadedSource && lastLoadedSource.fileName
		? lastLoadedSource.fileName
		: 'UNTITLED';
	const sourceFormat = lastLoadedSource && lastLoadedSource.sourceFormat
		? lastLoadedSource.sourceFormat
		: undefined;
	lastLoadedSource = {
		type: 'bitmap',
		bitmap: {
			width: state.width,
			height: state.height,
			pixels: new Uint8ClampedArray(state.pixels)
		},
		fileName,
		...(sourceFormat ? { sourceFormat } : {})
	};
	if (invalidateSpectrumSession) {
		sourceRevision += 1;
		clearSpectrumSession();
	}
}

function captureEditableBitmapState() {
	return readCanvasBitmapState(getEditableSourceCanvas());
}

function persistCurrentEditableState(options = {}) {
	const state = captureEditableBitmapState();
	persistBitmapState(state, options);
	return state;
}

function applyHistoryBitmapState(state) {
	if (!state) {
		return;
	}
	persistBitmapState(state, { invalidateSpectrumSession: false });
	if (spectrum512Enabled) {
		let session = ensureSpectrumSession();
		if (!session) {
			sourceRevision += 1;
			clearSpectrumSession();
			session = ensureSpectrumSession();
		}
		if (session) {
			if (session.baseCanvas.width !== state.width || session.baseCanvas.height !== state.height) {
				session.baseCanvas.width = state.width;
				session.baseCanvas.height = state.height;
				session.baseContext = session.baseCanvas.getContext('2d');
				session.drawContext = createSpectrumDrawContextProxy(session);
			}
			const imageData = new ImageData(new Uint8ClampedArray(state.pixels), state.width, state.height);
			session.baseContext.putImageData(imageData, 0, 0);
		}
	}
	renderLoadedSource({ resetScroll: false });
	if (viewportScroller) {
		viewportScroller.recalcScrollBounds();
	}
}

function getSpectrumConversionOptions() {
	const target = SPECTRUM512_TARGETS[spectrumTarget] || SPECTRUM512_TARGETS.ste4096;
	const ditherPreset = FLOYD_STEINBERG_DITHER_PRESETS[spectrumDither] || FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg;
	return {
		bitsPerColor: target.bitsPerColor,
		ditherMode: ditherPreset.mode || 'errorDiffusion',
		ditherPattern: ditherPreset.pattern || null,
		optimizerMode: bruteForceShaderEnabled
			? SPECTRUM512_OPTIMIZER_MODES.bruteForceWebgl
			: SPECTRUM512_OPTIMIZER_MODES.greedy
	};
}

function getErrorDiffusionDirtyTailRows() {
	const ditherPreset = FLOYD_STEINBERG_DITHER_PRESETS[spectrumDither] || FLOYD_STEINBERG_DITHER_PRESETS.floydSteinberg;
	if (ditherPreset.mode !== 'errorDiffusion' || !Array.isArray(ditherPreset.pattern)) {
		return 0;
	}

	for (let i = 10; i <= 14; i += 1) {
		if ((ditherPreset.pattern[i] || 0) !== 0) {
			return 2;
		}
	}
	for (let i = 5; i <= 9; i += 1) {
		if ((ditherPreset.pattern[i] || 0) !== 0) {
			return 1;
		}
	}
	return 0;
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

	if (bruteForceShaderEntry) {
		bruteForceShaderEntry.textContent = `Brute-Force Shader ${bruteForceShaderEnabled ? 'On' : 'Off'}`;
		bruteForceShaderEntry.setAttribute('aria-pressed', String(bruteForceShaderEnabled));
	}
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
	const spectrumFitScale = (spectrum512Enabled && isSpectrumCanvas) ? computeSpectrumScale() : 1;
	const totalScale = spectrumFitScale * displayZoomScale;

	if (!spectrum512Enabled && totalScale <= 1) {
		canvas.style.width = '';
		canvas.style.height = '';
		canvas.style.imageRendering = '';
		return;
	}

	canvas.style.width = `${canvas.width * totalScale}px`;
	canvas.style.height = `${canvas.height * totalScale}px`;
	canvas.style.imageRendering = 'pixelated';
}

function setDisplayZoomEnabled(enabled) {
	const nextScale = enabled ? EDIT_ZOOM_SCALE : 1;
	if (displayZoomScale === nextScale) {
		return;
	}
	displayZoomScale = nextScale;
	applyDisplayScale();
	if (viewportScroller) {
		viewportScroller.recalcScrollBounds();
	}
}

function toCanvasFromBitmap(bitmap) {
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = bitmap.width;
	tempCanvas.height = bitmap.height;
	const tempContext = tempCanvas.getContext('2d');
	tempContext.putImageData(new ImageData(new Uint8ClampedArray(bitmap.pixels), bitmap.width, bitmap.height), 0, 0);
	return tempCanvas;
}

function cloneCanvas(sourceCanvas) {
	const clonedCanvas = document.createElement('canvas');
	clonedCanvas.width = sourceCanvas.width;
	clonedCanvas.height = sourceCanvas.height;
	clonedCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
	return clonedCanvas;
}

function shouldBypassSpectrumResize() {
	return Boolean(
		lastLoadedSource
		&& lastLoadedSource.type === 'bitmap'
		&& lastLoadedSource.sourceFormat === 'spu'
	);
}

function isSpuSourceLoaded() {
	return Boolean(
		lastLoadedSource
		&& lastLoadedSource.type === 'bitmap'
		&& lastLoadedSource.sourceFormat === 'spu'
	);
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
		if (session.isPassthrough) {
			const y = session.dirtyMinY;
			const height = session.dirtyMaxY - session.dirtyMinY + 1;
			const imageData = session.baseContext.getImageData(0, y, session.baseCanvas.width, height);
			canvasDocument.context.putImageData(imageData, 0, y);
		} else {
			convertSpectrum512Lines({
				sourceCanvas: session.baseCanvas,
				targetCanvas: canvas,
				yStart: session.dirtyMinY,
				yEnd: session.dirtyMaxY,
				options: getSpectrumConversionOptions()
			});
		}
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
		const tailRows = session.isPassthrough ? 0 : getErrorDiffusionDirtyTailRows();
		scheduleSpectrumDirtyConversion(session, y, y + imageData.height - 1 + tailRows);
	};
	proxy.fillRect = (x, y, width, height) => {
		baseContext.fillRect(x, y, width, height);
		const tailRows = session.isPassthrough ? 0 : getErrorDiffusionDirtyTailRows();
		scheduleSpectrumDirtyConversion(session, y, y + height - 1 + tailRows);
	};

	return proxy;
}

function createSpectrumSession() {
	const source = getBaseSourceForSpectrum();
	if (!source) {
		return null;
	}

	const baseCanvas = shouldBypassSpectrumResize() ? cloneCanvas(source) : createSpectrumCanvas(source);
	const baseContext = baseCanvas.getContext('2d');
	const session = {
		revision: sourceRevision,
		baseCanvas,
		baseContext,
		isPassthrough: isSpuSourceLoaded(),
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
	if (!session.isPassthrough) {
		convertSpectrum512Lines({
			sourceCanvas: session.baseCanvas,
			targetCanvas: canvas,
			yStart: 0,
			yEnd: SPECTRUM_CANVAS_HEIGHT - 1,
			options: getSpectrumConversionOptions()
		});
	}
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
		persistCurrentEditableState({ invalidateSpectrumSession: !spectrum512Enabled });
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

if (bruteForceShaderEntry) {
	bruteForceShaderEntry.addEventListener('click', () => {
		bruteForceShaderEnabled = !bruteForceShaderEnabled;
		updateSpectrumMenuEntries();
		if (spectrum512Enabled && lastLoadedSource) {
			renderSpectrumSession({ resetScroll: false });
		}
	});
}

updateSpectrumMenuEntries();

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

initPatternPalette(patternsGrid, PATTERN_CLASSES, { toolState });

initColorPalette({
	colorGrid,
	foregroundSwatch,
	backgroundSwatch,
	colors: GEM_256_COLORS,
	toolState
});
initLineSizeSlider(document, { toolState });
initShapeModeControl(document, { toolState });

initToolSelection(document, {
	onToolChange: toolId => {
		toolState.setActiveTool(toolId);
	},
	onZoomToggle: enabled => {
		setDisplayZoomEnabled(enabled);
	}
});

let undoRedoControls = null;
const historyManager = createHistoryManager({
	maxEntries: MAX_HISTORY_STEPS,
	captureState: captureEditableBitmapState,
	applyState: applyHistoryBitmapState,
	onChange: () => {
		if (undoRedoControls) {
			undoRedoControls.refresh();
		}
	}
});

undoRedoControls = initUndoRedoControls({
	undoMenuItem,
	redoMenuItem,
	onUndo: () => {
		historyManager.undo();
	},
	onRedo: () => {
		historyManager.redo();
	},
	canUndo: () => historyManager.canUndo(),
	canRedo: () => historyManager.canRedo()
});

const toolController = createToolController({
	canvas,
	toolState,
	toolRegistry,
	context: canvasDocument.context,
	getVisibleRect: () => viewportScroller.getVisibleRect(),
	onMutationStart: () => {
		historyManager.beginTransaction();
	},
	onMutationEnd: () => {
		const { committed, afterState } = historyManager.endTransaction();
		if (!committed || !afterState) {
			return;
		}
		persistBitmapState(afterState, { invalidateSpectrumSession: !spectrum512Enabled });
	}
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
	dropTarget: canvasArea,
	onImageLoaded: ({ image, fileName }) => {
		lastLoadedSource = {
			type: 'image',
			image,
			fileName
		};
		sourceRevision += 1;
		clearSpectrumSession();
		renderLoadedSource();
		historyManager.clear();
	},
	onBitmapLoaded: ({ width, height, pixels, fileName, sourceFormat, bitsPerColor }) => {
		if (sourceFormat === 'spu') {
			const preferredTarget = BITS_TO_SPECTRUM_TARGET[bitsPerColor];
			if (preferredTarget) {
				spectrumTarget = preferredTarget;
				updateSpectrumMenuEntries();
			}
		}
		lastLoadedSource = {
			type: 'bitmap',
			bitmap: {
				width,
				height,
				pixels: new Uint8ClampedArray(pixels)
			},
			fileName,
			sourceFormat
		};
		sourceRevision += 1;
		clearSpectrumSession();
		renderLoadedSource();
		historyManager.clear();
	}
});

setupFileSaving({
	canvas,
	saveMenuItem: document.getElementById('menu-file-save'),
	saveAsMenuItem: document.getElementById('menu-file-save-as'),
	exportMenuItem: document.getElementById('menu-file-export'),
	getBaseFileName: canvasDocument.getDownloadBaseName,
	getSpuFileName: () => {
		if (lastLoadedSource && lastLoadedSource.fileName) {
			return lastLoadedSource.fileName;
		}
		return canvasDocument.getDownloadBaseName();
	},
	getSpuSourceCanvas: () => {
		if (spectrumSession) {
			return spectrumSession.baseCanvas;
		}
		if (spectrum512Enabled) {
			const session = ensureSpectrumSession();
			return session ? session.baseCanvas : canvas;
		}
		return canvas;
	},
	getSpuOptions: () => getSpectrumConversionOptions()
});

initializeDefaultDocument();
historyManager.clear();

const aboutOverlay = document.getElementById('about-overlay');
const aboutMenuItem = document.getElementById('menu-desk-about');

if (aboutOverlay && aboutMenuItem) {
	const openAbout = () => aboutOverlay.classList.add('open');
	const closeAbout = () => aboutOverlay.classList.remove('open');

	aboutMenuItem.addEventListener('click', openAbout);
	document.getElementById('about-close').addEventListener('click', closeAbout);
	document.getElementById('about-ok').addEventListener('click', closeAbout);
	aboutOverlay.addEventListener('click', event => {
		if (event.target === aboutOverlay) {
			closeAbout();
		}
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && aboutOverlay.classList.contains('open')) {
			closeAbout();
		}
	});
}
