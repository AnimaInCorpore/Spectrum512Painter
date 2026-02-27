const MIN_THUMB_SIZE = 16;
const LINE_SCROLL = 16;

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

export function createViewportScroller({ canvas, canvasContainer, verticalScrollbar, horizontalScrollbar }) {
	const vTrack = verticalScrollbar ? verticalScrollbar.querySelector('.gem-sb-track') : null;
	const hTrack = horizontalScrollbar ? horizontalScrollbar.querySelector('.gem-sb-track') : null;
	const vThumb = vTrack ? vTrack.querySelector('.gem-sb-thumb') : null;
	const hThumb = hTrack ? hTrack.querySelector('.gem-sb-thumb') : null;
	const vBtnUp = verticalScrollbar ? verticalScrollbar.querySelector('.gem-sb-btn.up') : null;
	const vBtnDown = verticalScrollbar ? verticalScrollbar.querySelector('.gem-sb-btn.down') : null;
	const hBtnLeft = horizontalScrollbar ? horizontalScrollbar.querySelector('.gem-sb-btn.left') : null;
	const hBtnRight = horizontalScrollbar ? horizontalScrollbar.querySelector('.gem-sb-btn.right') : null;

	let scrollX = 0;
	let scrollY = 0;
	let maxScrollX = 0;
	let maxScrollY = 0;
	let hThumbSize = 0;
	let vThumbSize = 0;

	const updateCanvasOffset = () => {
		canvas.style.left = `${-scrollX}px`;
		canvas.style.top = `${-scrollY}px`;
	};

	const updateScrollbarThumbs = () => {
		if (!hTrack || !vTrack || !hThumb || !vThumb) {
			return;
		}

		const viewportW = canvasContainer.clientWidth;
		const viewportH = canvasContainer.clientHeight;
		const contentW = canvas.width;
		const contentH = canvas.height;
		const hTrackSize = hTrack.clientWidth;
		const vTrackSize = vTrack.clientHeight;

		hThumbSize = (maxScrollX === 0)
			? hTrackSize
			: Math.max(MIN_THUMB_SIZE, Math.round((viewportW / contentW) * hTrackSize));
		vThumbSize = (maxScrollY === 0)
			? vTrackSize
			: Math.max(MIN_THUMB_SIZE, Math.round((viewportH / contentH) * vTrackSize));
		hThumbSize = Math.min(hThumbSize, hTrackSize);
		vThumbSize = Math.min(vThumbSize, vTrackSize);

		const hRange = Math.max(0, hTrackSize - hThumbSize);
		const vRange = Math.max(0, vTrackSize - vThumbSize);
		const hPos = (maxScrollX === 0) ? 0 : Math.round((scrollX / maxScrollX) * hRange);
		const vPos = (maxScrollY === 0) ? 0 : Math.round((scrollY / maxScrollY) * vRange);

		hThumb.style.width = `${hThumbSize}px`;
		hThumb.style.left = `${hPos}px`;
		vThumb.style.height = `${vThumbSize}px`;
		vThumb.style.top = `${vPos}px`;
	};

	const recalcScrollBounds = () => {
		if (!canvasContainer) {
			return;
		}
		maxScrollX = Math.max(0, canvas.width - canvasContainer.clientWidth);
		maxScrollY = Math.max(0, canvas.height - canvasContainer.clientHeight);
		scrollX = clamp(scrollX, 0, maxScrollX);
		scrollY = clamp(scrollY, 0, maxScrollY);
		updateCanvasOffset();
		updateScrollbarThumbs();
	};

	const scrollToPosition = (nextX, nextY) => {
		const clampedX = clamp(Math.round(nextX), 0, maxScrollX);
		const clampedY = clamp(Math.round(nextY), 0, maxScrollY);
		if (clampedX === scrollX && clampedY === scrollY) {
			return;
		}
		scrollX = clampedX;
		scrollY = clampedY;
		updateCanvasOffset();
		updateScrollbarThumbs();
	};

	const scrollBy = (deltaX, deltaY) => {
		scrollToPosition(scrollX + deltaX, scrollY + deltaY);
	};

	const beginThumbDrag = (axis, event) => {
		event.preventDefault();
		const startClient = (axis === 'x') ? event.clientX : event.clientY;
		const startScroll = (axis === 'x') ? scrollX : scrollY;
		const trackSize = (axis === 'x') ? hTrack.clientWidth : vTrack.clientHeight;
		const thumbSize = (axis === 'x') ? hThumbSize : vThumbSize;
		const scrollMax = (axis === 'x') ? maxScrollX : maxScrollY;
		const dragRange = Math.max(1, trackSize - thumbSize);

		const onMove = moveEvent => {
			const currentClient = (axis === 'x') ? moveEvent.clientX : moveEvent.clientY;
			const delta = currentClient - startClient;
			if (scrollMax === 0) {
				return;
			}
			const nextScroll = startScroll + (delta / dragRange) * scrollMax;
			if (axis === 'x') {
				scrollToPosition(nextScroll, scrollY);
				return;
			}
			scrollToPosition(scrollX, nextScroll);
		};

		const onUp = () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	};

	const setupEvents = () => {
		if (!hTrack || !vTrack || !hThumb || !vThumb || !canvasContainer) {
			return;
		}

		if (vBtnUp) {
			vBtnUp.addEventListener('click', () => scrollBy(0, -LINE_SCROLL));
		}
		if (vBtnDown) {
			vBtnDown.addEventListener('click', () => scrollBy(0, LINE_SCROLL));
		}
		if (hBtnLeft) {
			hBtnLeft.addEventListener('click', () => scrollBy(-LINE_SCROLL, 0));
		}
		if (hBtnRight) {
			hBtnRight.addEventListener('click', () => scrollBy(LINE_SCROLL, 0));
		}

		vTrack.addEventListener('mousedown', event => {
			if (event.target === vThumb) {
				return;
			}
			const rect = vTrack.getBoundingClientRect();
			const clickY = event.clientY - rect.top;
			const thumbTop = vThumb.offsetTop;
			const pageStep = Math.max(1, canvasContainer.clientHeight - LINE_SCROLL);
			scrollBy(0, clickY < thumbTop ? -pageStep : pageStep);
		});

		hTrack.addEventListener('mousedown', event => {
			if (event.target === hThumb) {
				return;
			}
			const rect = hTrack.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			const thumbLeft = hThumb.offsetLeft;
			const pageStep = Math.max(1, canvasContainer.clientWidth - LINE_SCROLL);
			scrollBy(clickX < thumbLeft ? -pageStep : pageStep, 0);
		});

		hThumb.addEventListener('mousedown', event => beginThumbDrag('x', event));
		vThumb.addEventListener('mousedown', event => beginThumbDrag('y', event));

		canvasContainer.addEventListener('wheel', event => {
			if (maxScrollX === 0 && maxScrollY === 0) {
				return;
			}
			event.preventDefault();
			scrollBy(event.deltaX, event.deltaY);
		}, { passive: false });

		window.addEventListener('resize', recalcScrollBounds);
	};

	setupEvents();
	recalcScrollBounds();

	return {
		recalcScrollBounds,
		resetPosition() {
			scrollX = 0;
			scrollY = 0;
			recalcScrollBounds();
		},
		getVisibleRect() {
			return {
				x: scrollX,
				y: scrollY,
				width: canvasContainer.clientWidth,
				height: canvasContainer.clientHeight
			};
		}
	};
}
