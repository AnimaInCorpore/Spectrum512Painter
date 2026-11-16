import { PATTERN_MASKS } from '../config/patterns.js';
import { patternSwatchDataUrl } from './bitmap-icons.js';
import { setMenuEntryChecked } from './menus.js';

// GEM Draw "Pattern" menu: fill patterns are listed as swatches in columns. "None" draws
// shapes as outlines only; choosing a pattern fills shapes with it. Paint tools (bucket,
// brush, spray) always use the last pattern chosen.

const SWATCH_WIDTH = 48;
const SWATCH_HEIGHT = 14;

function createEntry(label) {
	const entry = document.createElement('button');
	entry.type = 'button';
	entry.className = 'gem-menu-entry gem-pattern-entry';
	entry.setAttribute('role', 'menuitemradio');
	entry.setAttribute('aria-label', label);
	const swatch = document.createElement('span');
	swatch.className = 'gem-pattern-swatch';
	entry.appendChild(swatch);
	return { entry, swatch };
}

function createNoneEntry() {
	const { entry, swatch } = createEntry('None');
	swatch.classList.add('none');
	swatch.textContent = 'None';
	return entry;
}

function createPatternEntry(pattern, index) {
	const { entry, swatch } = createEntry(`Pattern ${index + 1}`);
	swatch.style.backgroundImage = `url(${patternSwatchDataUrl(pattern, SWATCH_WIDTH, SWATCH_HEIGHT)})`;
	return entry;
}

export function initPatternMenu(container, { toolState } = {}) {
	if (!container || !toolState) {
		return;
	}

	const noneEntry = createNoneEntry();
	noneEntry.addEventListener('click', () => toolState.setShapeFillMode(false));
	container.appendChild(noneEntry);

	const patternEntries = PATTERN_MASKS.map((pattern, index) => {
		const entry = createPatternEntry(pattern, index);
		entry.addEventListener('click', () => {
			toolState.setActivePatternIndex(index);
			toolState.setShapeFillMode(true);
		});
		container.appendChild(entry);
		return entry;
	});

	const render = () => {
		const filled = Boolean(toolState.getShapeFillMode());
		const activeIndex = Math.round(toolState.getActivePatternIndex());
		setMenuEntryChecked(noneEntry, !filled);
		patternEntries.forEach((entry, index) => setMenuEntryChecked(entry, filled && index === activeIndex));
	};

	render();
	toolState.subscribe(change => {
		if (change && (change.type === 'shapeFillMode' || change.type === 'activePatternIndex')) {
			render();
		}
	});
}
