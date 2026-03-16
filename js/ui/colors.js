function colorToCss(color) {
	return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function colorsEqual(a, b) {
	return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function createColorLabel(color, index) {
	return `Color ${index + 1} (${color[0]}, ${color[1]}, ${color[2]})`;
}

function createColorTile(color, index, onSelect, onBackgroundSelect) {
	const tile = document.createElement('button');
	tile.type = 'button';
	tile.className = 'gem-color-tile';
	tile.setAttribute('aria-label', createColorLabel(color, index));
	tile.title = createColorLabel(color, index);

	const fill = document.createElement('span');
	fill.className = 'gem-color-tile-fill';
	fill.style.background = colorToCss(color);
	tile.appendChild(fill);

	tile.addEventListener('click', onSelect);
	tile.addEventListener('contextmenu', event => {
		event.preventDefault();
		onBackgroundSelect();
	});

	return tile;
}

export function initColorPalette({ colorGrid, foregroundSwatch, backgroundSwatch, colors, toolState }) {
	if (!colorGrid || !toolState || !Array.isArray(colors) || colors.length === 0) {
		return;
	}

	const updateSwatches = () => {
		const foreground = toolState.getForegroundColor();
		const background = toolState.getBackgroundColor();
		if (foregroundSwatch) {
			foregroundSwatch.style.background = colorToCss(foreground);
		}
		if (backgroundSwatch) {
			backgroundSwatch.style.background = colorToCss(background);
		}
	};

	const updateActiveTile = () => {
		const foreground = toolState.getForegroundColor();
		const tiles = colorGrid.querySelectorAll('.gem-color-tile');
		tiles.forEach((tile, index) => {
			const isActive = colorsEqual(colors[index], foreground);
			tile.classList.toggle('active', isActive);
		});
	};

	const renderTiles = () => {
		colors.forEach((color, index) => {
			const tile = createColorTile(
				color,
				index,
				() => {
				toolState.setForegroundColor(color);
				updateSwatches();
				updateActiveTile();
				},
				() => {
				toolState.setBackgroundColor(color);
				updateSwatches();
				}
			);
			colorGrid.appendChild(tile);
		});
	};

	renderTiles();
	updateSwatches();
	updateActiveTile();

	if (typeof toolState.subscribe === 'function') {
		toolState.subscribe(change => {
			if (!change || typeof change.type !== 'string') {
				return;
			}
			if (change.type === 'foregroundColor') {
				updateSwatches();
				updateActiveTile();
				return;
			}
			if (change.type === 'backgroundColor') {
				updateSwatches();
			}
		});
	}
}
