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
	createSpectrumCanvas,
	SPECTRUM_CANVAS_WIDTH,
	SPECTRUM_CANVAS_HEIGHT
} from './imaging/spectrum.js';

function createSpectrumBitmapBuffer({ width, height, pixels }) {
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = width;
	tempCanvas.height = height;

	const tempContext = tempCanvas.getContext('2d');
	tempContext.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);

	const spectrumCanvas = createSpectrumCanvas(tempCanvas);
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
let spectrum512Enabled = false;
let lastLoadedSource = null;

const updateSpectrumEntry = () => {
	if (!spectrumToggleEntry) {
		return;
	}
	spectrumToggleEntry.textContent = `Spectrum 512 ${spectrum512Enabled ? 'On' : 'Off'}`;
	spectrumToggleEntry.setAttribute('aria-pressed', String(spectrum512Enabled));
};

const toggleSpectrum512 = () => {
	spectrum512Enabled = !spectrum512Enabled;
	updateSpectrumEntry();
	renderLoadedSource();
};

if (spectrumToggleEntry) {
	spectrumToggleEntry.addEventListener('click', () => {
		toggleSpectrum512();
	});
}
updateSpectrumEntry();

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
			? createSpectrumCanvas(lastLoadedSource.image)
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
		? createSpectrumBitmapBuffer(lastLoadedSource.bitmap)
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
