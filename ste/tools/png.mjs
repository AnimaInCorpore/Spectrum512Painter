import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

function paeth(a, b, c) {
	const p = a + b - c;
	const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
	return da <= db && da <= dc ? a : db <= dc ? b : c;
}

// The prepared input assets are non-interlaced, eight-bit RGB/RGBA PNGs.
export function readPng(path) {
	const file = readFileSync(path), chunks = [];
	let width, height, channels;
	for (let pos = 8; pos < file.length;) {
		const size = file.readUInt32BE(pos), type = file.toString('ascii', pos + 4, pos + 8);
		const data = file.subarray(pos + 8, pos + 8 + size);
		if (type === 'IHDR') {
			width = data.readUInt32BE(0); height = data.readUInt32BE(4);
			channels = { 2: 3, 6: 4 }[data[9]];
			if (data[8] !== 8 || !channels || data[12]) throw Error('Expected non-interlaced RGB/RGBA8 PNG');
		}
		if (type === 'IDAT') chunks.push(data);
		pos += size + 12;
	}
	const packed = inflateSync(Buffer.concat(chunks));
	const stride = width * channels, raw = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = packed[y * (stride + 1)];
		for (let x = 0; x < stride; x++) {
			const i = y * stride + x, a = x >= channels ? raw[i - channels] : 0;
			const b = y ? raw[i - stride] : 0, c = y && x >= channels ? raw[i - stride - channels] : 0;
			const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
			if (predictor === undefined) throw Error('Invalid PNG filter');
			raw[i] = packed[y * (stride + 1) + x + 1] + predictor;
		}
	}
	const rgba = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		rgba.set(raw.subarray(i * channels, i * channels + 3), i * 4);
		rgba[i * 4 + 3] = channels === 4 ? raw[i * channels + 3] : 255;
	}
	return { width, height, rgba };
}

function crc32(data) {
	let crc = -1;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
	const buffer = Buffer.alloc(data.length + 12);
	buffer.writeUInt32BE(data.length); buffer.write(type, 4); data.copy(buffer, 8);
	buffer.writeUInt32BE(crc32(buffer.subarray(4, -4)), buffer.length - 4);
	return buffer;
}

export function writePng(path, width, height, rgb) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
	const raw = Buffer.alloc(height * (width * 3 + 1));
	for (let y = 0; y < height; y++) Buffer.from(rgb.subarray(y * width * 3, (y + 1) * width * 3)).copy(raw, y * (width * 3 + 1) + 1);
	writeFileSync(path, Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
