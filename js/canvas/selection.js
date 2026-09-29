// Rectangular selection state plus a dashed GEM-style marquee outline over the canvas.
export function createSelection({ canvas, container }) {
	const outline = document.createElement('div');
	outline.className = 'gem-marquee';
	outline.hidden = true;
	container.appendChild(outline);

	const listeners = new Set();
	let rect = null;

	const layoutOutline = () => {
		if (!rect) {
			outline.hidden = true;
			return;
		}
		const scaleX = canvas.clientWidth / canvas.width;
		const scaleY = canvas.clientHeight / canvas.height;
		outline.style.left = `${canvas.offsetLeft + rect.x * scaleX}px`;
		outline.style.top = `${canvas.offsetTop + rect.y * scaleY}px`;
		outline.style.width = `${rect.width * scaleX}px`;
		outline.style.height = `${rect.height * scaleY}px`;
		outline.hidden = false;
	};

	const emit = () => {
		layoutOutline();
		listeners.forEach(listener => listener(rect));
	};

	// Follow scrolling (style left/top) and zoom (style width/height) of the canvas.
	new MutationObserver(layoutOutline).observe(canvas, { attributes: true, attributeFilter: ['style', 'width', 'height'] });
	window.addEventListener('resize', layoutOutline);

	const clampRect = (x0, y0, x1, y1) => {
		const left = Math.max(0, Math.min(canvas.width, Math.min(x0, x1)));
		const top = Math.max(0, Math.min(canvas.height, Math.min(y0, y1)));
		const right = Math.max(0, Math.min(canvas.width, Math.max(x0, x1) + 1));
		const bottom = Math.max(0, Math.min(canvas.height, Math.max(y0, y1) + 1));
		return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
	};

	return {
		get rect() {
			return rect ? { ...rect } : null;
		},
		// Selects the inclusive pixel range between two canvas points.
		setFromPoints(a, b) {
			rect = clampRect(a.x, a.y, b.x, b.y);
			emit();
		},
		selectAll() {
			rect = { x: 0, y: 0, width: canvas.width, height: canvas.height };
			emit();
		},
		clear() {
			if (rect) {
				rect = null;
				emit();
			}
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
}
