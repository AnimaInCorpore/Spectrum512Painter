const fs = require('fs');
const b64 = fs.readFileSync('sprite_b64.txt', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

const spriteCss = `
		.gem-sprite {
			background-image: url(data:image/png;base64,${b64});
			background-repeat: no-repeat;
			display: inline-block;
			width: 31px;
			height: 31px;
		}
		/* Tools */
		.tool-0-0 { background-position: -10px -56px; }
		.tool-1-0 { background-position: -42px -56px; }
		.tool-2-0 { background-position: -74px -56px; }
		.tool-0-1 { background-position: -10px -88px; }
		.tool-1-1 { background-position: -42px -88px; }
		.tool-2-1 { background-position: -74px -88px; }
		.tool-0-2 { background-position: -10px -120px; }
		.tool-1-2 { background-position: -42px -120px; }
		.tool-2-2 { background-position: -74px -120px; }
		.tool-0-3 { background-position: -10px -152px; }
		.tool-1-3 { background-position: -42px -152px; }
		.tool-2-3 { background-position: -74px -152px; }
		.tool-0-4 { background-position: -10px -184px; }
		.tool-1-4 { background-position: -42px -184px; }
		.tool-2-4 { background-position: -74px -184px; }

		/* Patterns */
		.pat-0-0 { background-position: -505px -126px; }
		.pat-1-0 { background-position: -537px -126px; }
		.pat-2-0 { background-position: -569px -126px; }
		.pat-0-1 { background-position: -505px -158px; }
		.pat-1-1 { background-position: -537px -158px; }
		.pat-2-1 { background-position: -569px -158px; }
		.pat-0-2 { background-position: -505px -190px; }
		.pat-1-2 { background-position: -537px -190px; }
		.pat-2-2 { background-position: -569px -190px; }
		.pat-0-3 { background-position: -505px -222px; }
		.pat-1-3 { background-position: -537px -222px; }
		.pat-2-3 { background-position: -569px -222px; }
		.pat-0-4 { background-position: -505px -254px; }
		.pat-1-4 { background-position: -537px -254px; }
		.pat-2-4 { background-position: -569px -254px; }
		.pat-0-5 { background-position: -505px -286px; }
		.pat-1-5 { background-position: -537px -286px; }
		.pat-2-5 { background-position: -569px -286px; }
		.pat-0-6 { background-position: -505px -318px; }
		.pat-1-6 { background-position: -537px -318px; }
		.pat-2-6 { background-position: -569px -318px; }
`;

html = html.replace('</style>', spriteCss + '\n\t</style>');

// Replace SVG tools with sprite divs
const toolsHtml = `
						<button class="gem-tool-btn" title="Microscope (Zoom)"><div class="gem-sprite tool-0-0"></div></button>
						<button class="gem-tool-btn" title="Marquee"><div class="gem-sprite tool-1-0"></div></button>
						<button class="gem-tool-btn" title="Text"><div class="gem-sprite tool-2-0"></div></button>

						<button class="gem-tool-btn active" title="Pencil"><div class="gem-sprite tool-0-1"></div></button>
						<button class="gem-tool-btn" title="Eraser"><div class="gem-sprite tool-1-1"></div></button>
						<button class="gem-tool-btn" title="Line"><div class="gem-sprite tool-2-1"></div></button>

						<button class="gem-tool-btn" title="Fill"><div class="gem-sprite tool-0-2"></div></button>
						<button class="gem-tool-btn" title="Spray"><div class="gem-sprite tool-1-2"></div></button>
						<button class="gem-tool-btn" title="Faucet"><div class="gem-sprite tool-2-2"></div></button>

						<button class="gem-tool-btn" title="Rectangle"><div class="gem-sprite tool-0-3"></div></button>
						<button class="gem-tool-btn" title="Rounded Rectangle"><div class="gem-sprite tool-1-3"></div></button>
						<button class="gem-tool-btn" title="Polygon"><div class="gem-sprite tool-2-3"></div></button>

						<button class="gem-tool-btn" title="Pie Slice"><div class="gem-sprite tool-0-4"></div></button>
						<button class="gem-tool-btn" title="Ellipse"><div class="gem-sprite tool-1-4"></div></button>
						<button class="gem-tool-btn" title="Freehand"><div class="gem-sprite tool-2-4"></div></button>
`;

html = html.replace(/<button class="gem-tool-btn" title="Microscope \(Zoom\)">[\s\S]*?<button class="gem-tool-btn" title="Freehand">[\s\S]*?<\/button>/, toolsHtml);

// Update patterns script
const patternsScript = `
			const patternClasses = [
				'gem-sprite pat-0-0', 'gem-sprite pat-1-0', 'gem-sprite pat-2-0',
				'gem-sprite pat-0-1', 'gem-sprite pat-1-1', 'gem-sprite pat-2-1',
				'gem-sprite pat-0-2', 'gem-sprite pat-1-2', 'gem-sprite pat-2-2',
				'gem-sprite pat-0-3', 'gem-sprite pat-1-3', 'gem-sprite pat-2-3',
				'gem-sprite pat-0-4', 'gem-sprite pat-1-4', 'gem-sprite pat-2-4',
				'gem-sprite pat-0-5', 'gem-sprite pat-1-5', 'gem-sprite pat-2-5',
				'gem-sprite pat-0-6', 'gem-sprite pat-1-6', 'gem-sprite pat-2-6'
			];

			patternClasses.forEach((cls, i) => {
				const div = document.createElement('div');
				div.className = 'gem-pattern';
				const inner = document.createElement('div');
				inner.className = cls;
				div.appendChild(inner);
				if (i === 0) div.classList.add('active'); // Set default active

				div.addEventListener('click', function() {
					document.querySelectorAll('.gem-pattern').forEach(p => p.classList.remove('active'));
					this.classList.add('active');
				});
				patternsGrid.appendChild(div);
			});
`;

html = html.replace(/const patternClasses = \[[\s\S]*?patternsGrid\.appendChild\(div\);\n\t\t\t\}\);/, patternsScript);

fs.writeFileSync('index.html', html);
