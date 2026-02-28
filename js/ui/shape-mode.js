function updatePreview(previewBox, previewText, isFilled) {
	if (previewText) {
		previewText.textContent = isFilled ? 'FILL' : 'FRAME';
	}
	if (previewBox) {
		previewBox.style.background = isFilled ? '#000000' : '#ffffff';
	}
}

export function initShapeModeControl(root = document, { toolState } = {}) {
	if (!toolState) {
		return;
	}

	const container = root.querySelector('.gem-preview-container');
	const previewBox = root.querySelector('.gem-preview-box');
	const previewText = root.querySelector('.gem-preview-text');
	if (!container || !previewBox || !previewText) {
		return;
	}

	container.style.cursor = 'pointer';
	container.tabIndex = 0;
	container.setAttribute('role', 'button');
	container.setAttribute('aria-label', 'Toggle Shape Fill Mode');

	const setFilled = value => {
		if (typeof toolState.setShapeFillMode === 'function') {
			toolState.setShapeFillMode(Boolean(value));
		}
	};

	const isFilled = () => {
		if (typeof toolState.getShapeFillMode === 'function') {
			return Boolean(toolState.getShapeFillMode());
		}
		return false;
	};

	const toggle = () => {
		setFilled(!isFilled());
	};

	container.addEventListener('click', () => {
		toggle();
	});
	container.addEventListener('keydown', event => {
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			toggle();
		}
	});

	if (typeof toolState.subscribe === 'function') {
		toolState.subscribe(change => {
			if (!change || change.type !== 'shapeFillMode') {
				return;
			}
			updatePreview(previewBox, previewText, Boolean(change.value));
		});
	}

	updatePreview(previewBox, previewText, isFilled());
}
