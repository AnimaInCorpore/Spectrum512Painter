import { PATTERN_MASKS, setPatternMask } from '../config/patterns.js';

const TILE_SIZE = 31;

function updateActiveTile(tiles, activeIndex) {
	tiles.forEach((tile, index) => {
		tile.classList.toggle('active', index === activeIndex);
	});
}

// Draws the mask tiled across a tile-sized canvas and returns it as a data URL.
function renderMaskTile(mask) {
	const tileCanvas = document.createElement('canvas');
	tileCanvas.width = TILE_SIZE;
	tileCanvas.height = TILE_SIZE;
	const context = tileCanvas.getContext('2d');
	context.fillStyle = '#000';
	for (let y = 0; y < TILE_SIZE; y += 1) {
		const row = mask.rows[y % mask.height] || '';
		for (let x = 0; x < TILE_SIZE; x += 1) {
			if (row.charCodeAt(x % mask.width) === 49) {
				context.fillRect(x, y, 1, 1);
			}
		}
	}
	return tileCanvas.toDataURL();
}

function paintGeneratedTile(tile, mask) {
	tile.textContent = '';
	tile.style.backgroundColor = '#fff';
	tile.style.backgroundImage = `url(${renderMaskTile(mask)})`;
}

export function initPatternPalette(patternsGrid, patternClasses, { toolState, editPattern } = {}) {
	if (!patternsGrid) {
		return;
	}

	const tiles = [];
	const setPatternIndex = index => {
		if (toolState && typeof toolState.setActivePatternIndex === 'function') {
			toolState.setActivePatternIndex(index);
		}
		updateActiveTile(tiles, index);
	};

	const editPatternAt = async index => {
		if (typeof editPattern !== 'function') {
			return;
		}
		const edited = await editPattern(PATTERN_MASKS[index]);
		if (edited) {
			setPatternMask(index, edited);
			paintGeneratedTile(tiles[index], edited);
		}
	};

	PATTERN_MASKS.forEach((mask, index) => {
		const tile = document.createElement('div');
		tile.className = 'gem-pattern';
		tile.title = 'Double-click to edit pattern';

		if (patternClasses[index]) {
			const sprite = document.createElement('div');
			sprite.className = patternClasses[index];
			tile.appendChild(sprite);
		} else {
			paintGeneratedTile(tile, mask);
		}

		tile.addEventListener('click', () => setPatternIndex(index));
		tile.addEventListener('dblclick', () => {
			setPatternIndex(index);
			editPatternAt(index);
		});

		patternsGrid.appendChild(tile);
		tiles.push(tile);
	});

	const initialPatternIndex = toolState && typeof toolState.getActivePatternIndex === 'function'
		? Math.max(0, Math.round(toolState.getActivePatternIndex()))
		: 0;
	updateActiveTile(tiles, initialPatternIndex);

	if (toolState && typeof toolState.subscribe === 'function') {
		toolState.subscribe(change => {
			if (!change || change.type !== 'activePatternIndex') {
				return;
			}
			updateActiveTile(tiles, Math.max(0, Math.round(change.value || 0)));
		});
	}

	return { editActivePattern: () => editPatternAt(toolState.getActivePatternIndex()) };
}
