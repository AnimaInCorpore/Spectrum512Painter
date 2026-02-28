export function createCanvasPreviewSession(api) {
	if (!api || !api.context || !api.canvas) {
		return null;
	}
	try {
		return {
			baseImageData: api.context.getImageData(0, 0, api.canvas.width, api.canvas.height)
		};
	} catch (_error) {
		return null;
	}
}

export function renderCanvasPreview(api, session, drawFn) {
	if (!api || typeof drawFn !== 'function') {
		return;
	}
	if (session && session.baseImageData) {
		api.context.putImageData(session.baseImageData, 0, 0);
	}
	drawFn();
}
