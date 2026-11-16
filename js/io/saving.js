import { encodeSpectrumSpu } from '../formats/spectrum-spu.js';

function replaceExtension(fileName, extension) {
	const trimmed = (fileName || '').trim();
	if (!trimmed) {
		return `UNTITLED.${extension}`;
	}

	const dotIndex = trimmed.lastIndexOf('.');
	if (dotIndex > 0) {
		return `${trimmed.slice(0, dotIndex)}.${extension}`;
	}
	return `${trimmed}.${extension}`;
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

function saveSpu({
	getBaseFileName,
	getSpuFileName,
	getSpuSourceCanvas,
	getSpuOptions,
	onError,
	promptForName = false
}) {
	const sourceCanvas = typeof getSpuSourceCanvas === 'function' ? getSpuSourceCanvas() : null;
	if (!sourceCanvas) {
		onError(['There is no picture to save.']);
		return;
	}

	const options = typeof getSpuOptions === 'function' ? getSpuOptions() : {};
	const bytes = encodeSpectrumSpu({
		sourceCanvas,
		bitsPerColor: options.bitsPerColor,
		ditherMode: options.ditherMode,
		ditherPattern: options.ditherPattern || null,
		optimizerMode: options.optimizerMode
	});

	const sourceName = typeof getSpuFileName === 'function'
		? getSpuFileName()
		: (typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED');
	const defaultName = replaceExtension(sourceName, 'spu');
	const entered = promptForName ? window.prompt('Save SPU as:', defaultName) : defaultName;
	if (!entered) {
		return;
	}
	const fileName = replaceExtension(entered, 'spu');
	downloadBinary(bytes, fileName);
}

export function setupFileSaving({
	canvas,
	saveMenuItem,
	saveAsMenuItem,
	exportMenuItem,
	getBaseFileName,
	getSpuFileName,
	getSpuSourceCanvas,
	getSpuOptions,
	onError
}) {
	const reportError = typeof onError === 'function' ? onError : lines => window.alert(lines.join(' '));
	const downloadPngDefault = () => {
		const baseName = typeof getBaseFileName === 'function' ? getBaseFileName() : 'UNTITLED';
		downloadCanvas(canvas, `${baseName}.png`);
	};

	if (saveMenuItem) {
		saveMenuItem.addEventListener('click', () => {
			saveSpu({
				getBaseFileName,
				getSpuFileName,
				getSpuSourceCanvas,
				getSpuOptions,
				onError: reportError
			});
		});
	}

	if (saveAsMenuItem) {
		saveAsMenuItem.addEventListener('click', () => {
			saveSpu({
				getBaseFileName,
				getSpuFileName,
				getSpuSourceCanvas,
				getSpuOptions,
				onError: reportError,
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
