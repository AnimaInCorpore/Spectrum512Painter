import { showForm } from './dialogs.js';

// "Edit pattern" GEM form: the pattern as an enlarged grid. Clicking a cell flips it, and
// dragging paints the value the first cell got. Invert and Clear act on the whole pattern.

const MIN_CELL_SIZE = 16;
const TARGET_GRID_SIZE = 128;

function maskToBits(mask) {
	return mask.rows
		.map(row => row.slice(0, mask.width).padEnd(mask.width, '0'))
		.join('')
		.split('')
		.map(Number);
}

function bitsToMask(bits, width, height) {
	const rows = [];
	for (let y = 0; y < height; y += 1) {
		rows.push(bits.slice(y * width, (y + 1) * width).join(''));
	}
	return { width, height, rows };
}

function createToolButton(label, onClick) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'gem-button';
	button.textContent = label;
	button.addEventListener('click', onClick);
	return button;
}

/**
 * Shows the editor for one pattern mask and resolves with the edited mask, or null when cancelled.
 */
export async function editPatternMask(mask) {
	const { width, height } = mask;
	let bits = maskToBits(mask);
	let paintValue = null;

	const body = document.createElement('div');
	body.className = 'gem-pattern-editor';

	const title = document.createElement('div');
	title.className = 'gem-pattern-editor-title';
	title.textContent = 'Edit pattern';
	body.appendChild(title);

	const grid = document.createElement('div');
	grid.className = 'gem-pattern-editor-grid';
	const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(TARGET_GRID_SIZE / width));
	grid.style.gridTemplateColumns = `repeat(${width}, ${cellSize}px)`;
	const cells = bits.map((_bit, index) => {
		const cell = document.createElement('div');
		cell.className = 'gem-pattern-cell';
		cell.dataset.index = String(index);
		cell.style.width = `${cellSize}px`;
		cell.style.height = `${cellSize}px`;
		grid.appendChild(cell);
		return cell;
	});
	body.appendChild(grid);

	const refresh = () => cells.forEach((cell, index) => cell.classList.toggle('on', bits[index] === 1));
	const cellFromEvent = event => {
		const target = document.elementFromPoint(event.clientX, event.clientY);
		return target && target.classList.contains('gem-pattern-cell') && grid.contains(target) ? Number(target.dataset.index) : -1;
	};

	grid.addEventListener('pointerdown', event => {
		const index = cellFromEvent(event);
		if (index < 0) {
			return;
		}
		paintValue = bits[index] ? 0 : 1;
		bits[index] = paintValue;
		refresh();
		grid.setPointerCapture(event.pointerId);
	});
	grid.addEventListener('pointermove', event => {
		const index = paintValue === null ? -1 : cellFromEvent(event);
		if (index >= 0 && bits[index] !== paintValue) {
			bits[index] = paintValue;
			refresh();
		}
	});
	grid.addEventListener('pointerup', () => {
		paintValue = null;
	});
	grid.addEventListener('pointercancel', () => {
		paintValue = null;
	});

	const tools = document.createElement('div');
	tools.className = 'gem-pattern-editor-tools';
	tools.appendChild(createToolButton('Invert', () => {
		bits = bits.map(bit => (bit ? 0 : 1));
		refresh();
	}));
	tools.appendChild(createToolButton('Clear', () => {
		bits = bits.map(() => 0);
		refresh();
	}));
	body.appendChild(tools);

	refresh();
	const choice = await showForm({ body, buttons: ['OK', 'Cancel'], defaultIndex: 0, cancelIndex: 1, className: 'gem-pattern-editor-form' });
	return choice === 0 ? bitsToMask(bits, width, height) : null;
}
