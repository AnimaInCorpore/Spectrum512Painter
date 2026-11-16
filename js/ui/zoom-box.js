import { MAGNIFICATION_ICON } from '../config/gem-icons.js';
import { applyBitmap } from './bitmap-icons.js';

// GEM Draw magnification box: "Full" fits the picture into the window, the other states
// are fixed magnifications. Exactly one state is selected (shown inverted).

export const ZOOM_FULL = 'full';

function parseZoomValue(value) {
	if (value === ZOOM_FULL) {
		return ZOOM_FULL;
	}
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : ZOOM_FULL;
}

export function initZoomBox(root = document, { initialZoom = ZOOM_FULL, onZoomChange } = {}) {
	const icon = root.querySelector('.gem-magnification-icon');
	if (icon) {
		applyBitmap(icon, MAGNIFICATION_ICON);
	}

	const buttons = Array.from(root.querySelectorAll('.gem-zoom-btn'));
	const select = (zoom, { notify = true } = {}) => {
		buttons.forEach(button => {
			const active = parseZoomValue(button.dataset.zoom) === zoom;
			button.classList.toggle('active', active);
			button.setAttribute('aria-pressed', String(active));
		});
		if (notify && typeof onZoomChange === 'function') {
			onZoomChange(zoom);
		}
	};

	buttons.forEach(button => {
		button.addEventListener('click', () => select(parseZoomValue(button.dataset.zoom)));
	});

	select(parseZoomValue(initialZoom), { notify: false });
	return { setZoom: zoom => select(parseZoomValue(zoom), { notify: false }) };
}
