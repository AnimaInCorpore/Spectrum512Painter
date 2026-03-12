import { decodeGemImg } from '../formats/gem-img.js';
import { decodeSpectrumSpu } from '../formats/spectrum-spu.js';

function isGemImgFile(file) {
	const name = (file && file.name ? file.name : '').toLowerCase();
	return name.endsWith('.img');
}

function isSpuFile(file) {
	const name = (file && file.name ? file.name : '').toLowerCase();
	return name.endsWith('.spu');
}

function getFirstFile(fileList) {
	if (!fileList || fileList.length === 0) {
		return null;
	}
	return fileList[0];
}

function hasDraggedFiles(event) {
	const types = event && event.dataTransfer ? event.dataTransfer.types : null;
	return Array.isArray(types)
		? types.includes('Files')
		: Boolean(types && typeof types.includes === 'function' && types.includes('Files'));
}

function loadGemImgFile(file, onBitmapLoaded) {
	const binaryReader = new FileReader();
	binaryReader.onload = event => {
		try {
			const decoded = decodeGemImg(event.target.result);
			if (typeof onBitmapLoaded === 'function') {
				onBitmapLoaded({
					width: decoded.width,
					height: decoded.height,
					pixels: decoded.pixels,
					fileName: file.name,
					sourceFormat: 'img'
				});
			}
		} catch (error) {
			window.alert(`Could not open GEM IMG: ${error.message}`);
		}
	};
	binaryReader.readAsArrayBuffer(file);
}

function loadSpuFile(file, onBitmapLoaded) {
	const binaryReader = new FileReader();
	binaryReader.onload = event => {
		try {
			const decoded = decodeSpectrumSpu(event.target.result);
			if (typeof onBitmapLoaded === 'function') {
				onBitmapLoaded({
					width: decoded.width,
					height: decoded.height,
					pixels: decoded.pixels,
					fileName: file.name,
					sourceFormat: 'spu',
					bitsPerColor: decoded.bitsPerColor
				});
			}
		} catch (error) {
			window.alert(`Could not open SPU: ${error.message}`);
		}
	};
	binaryReader.readAsArrayBuffer(file);
}

function loadImageFile(file, onImageLoaded) {
	const reader = new FileReader();
	reader.onload = event => {
		const image = new Image();
		image.onload = () => {
			onImageLoaded({ image, fileName: file.name });
		};
		image.onerror = () => {
			window.alert(`Could not open picture: ${file.name}`);
		};
		image.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

function loadFile(file, { onImageLoaded, onBitmapLoaded }) {
	if (!file) {
		return;
	}

	if (isGemImgFile(file)) {
		loadGemImgFile(file, onBitmapLoaded);
		return;
	}

	if (isSpuFile(file)) {
		loadSpuFile(file, onBitmapLoaded);
		return;
	}

	loadImageFile(file, onImageLoaded);
}

function setupDropTarget(dropTarget, callbacks) {
	if (!dropTarget) {
		return;
	}

	let dragDepth = 0;
	const clearDragState = () => {
		dragDepth = 0;
		dropTarget.classList.remove('drag-active');
	};

	dropTarget.addEventListener('dragenter', event => {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		dragDepth += 1;
		dropTarget.classList.add('drag-active');
	});

	dropTarget.addEventListener('dragover', event => {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		dropTarget.classList.add('drag-active');
	});

	dropTarget.addEventListener('dragleave', event => {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) {
			dropTarget.classList.remove('drag-active');
		}
	});

	dropTarget.addEventListener('drop', event => {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		const file = getFirstFile(event.dataTransfer ? event.dataTransfer.files : null);
		clearDragState();
		loadFile(file, callbacks);
	});
}

export function setupFileLoading({ fileInput, openMenuItem, dropTarget, onImageLoaded, onBitmapLoaded }) {
	if (!fileInput || typeof onImageLoaded !== 'function') {
		return;
	}

	if (openMenuItem) {
		openMenuItem.addEventListener('click', () => {
			fileInput.click();
		});
	}

	setupDropTarget(dropTarget, { onImageLoaded, onBitmapLoaded });

	fileInput.addEventListener('change', function() {
		const file = getFirstFile(fileInput.files);
		if (!file) {
			return;
		}

		loadFile(file, { onImageLoaded, onBitmapLoaded });
		fileInput.value = '';
	});
}
