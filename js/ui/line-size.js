const MIN_LINE_SIZE = 1;
const MAX_LINE_SIZE = 8;

function clampLineSize(value) {
	return Math.max(MIN_LINE_SIZE, Math.min(MAX_LINE_SIZE, Math.round(value)));
}

function elementWidth(element) {
	if (!element) {
		return 0;
	}
	return element.getBoundingClientRect().width;
}

function elementHeight(element) {
	if (!element) {
		return 0;
	}
	return element.getBoundingClientRect().height;
}

export function initLineSizeSlider(root = document, { toolState } = {}) {
	if (!toolState) {
		return;
	}

	const container = root.querySelector('.gem-slider-container');
	const track = container ? container.querySelector('.gem-slider-track') : null;
	const thumb = track ? track.querySelector('.gem-slider-thumb') : null;
	const valueLabel = container ? container.querySelector('.gem-slider-value') : null;
	if (!container || !track || !thumb || !valueLabel) {
		return;
	}

	container.tabIndex = 0;
	container.setAttribute('role', 'slider');
	container.setAttribute('aria-valuemin', String(MIN_LINE_SIZE));
	container.setAttribute('aria-valuemax', String(MAX_LINE_SIZE));
	container.setAttribute('aria-label', 'Line Size');

	const setLineSize = nextSize => {
		if (typeof toolState.setLineSize === 'function') {
			toolState.setLineSize(clampLineSize(nextSize));
		}
	};

	const getLineSize = () => {
		if (typeof toolState.getLineSize === 'function') {
			return clampLineSize(toolState.getLineSize());
		}
		return MIN_LINE_SIZE;
	};

	const render = size => {
		const clampedSize = clampLineSize(size);
		const trackHeight = elementHeight(track);
		const thumbHeight = elementHeight(thumb);
		const maxOffset = Math.max(0, trackHeight - thumbHeight);
		const ratio = (clampedSize - MIN_LINE_SIZE) / (MAX_LINE_SIZE - MIN_LINE_SIZE);
		thumb.style.top = `${Math.round(maxOffset * (1 - ratio))}px`;
		valueLabel.textContent = String(clampedSize);
		container.setAttribute('aria-valuenow', String(clampedSize));
		container.setAttribute('aria-valuetext', `${clampedSize} pixel${clampedSize === 1 ? '' : 's'}`);
	};

	const sizeFromPointerY = pointerY => {
		const rect = track.getBoundingClientRect();
		const thumbHeight = elementHeight(thumb);
		const halfThumb = thumbHeight / 2;
		const minCenter = rect.top + halfThumb;
		const maxCenter = rect.bottom - halfThumb;
		const usableHeight = Math.max(1, maxCenter - minCenter);
		const clampedCenter = Math.max(minCenter, Math.min(maxCenter, pointerY));
		const ratio = (maxCenter - clampedCenter) / usableHeight;
		return clampLineSize(MIN_LINE_SIZE + ratio * (MAX_LINE_SIZE - MIN_LINE_SIZE));
	};

	let dragActive = false;

	const onPointerMove = event => {
		if (!dragActive) {
			return;
		}
		event.preventDefault();
		setLineSize(sizeFromPointerY(event.clientY));
	};

	const onPointerUp = () => {
		dragActive = false;
		document.removeEventListener('mousemove', onPointerMove);
		document.removeEventListener('mouseup', onPointerUp);
	};

	const beginDrag = event => {
		event.preventDefault();
		dragActive = true;
		setLineSize(sizeFromPointerY(event.clientY));
		document.addEventListener('mousemove', onPointerMove);
		document.addEventListener('mouseup', onPointerUp);
	};

	track.addEventListener('mousedown', event => {
		if (event.target === thumb) {
			return;
		}
		beginDrag(event);
	});
	thumb.addEventListener('mousedown', event => {
		event.stopPropagation();
		beginDrag(event);
	});

	container.addEventListener('keydown', event => {
		const current = getLineSize();
		if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
			event.preventDefault();
			setLineSize(current - 1);
			return;
		}
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
			event.preventDefault();
			setLineSize(current + 1);
		}
	});

	window.addEventListener('resize', () => {
		render(getLineSize());
	});

	if (typeof toolState.subscribe === 'function') {
		toolState.subscribe(change => {
			if (!change || change.type !== 'lineSize') {
				return;
			}
			render(change.value);
		});
	}

	render(getLineSize());
}
