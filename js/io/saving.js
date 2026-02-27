import { encodeSpectrumSpu } from '../formats/spectrum-spu.js';

function normalizeExtension(fileName, extension) {
	const trimmed = (fileName || '').trim();
	if (!trimmed) {
		return `UNTITLED.${extension}`;
	}
	const ext = `.${extension.toLowerCase()}`;
	return trimmed.toLowerCase().endsWith(ext) ? trimmed : `${trimmed}.${extension}`;
}

function downloadCanvas(canvas, fileName) {
	const link = document.createElement('a');
	link.href = canvas.toDataURL('image/png');
	link.download = fileName;
	link.click();
}

function downloadBinary(bytes, fileName, mimeType = 'application/octet-stream') {
	const blob = new Blob([bytes], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function saveSpu({ getBaseFileName, getSpuSourceCanvas, getSpuOptions, promptForName = false }) {
	const sourceCanvas = typeof getSpuSourceCanvas === 'function' ? getSpuSourceCanvas() : null;
	if (!sourceCanvas) {
		window.alert('No canvas available for SPU save.');
		return;
	}

	const options = typeof getSpuOptions === 'function' ? getSpuOptions() : {};
	const bytes = encodeSpectrumSpu({
		sourceCanvas,
		bitsPerColor: options.bitsPerColor,
		ditherPattern: options.ditherPattern || null
	});

	const defaultName = normalizeExtension(
		typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED',
		'spu'
	);
	const entered = promptForName ? window.prompt('Save SPU as:', defaultName) : defaultName;
	if (!entered) {
		return;
	}
	const fileName = normalizeExtension(entered, 'spu');
	downloadBinary(bytes, fileName);
}

export function setupFileSaving({
	canvas,
	saveMenuItem,
	saveAsMenuItem,
	exportMenuItem,
	getBaseFileName,
	getSpuSourceCanvas,
	getSpuOptions
}) {
	const downloadPngDefault = () => {
		const baseName = typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED';
		downloadCanvas(canvas, `${baseName}.png`);
	};

	if (saveMenuItem) {
		saveMenuItem.addEventListener('click', () => {
			saveSpu({
				getBaseFileName,
				getSpuSourceCanvas,
				getSpuOptions
			});
		});
	}

	if (saveAsMenuItem) {
		saveAsMenuItem.addEventListener('click', () => {
			saveSpu({
				getBaseFileName,
				getSpuSourceCanvas,
				getSpuOptions,
				promptForName: true
			});
		});
	}

	if (exportMenuItem) {
		exportMenuItem.addEventListener('click', () => {
			downloadPngDefault();
		});
	}
}
