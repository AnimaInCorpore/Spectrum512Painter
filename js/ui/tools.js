export function initToolSelection(root = document, { onToolChange, onZoomToggle } = {}) {
	const toolButtons = Array.from(root.querySelectorAll('.gem-tool-btn'));
	const zoomButton = toolButtons.find(button => button.dataset.tool === 'zoom') || null;
	const drawingButtons = toolButtons.filter(button => button !== zoomButton);

	const notifySelectedTool = button => {
		if (typeof onToolChange === 'function' && button && button.dataset.tool) {
			onToolChange(button.dataset.tool);
		}
	};
	const notifyZoomState = enabled => {
		if (typeof onZoomToggle === 'function') {
			onZoomToggle(Boolean(enabled));
		}
	};

	const initialDrawingButton = drawingButtons.find(button => button.classList.contains('active')) || drawingButtons[0] || null;
	if (initialDrawingButton) {
		drawingButtons.forEach(button => button.classList.toggle('active', button === initialDrawingButton));
		notifySelectedTool(initialDrawingButton);
	}
	if (zoomButton) {
		notifyZoomState(zoomButton.classList.contains('active'));
	}

	drawingButtons.forEach(button => {
		button.addEventListener('click', function() {
			drawingButtons.forEach(otherButton => otherButton.classList.remove('active'));
			button.classList.add('active');
			notifySelectedTool(button);
		});
	});

	if (zoomButton) {
		zoomButton.addEventListener('click', () => {
			const enabled = !zoomButton.classList.contains('active');
			zoomButton.classList.toggle('active', enabled);
			notifyZoomState(enabled);
		});
	}
}
