function downloadCanvas(canvas, fileName) {
	const link = document.createElement('a');
	link.href = canvas.toDataURL('image/png');
	link.download = fileName;
	link.click();
}

export function setupFileSaving({ canvas, saveMenuItem, saveAsMenuItem, exportMenuItem, getBaseFileName }) {
	const downloadDefault = () => {
		const baseName = typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED';
		downloadCanvas(canvas, `${baseName}.png`);
	};

	if (saveMenuItem) {
		saveMenuItem.addEventListener('click', () => {
			downloadDefault();
		});
	}

	if (saveAsMenuItem) {
		saveAsMenuItem.addEventListener('click', () => {
			const suggested = `${(typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED')}.png`;
			const entered = window.prompt('Save bitmap as:', suggested);
			if (!entered) {
				return;
			}
			const normalized = entered.toLowerCase().endsWith('.png') ? entered : `${entered}.png`;
			downloadCanvas(canvas, normalized);
		});
	}

	if (exportMenuItem) {
		exportMenuItem.addEventListener('click', () => {
			downloadDefault();
		});
	}
}
