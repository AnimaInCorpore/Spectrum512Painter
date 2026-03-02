function updateActiveTile(tiles, activeIndex) {
	tiles.forEach((tile, index) => {
		tile.classList.toggle('active', index === activeIndex);
	});
}

export function initPatternPalette(patternsGrid, patternClasses, { toolState } = {}) {
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

	patternClasses.forEach((patternClass, index) => {
		const tile = document.createElement('div');
		tile.className = 'gem-pattern';

		const sprite = document.createElement('div');
		sprite.className = patternClass;
		tile.appendChild(sprite);

		tile.addEventListener('click', function() {
			setPatternIndex(index);
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
}
