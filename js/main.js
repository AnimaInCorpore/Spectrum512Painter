import { PATTERN_MASKS, setPatternMask } from './config/patterns.js';
import { GEM_256_COLORS } from './config/colors.js';
import { createCanvasDocument } from './canvas/document.js';
import { createHistoryManager } from './canvas/history.js';
import { createSelection } from './canvas/selection.js';
import { createViewportScroller } from './canvas/viewport.js';
import { setupFileLoading } from './io/loading.js';
import { setupFileSaving } from './io/saving.js';
import { createToolController } from './tools/controller.js';
import { createToolRegistry } from './tools/registry.js';
import { createToolState } from './tools/state.js';
import { initGemMenus, setMenuEntryChecked, setMenuEntryLabel } from './ui/menus.js';
import { initColorPalette } from './ui/colors.js';
import { initInfoBox, showAlert } from './ui/dialogs.js';
import { initLineMenu } from './ui/line-menu.js';
import { initPatternMenu } from './ui/pattern-menu.js';
import { initMenuShortcuts } from './ui/shortcuts.js';
import { initToolSelection } from './ui/tools.js';
import { initZoomBox, ZOOM_FULL } from './ui/zoom-box.js';
import { initUndoRedoControls } from './ui/undo-redo.js';
import { editPatternMask } from './ui/pattern-editor.js';
import { initImageCommands } from './ui/image-commands.js';
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

const lineMenu = document.getElementById('menu-line-widths');
const patternMenu = document.getElementById('menu-pattern-swatches');
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
const bruteForceEntry = document.getElementById('menu-options-bruteforce');
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
let bruteForceEnabled = false;
let lastLoadedSource = null;
let sourceRevision = 0;
let spectrumSession = null;
let viewportScroller = null;
let zoomSetting = ZOOM_FULL;
const DITHER_MENU_ENABLED = true;
const BITS_TO_SPECTRUM_TARGET = {
	3: 'st512',
	4: 'ste4096',
	5: 'ste32768'
};
const MAX_HISTORY_STEPS = 32;

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
		optimizerMode: bruteForceEnabled
			? SPECTRUM512_OPTIMIZER_MODES.bruteForce
			: SPECTRUM512_OPTIMIZER_MODES.greedy
	};
}

function updateSpectrumMenuEntries() {
	if (spectrumToggleEntry) {
		setMenuEntryLabel(spectrumToggleEntry, `Spectrum 512 ${spectrum512Enabled ? 'On' : 'Off'}`);
		spectrumToggleEntry.setAttribute('aria-pressed', String(spectrum512Enabled));
	}

	Object.entries(SPECTRUM512_TARGETS).forEach(([key, target]) => {
		setMenuEntryLabel(targetEntryMap[key], target.label);
		setMenuEntryChecked(targetEntryMap[key], key === spectrumTarget);
	});

	Object.entries(FLOYD_STEINBERG_DITHER_PRESETS).forEach(([key, preset]) => {
		const entry = ditherEntryMap[key];
		setMenuEntryLabel(entry, preset.label);
		setMenuEntryChecked(entry, key === spectrumDither);
		if (!entry) {
			return;
		}
		entry.classList.toggle('disabled', !DITHER_MENU_ENABLED);
		entry.setAttribute('aria-disabled', String(!DITHER_MENU_ENABLED));
	});

	if (bruteForceEntry) {
		setMenuEntryLabel(bruteForceEntry, `Brute-Force ${bruteForceEnabled ? 'On' : 'Off'}`);
		bruteForceEntry.setAttribute('aria-pressed', String(bruteForceEnabled));
	}
}

// "Full" fits the whole picture into the window: whole-number magnification when it fits,
// otherwise scaled down so the complete page is visible (GEM Draw's full page view).
function computeFullZoomScale() {
	if (!canvasContainer || canvas.width === 0 || canvas.height === 0) {
		return 1;
	}
	const fit = Math.min(canvasContainer.clientWidth / canvas.width, canvasContainer.clientHeight / canvas.height);
	if (!Number.isFinite(fit) || fit <= 0) {
		return 1;
	}
	return fit >= 1 ? Math.floor(fit) : fit;
}

function applyDisplayScale() {
	const scale = zoomSetting === ZOOM_FULL ? computeFullZoomScale() : zoomSetting;
	canvas.style.width = `${Math.max(1, Math.round(canvas.width * scale))}px`;
	canvas.style.height = `${Math.max(1, Math.round(canvas.height * scale))}px`;
	canvas.style.imageRendering = 'pixelated';
}

function setZoom(nextZoom) {
	if (zoomSetting === nextZoom) {
		return;
	}
	zoomSetting = nextZoom;
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
	// convertSpectrum512Lines extends the range down to the last line by itself when the
	// dither mode diffuses error across lines, so only the edited rows are reported here.
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

function startBlankDocument() {
	lastLoadedSource = createDefaultBlankSource();
	sourceRevision += 1;
	clearSpectrumSession();
	renderLoadedSource();
}

function initializeDefaultDocument() {
	if (lastLoadedSource) {
		return;
	}
	startBlankDocument();
}

function reportError(lines) {
	showAlert({ icon: 'stop', lines, buttons: ['OK'] });
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

if (bruteForceEntry) {
	bruteForceEntry.addEventListener('click', () => {
		bruteForceEnabled = !bruteForceEnabled;
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
const selection = createSelection({ canvas, container: canvasContainer });
const toolRegistry = createToolRegistry({ selection });

const patternMenuControl = initPatternMenu(patternMenu, { toolState });
initLineMenu(lineMenu, { toolState });

const editPatternEntry = document.getElementById('menu-options-edit-pattern');
if (editPatternEntry) {
	editPatternEntry.addEventListener('click', async () => {
		const index = Math.max(0, Math.round(toolState.getActivePatternIndex()));
		const edited = await editPatternMask(PATTERN_MASKS[index]);
		if (edited) {
			setPatternMask(index, edited);
			patternMenuControl.refreshPattern(index);
		}
	});
}

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

initZoomBox(document, {
	initialZoom: zoomSetting,
	onZoomChange: setZoom
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

function applyImageTransform(transform) {
	const state = captureEditableBitmapState();
	if (!state) {
		return;
	}
	historyManager.beginTransaction();
	applyHistoryBitmapState(transform(state));
	const { committed, afterState } = historyManager.endTransaction();
	if (committed && afterState) {
		persistBitmapState(afterState, { invalidateSpectrumSession: !spectrum512Enabled });
	}
}

async function confirmAlert(lines) {
	const choice = await showAlert({ icon: 'question', lines, buttons: ['OK', 'Cancel'], defaultIndex: 0, cancelIndex: 1 });
	return choice === 0;
}

initImageCommands({ selection, applyTransform: applyImageTransform, confirmAlert });

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
	onError: reportError,
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
		selection.clear();
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
	getSpuOptions: () => getSpectrumConversionOptions(),
	onError: reportError
});

initializeDefaultDocument();
historyManager.clear();

initInfoBox({
	menuItem: document.getElementById('menu-desk-about'),
	template: document.getElementById('info-box-template')
});

const newMenuItem = document.getElementById('menu-file-new');
if (newMenuItem) {
	newMenuItem.addEventListener('click', async () => {
		const choice = await showAlert({
			icon: 'question',
			lines: ['Clear the picture and start', 'a new one? Changes that have', 'not been saved are lost.'],
			buttons: ['New', 'Cancel'],
			defaultIndex: 1,
			cancelIndex: 1
		});
		if (choice !== 0) {
			return;
		}
		startBlankDocument();
		historyManager.clear();
		selection.clear();
	});
}

initMenuShortcuts([
	{ key: 'o', entry: document.getElementById('menu-file-open') },
	{ key: 's', entry: document.getElementById('menu-file-save') }
]);
