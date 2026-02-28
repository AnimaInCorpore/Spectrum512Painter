import { canvasPointFromMouse } from './helpers/geometry.js';

export function createToolController({ canvas, toolState, toolRegistry, context, getVisibleRect }) {
	let activeSession = null;
	let activeTool = null;
	const resolveCanvas = () => {
		if (typeof api.getCanvas === 'function') {
			return api.getCanvas();
		}
		return canvas;
	};
	const resolveContext = () => {
		if (typeof api.getContext === 'function') {
			return api.getContext();
		}
		return context;
	};

	const api = {
		get canvas() {
			return resolveCanvas();
		},
		get context() {
			return resolveContext();
		},
		get foregroundColor() {
			return toolState.getForegroundColor();
		},
		get backgroundColor() {
			return toolState.getBackgroundColor();
		},
		get lineSize() {
			return typeof toolState.getLineSize === 'function' ? toolState.getLineSize() : 1;
		},
		get shapeFillMode() {
			return typeof toolState.getShapeFillMode === 'function' ? toolState.getShapeFillMode() : false;
		},
		setForegroundColor(color) {
			toolState.setForegroundColor(color);
		},
		setBackgroundColor(color) {
			toolState.setBackgroundColor(color);
		},
		setLineSize(size) {
			if (typeof toolState.setLineSize === 'function') {
				toolState.setLineSize(size);
			}
		},
		setShapeFillMode(enabled) {
			if (typeof toolState.setShapeFillMode === 'function') {
				toolState.setShapeFillMode(enabled);
			}
		},
		getCanvas: null,
		getContext: null,
		getVisibleRect
	};

	const resolveTool = () => {
		const toolId = toolState.getActiveTool();
		return toolRegistry[toolId] || null;
	};

	const onMouseDown = event => {
		if (event.button !== 0) {
			return;
		}
		activeTool = resolveTool();
		if (!activeTool || typeof activeTool.onPointerDown !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, resolveCanvas());
		activeSession = activeTool.onPointerDown({ api, event, point }) || null;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

	const onMouseMove = event => {
		if (!activeTool || typeof activeTool.onPointerMove !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, resolveCanvas());
		activeTool.onPointerMove({ api, event, point, session: activeSession });
	};

	const onMouseUp = event => {
		if (activeTool && typeof activeTool.onPointerUp === 'function') {
			const point = canvasPointFromMouse(event, resolveCanvas());
			activeTool.onPointerUp({ api, event, point, session: activeSession });
		}
		activeSession = null;
		activeTool = null;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	const onDoubleClick = event => {
		const tool = resolveTool();
		if (!tool || typeof tool.onDoubleClick !== 'function') {
			return;
		}
		const point = canvasPointFromMouse(event, resolveCanvas());
		tool.onDoubleClick({ api, event, point });
	};

	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('dblclick', onDoubleClick);

	return {
		setCanvasResolver(resolver) {
			api.getCanvas = typeof resolver === 'function' ? resolver : null;
		},
		setContextResolver(resolver) {
			api.getContext = typeof resolver === 'function' ? resolver : null;
		},
		dispose() {
			canvas.removeEventListener('mousedown', onMouseDown);
			canvas.removeEventListener('dblclick', onDoubleClick);
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}
	};
}
