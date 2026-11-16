import { setMenuEntryChecked } from './menus.js';

// GEM Draw "Line" menu: line widths are listed as drawn samples with a check mark on
// the current width.

const MIN_LINE_SIZE = 1;
const MAX_LINE_SIZE = 8;

function createWidthEntry(size) {
	const entry = document.createElement('button');
	entry.type = 'button';
	entry.className = 'gem-menu-entry gem-line-width-entry';
	entry.dataset.lineSize = String(size);
	entry.setAttribute('role', 'menuitemradio');
	entry.setAttribute('aria-label', `Line width ${size}`);

	const sample = document.createElement('span');
	sample.className = 'gem-line-sample';
	sample.style.height = `${size}px`;
	entry.appendChild(sample);
	return entry;
}

export function initLineMenu(container, { toolState } = {}) {
	if (!container || !toolState) {
		return;
	}

	const entries = [];
	for (let size = MIN_LINE_SIZE; size <= MAX_LINE_SIZE; size += 1) {
		const entry = createWidthEntry(size);
		entry.addEventListener('click', () => toolState.setLineSize(size));
		container.appendChild(entry);
		entries.push(entry);
	}

	const render = size => {
		entries.forEach(entry => setMenuEntryChecked(entry, Number(entry.dataset.lineSize) === size));
	};

	render(Math.round(toolState.getLineSize()));
	toolState.subscribe(change => {
		if (change && change.type === 'lineSize') {
			render(Math.round(change.value));
		}
	});
}
