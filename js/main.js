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

const patternsGrid = document.getElementById('patterns-grid');
const menuRoot = document.querySelector('.menu-left');
const canvas = document.getElementById('paint');
const titleElement = document.querySelector('.gem-titlebar-name');

const canvasDocument = createCanvasDocument({
	canvas,
	titleElement
});

initPatternPalette(patternsGrid, PATTERN_CLASSES);
initGemMenus({ menuRoot });

const viewportScroller = createViewportScroller({
	canvas,
	canvasContainer: document.querySelector('.gem-canvas-container'),
	verticalScrollbar: document.querySelector('.gem-scrollbar.vertical'),
	horizontalScrollbar: document.querySelector('.gem-scrollbar.horizontal')
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
		canvasDocument.setImage({ image, fileName });
		viewportScroller.resetPosition();
	},
	onBitmapLoaded: ({ width, height, pixels, fileName }) => {
		canvasDocument.setPixelBuffer({ width, height, pixels, fileName });
		viewportScroller.resetPosition();
	}
});

setupFileSaving({
	canvas,
	saveMenuItem: document.getElementById('menu-file-save'),
	saveAsMenuItem: document.getElementById('menu-file-save-as'),
	exportMenuItem: document.getElementById('menu-file-export'),
	getBaseFileName: canvasDocument.getDownloadBaseName
});
