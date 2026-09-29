// Modal dialog for editing one pattern mask by clicking/dragging on an enlarged grid.
const MIN_CELL_SIZE = 16;
const TARGET_GRID_SIZE = 128;

function cloneRows(mask) {
	return mask.rows.map(row => row.slice(0, mask.width).padEnd(mask.width, '0'));
}

export function initPatternEditor() {
	const overlay = document.getElementById('pattern-editor-overlay');
	const gridHost = document.getElementById('pattern-editor-grid');
	const okButton = document.getElementById('pattern-editor-ok');
	const cancelButton = document.getElementById('pattern-editor-cancel');
	const invertButton = document.getElementById('pattern-editor-invert');
	const clearButton = document.getElementById('pattern-editor-clear');
	let bits = [];
	let size = { width: 8, height: 8 };
	let paintValue = null;
	let pending = null;
	let cells = [];

	const refresh = () => {
		cells.forEach((cell, i) => {
			cell.classList.toggle('on', bits[i] === 1);
		});
	};

	const setCell = (index, value) => {
		if (bits[index] !== value) {
			bits[index] = value;
			refresh();
		}
	};

	const buildGrid = () => {
		gridHost.textContent = '';
		const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(TARGET_GRID_SIZE / size.width));
		gridHost.style.gridTemplateColumns = `repeat(${size.width}, ${cellSize}px)`;
		cells = bits.map((_bit, index) => {
			const cell = document.createElement('div');
			cell.className = 'gem-pattern-cell';
			cell.dataset.index = String(index);
			cell.style.width = `${cellSize}px`;
			cell.style.height = `${cellSize}px`;
			gridHost.appendChild(cell);
			return cell;
		});
	};

	const finish = mask => {
		overlay.classList.remove('open');
		const resolve = pending;
		pending = null;
		paintValue = null;
		if (resolve) {
			resolve(mask);
		}
	};

	const cellFromEvent = event => {
		const target = document.elementFromPoint(event.clientX, event.clientY);
		return target && target.classList.contains('gem-pattern-cell') ? Number(target.dataset.index) : -1;
	};

	gridHost.addEventListener('pointerdown', event => {
		const index = cellFromEvent(event);
		if (index < 0) {
			return;
		}
		paintValue = bits[index] ? 0 : 1;
		setCell(index, paintValue);
		gridHost.setPointerCapture(event.pointerId);
	});
	gridHost.addEventListener('pointermove', event => {
		if (paintValue === null) {
			return;
		}
		const index = cellFromEvent(event);
		if (index >= 0) {
			setCell(index, paintValue);
		}
	});
	const stopPainting = () => {
		paintValue = null;
	};
	gridHost.addEventListener('pointerup', stopPainting);
	gridHost.addEventListener('pointercancel', stopPainting);

	invertButton.addEventListener('click', () => {
		bits = bits.map(bit => (bit ? 0 : 1));
		refresh();
	});
	clearButton.addEventListener('click', () => {
		bits = bits.map(() => 0);
		refresh();
	});
	okButton.addEventListener('click', () => {
		const rows = [];
		for (let y = 0; y < size.height; y += 1) {
			rows.push(bits.slice(y * size.width, (y + 1) * size.width).join(''));
		}
		finish({ width: size.width, height: size.height, rows });
	});
	cancelButton.addEventListener('click', () => finish(null));
	document.addEventListener('keydown', event => {
		if (pending && event.key === 'Escape') {
			event.preventDefault();
			finish(null);
		}
	}, true);

	// Resolves with the edited mask, or null when cancelled.
	return function editPattern(mask) {
		if (pending) {
			finish(null);
		}
		size = { width: mask.width, height: mask.height };
		bits = cloneRows(mask).join('').split('').map(Number);
		buildGrid();
		refresh();
		overlay.classList.add('open');
		return new Promise(resolve => {
			pending = resolve;
		});
	};
}
