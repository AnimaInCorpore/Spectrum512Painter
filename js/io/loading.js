import { decodeGemImg } from '../formats/gem-img.js';

function isGemImgFile(file) {
	const name = (file && file.name ? file.name : '').toLowerCase();
	return name.endsWith('.img');
}

export function setupFileLoading({ fileInput, openMenuItem, onImageLoaded, onBitmapLoaded }) {
	if (!fileInput || !openMenuItem || typeof onImageLoaded !== 'function') {
		return;
	}

	openMenuItem.addEventListener('click', () => {
		fileInput.click();
	});

	fileInput.addEventListener('change', function() {
		const file = fileInput.files && fileInput.files[0];
		if (!file) {
			return;
		}

		if (isGemImgFile(file)) {
			const binaryReader = new FileReader();
			binaryReader.onload = event => {
				try {
					const decoded = decodeGemImg(event.target.result);
					if (typeof onBitmapLoaded === 'function') {
						onBitmapLoaded({
							width: decoded.width,
							height: decoded.height,
							pixels: decoded.pixels,
							fileName: file.name
						});
					}
				} catch (error) {
					window.alert(`Could not open GEM IMG: ${error.message}`);
				}
			};
			binaryReader.readAsArrayBuffer(file);
			fileInput.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = event => {
			const image = new Image();
			image.onload = () => {
				onImageLoaded({ image, fileName: file.name });
			};
			image.src = event.target.result;
		};
		reader.readAsDataURL(file);
		fileInput.value = '';
	});
}
