export function initPatternPalette(patternsGrid, patternClasses) {
	if (!patternsGrid) {
		return;
	}

	patternClasses.forEach((patternClass, index) => {
		const tile = document.createElement('div');
		tile.className = 'gem-pattern';

		const sprite = document.createElement('div');
		sprite.className = patternClass;
		tile.appendChild(sprite);

		if (index === 0) {
			tile.classList.add('active');
		}

		tile.addEventListener('click', function() {
			patternsGrid.querySelectorAll('.gem-pattern').forEach(pattern => {
				pattern.classList.remove('active');
			});
			tile.classList.add('active');
		});

		patternsGrid.appendChild(tile);
	});
}
