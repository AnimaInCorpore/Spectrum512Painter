const fs = require('fs');
const b64 = fs.readFileSync('atari_b64.txt', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');
const fontFace = `
		@font-face {
			font-family: 'Atari ST';
			src: url(data:font/woff;base64,${b64}) format('woff');
			font-weight: normal;
			font-style: normal;
		}
`;
html = html.replace('<style>', '<style>\n' + fontFace);
html = html.replace(/font-family: 'Arial', sans-serif;/g, "font-family: 'Atari ST', sans-serif;");
html = html.replace(/font-family: 'Courier New', monospace;/g, "font-family: 'Atari ST', sans-serif;");
html = html.replace(/font-family="Arial"/g, 'font-family="Atari ST"');
html = html.replace(/font-family="Courier"/g, 'font-family="Atari ST"');
fs.writeFileSync('index.html', html);
