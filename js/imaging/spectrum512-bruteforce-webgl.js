import { rgbToOklab } from '../vendor/jscolorquantizer/quantizers/core.js';

const SLOT_COUNT = 48;
const LOGICAL_COLOR_COUNT = 16;
const DEFAULT_MAX_CANDIDATES = 128;
const DEFAULT_MAX_PASSES = 4;
const IMPROVEMENT_EPSILON = 0.000001;
const LOCKED_SLOT_INDICES = new Set([0, 32]);

let webglState = undefined;

function getSpectrum512ColorSlotIndex(x, colorIndex) {
	let temp = 10 * colorIndex;

	if (colorIndex & 1) {
		temp -= 5;
	} else {
		temp += 1;
	}

	if (x < temp) {
		return colorIndex;
	}
	if (x >= temp + 160) {
		return colorIndex + 32;
	}
	return colorIndex + 16;
}

function clampColor(value) {
	if (value < 0) {
		return 0;
	}
	if (value > 255) {
		return 255;
	}
	return value;
}

function quantizeChannel(value, shadesScale, inverseShadesScale) {
	return Math.round(Math.round(value * shadesScale) * inverseShadesScale);
}

function colorKey(red, green, blue) {
	return (red << 16) | (green << 8) | blue;
}

function createCandidateTexturePixels(candidates) {
	const pixels = new Uint8Array(candidates.length * 4);
	for (let i = 0; i < candidates.length; i += 1) {
		const index = i * 4;
		pixels[index] = candidates[i].red;
		pixels[index + 1] = candidates[i].green;
		pixels[index + 2] = candidates[i].blue;
		pixels[index + 3] = 255;
	}
	return pixels;
}

function createSourceLinePixels(lineData, width) {
	const pixels = new Uint8Array(width * 4);
	for (let x = 0; x < width; x += 1) {
		const sourceIndex = x * 4;
		pixels[sourceIndex] = Math.round(clampColor(lineData[sourceIndex]));
		pixels[sourceIndex + 1] = Math.round(clampColor(lineData[sourceIndex + 1]));
		pixels[sourceIndex + 2] = Math.round(clampColor(lineData[sourceIndex + 2]));
		pixels[sourceIndex + 3] = lineData[sourceIndex + 3] === 255 ? 255 : 0;
	}
	return pixels;
}

function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile error.';
		gl.deleteShader(shader);
		throw new Error(log);
	}
	return shader;
}

function createProgram(gl) {
	const vertexSource = `#version 300 es
in vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}`;

	const fragmentSource = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_source;
uniform sampler2D u_candidates;
uniform int u_sourceWidth;
uniform int u_candidateCount;

out vec4 outColor;

vec3 srgbToLinear(vec3 c) {
	vec3 low = c / 12.92;
	vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
	return mix(high, low, vec3(lessThanEqual(c, vec3(0.04045))));
}

vec3 linearToOklab(vec3 c) {
	float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
	float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
	float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

	float lRoot = pow(max(l, 0.0), 1.0 / 3.0);
	float mRoot = pow(max(m, 0.0), 1.0 / 3.0);
	float sRoot = pow(max(s, 0.0), 1.0 / 3.0);

	return vec3(
		0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
		1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
		0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot
	);
}

void main() {
	int x = int(gl_FragCoord.x);
	int candidateIndex = int(gl_FragCoord.y);
	if (x >= u_sourceWidth || candidateIndex >= u_candidateCount) {
		outColor = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}

	vec3 source = texelFetch(u_source, ivec2(x, 0), 0).rgb;
	vec3 candidate = texelFetch(u_candidates, ivec2(candidateIndex, 0), 0).rgb;

	vec3 sourceLab = linearToOklab(srgbToLinear(source));
	vec3 candidateLab = linearToOklab(srgbToLinear(candidate));
	vec3 delta = sourceLab - candidateLab;
	float distanceSquared = dot(delta, delta);
	outColor = vec4(distanceSquared, 0.0, 0.0, 1.0);
}`;

	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	gl.deleteShader(vertexShader);
	gl.deleteShader(fragmentShader);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) || 'Unknown shader link error.';
		gl.deleteProgram(program);
		throw new Error(log);
	}

	return program;
}

function createTexture(gl) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	return texture;
}

function createWebglState() {
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		depth: false,
		premultipliedAlpha: false,
		stencil: false
	});
	if (!gl) {
		return null;
	}
	if (!gl.getExtension('EXT_color_buffer_float')) {
		return null;
	}

	const program = createProgram(gl);
	const vao = gl.createVertexArray();
	const buffer = gl.createBuffer();
	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
			-1, -1,
			1, -1,
			-1, 1,
			-1, 1,
			1, -1,
			1, 1
		]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'a_position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	const sourceTexture = createTexture(gl);
	const candidateTexture = createTexture(gl);
	const outputTexture = createTexture(gl);
	const framebuffer = gl.createFramebuffer();

	return {
		canvas,
		gl,
		program,
		vao,
		sourceTexture,
		candidateTexture,
		outputTexture,
		framebuffer,
		sourceUniform: gl.getUniformLocation(program, 'u_source'),
		candidateUniform: gl.getUniformLocation(program, 'u_candidates'),
		sourceWidthUniform: gl.getUniformLocation(program, 'u_sourceWidth'),
		candidateCountUniform: gl.getUniformLocation(program, 'u_candidateCount')
	};
}

function getWebglState() {
	if (webglState !== undefined) {
		return webglState;
	}
	try {
		webglState = createWebglState();
	} catch (error) {
		webglState = null;
	}
	return webglState;
}

export function isSpectrum512BruteForceWebglAvailable() {
	return Boolean(getWebglState());
}

function computeDistanceTableWebgl(sourcePixels, candidatePixels, width, candidateCount) {
	const state = getWebglState();
	if (!state) {
		return null;
	}

	const {
		canvas,
		gl,
		program,
		vao,
		sourceTexture,
		candidateTexture,
		outputTexture,
		framebuffer,
		sourceUniform,
		candidateUniform,
		sourceWidthUniform,
		candidateCountUniform
	} = state;

	canvas.width = width;
	canvas.height = candidateCount;

	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, sourcePixels);

	gl.bindTexture(gl.TEXTURE_2D, candidateTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA8,
		candidateCount,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		candidatePixels
	);

	gl.bindTexture(gl.TEXTURE_2D, outputTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		width,
		candidateCount,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return null;
	}

	gl.viewport(0, 0, width, candidateCount);
	gl.useProgram(program);
	gl.bindVertexArray(vao);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
	gl.uniform1i(sourceUniform, 0);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, candidateTexture);
	gl.uniform1i(candidateUniform, 1);
	gl.uniform1i(sourceWidthUniform, width);
	gl.uniform1i(candidateCountUniform, candidateCount);

	gl.drawArrays(gl.TRIANGLES, 0, 6);

	const rawDistances = new Float32Array(width * candidateCount * 4);
	gl.readPixels(0, 0, width, candidateCount, gl.RGBA, gl.FLOAT, rawDistances);

	gl.bindVertexArray(null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	const distances = new Float32Array(width * candidateCount);
	let sourceIndex = 0;
	for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
		const lineOffset = candidateIndex * width;
		for (let x = 0; x < width; x += 1) {
			distances[lineOffset + x] = rawDistances[sourceIndex];
			sourceIndex += 4;
		}
	}

	return distances;
}

function computeDistanceTableCpu(sourcePixels, candidates, width) {
	const candidateCount = candidates.length;
	const sourceOklab = new Array(width);
	for (let x = 0; x < width; x += 1) {
		const index = x * 4;
		sourceOklab[x] = rgbToOklab([
			sourcePixels[index],
			sourcePixels[index + 1],
			sourcePixels[index + 2]
		]);
	}

	const distances = new Float32Array(width * candidateCount);
	for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
		const candidate = candidates[candidateIndex];
		const candidateLab = candidate.oklab;
		const lineOffset = candidateIndex * width;
		for (let x = 0; x < width; x += 1) {
			const sourceLab = sourceOklab[x];
			const deltaL = sourceLab[0] - candidateLab[0];
			const deltaA = sourceLab[1] - candidateLab[1];
			const deltaB = sourceLab[2] - candidateLab[2];
			distances[lineOffset + x] = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
		}
	}

	return distances;
}

function collectOpaqueMask(lineData, width) {
	const opaque = new Uint8Array(width);
	for (let x = 0; x < width; x += 1) {
		opaque[x] = lineData[x * 4 + 3] === 255 ? 1 : 0;
	}
	return opaque;
}

function buildLineCandidates({
	lineData,
	width,
	initialSlots,
	shadesScale,
	inverseShadesScale,
	maxCandidates
}) {
	const counts = new Map();
	for (let x = 0; x < width; x += 1) {
		const index = x * 4;
		if (lineData[index + 3] !== 255) {
			continue;
		}
		const red = quantizeChannel(clampColor(lineData[index]), shadesScale, inverseShadesScale);
		const green = quantizeChannel(clampColor(lineData[index + 1]), shadesScale, inverseShadesScale);
		const blue = quantizeChannel(clampColor(lineData[index + 2]), shadesScale, inverseShadesScale);
		const key = colorKey(red, green, blue);
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	const sortedLineColors = Array.from(counts.entries())
		.sort((entryA, entryB) => entryB[1] - entryA[1]);

	const candidates = [];
	const seen = new Set();
	const addColor = (red, green, blue) => {
		const key = colorKey(red, green, blue);
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		candidates.push({
			red,
			green,
			blue,
			oklab: rgbToOklab([red, green, blue])
		});
	};

	for (let i = 0; i < initialSlots.length; i += 1) {
		addColor(initialSlots[i].red, initialSlots[i].green, initialSlots[i].blue);
		if (candidates.length >= maxCandidates) {
			break;
		}
	}

	for (let i = 0; i < sortedLineColors.length && candidates.length < maxCandidates; i += 1) {
		const key = sortedLineColors[i][0];
		const red = (key >> 16) & 0xff;
		const green = (key >> 8) & 0xff;
		const blue = key & 0xff;
		addColor(red, green, blue);
	}

	if (candidates.length === 0) {
		addColor(0, 0, 0);
	}

	return candidates;
}

function findClosestCandidateIndex(slot, candidates) {
	const slotLab = rgbToOklab([slot.red, slot.green, slot.blue]);
	let bestIndex = 0;
	let bestDistance = Number.MAX_VALUE;
	for (let i = 0; i < candidates.length; i += 1) {
		const candidateLab = candidates[i].oklab;
		const deltaL = slotLab[0] - candidateLab[0];
		const deltaA = slotLab[1] - candidateLab[1];
		const deltaB = slotLab[2] - candidateLab[2];
		const distance = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = i;
		}
	}
	return bestIndex;
}

function buildInitialAssignment(initialSlots, candidates) {
	const byKey = new Map();
	for (let i = 0; i < candidates.length; i += 1) {
		byKey.set(colorKey(candidates[i].red, candidates[i].green, candidates[i].blue), i);
	}

	const assignment = new Int16Array(SLOT_COUNT);
	for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
		const slot = initialSlots[slotIndex];
		const key = colorKey(slot.red, slot.green, slot.blue);
		if (byKey.has(key)) {
			assignment[slotIndex] = byKey.get(key);
			continue;
		}
		assignment[slotIndex] = findClosestCandidateIndex(slot, candidates);
	}
	return assignment;
}

function buildSlotAccess(width, opaqueMask) {
	const slotsByX = new Array(width);
	const xBySlot = new Array(SLOT_COUNT);
	for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
		xBySlot[slotIndex] = [];
	}

	for (let x = 0; x < width; x += 1) {
		const uniqueSlots = [];
		if (opaqueMask[x]) {
			const seen = new Uint8Array(SLOT_COUNT);
			for (let colorIndex = 0; colorIndex < LOGICAL_COLOR_COUNT; colorIndex += 1) {
				const slotIndex = getSpectrum512ColorSlotIndex(x, colorIndex);
				if (seen[slotIndex]) {
					continue;
				}
				seen[slotIndex] = 1;
				uniqueSlots.push(slotIndex);
				xBySlot[slotIndex].push(x);
			}
		}
		slotsByX[x] = uniqueSlots;
	}

	return { slotsByX, xBySlot };
}

function computePixelStateForX(x, slotsAtX, assignment, distances, width) {
	let bestSlot = -1;
	let bestDistance = Number.MAX_VALUE;
	let secondDistance = Number.MAX_VALUE;

	for (let i = 0; i < slotsAtX.length; i += 1) {
		const slotIndex = slotsAtX[i];
		const candidateIndex = assignment[slotIndex];
		const distance = distances[candidateIndex * width + x];
		if (distance < bestDistance) {
			secondDistance = bestDistance;
			bestDistance = distance;
			bestSlot = slotIndex;
		} else if (distance < secondDistance) {
			secondDistance = distance;
		}
	}

	return {
		bestSlot,
		bestDistance,
		secondDistance
	};
}

function buildOptimizationState({ width, assignment, slotAccess, distances, opaqueMask }) {
	const minDistances = new Float32Array(width);
	const secondDistances = new Float32Array(width);
	const bestSlots = new Int16Array(width);
	let totalCost = 0;

	for (let x = 0; x < width; x += 1) {
		if (!opaqueMask[x]) {
			minDistances[x] = 0;
			secondDistances[x] = Number.MAX_VALUE;
			bestSlots[x] = -1;
			continue;
		}

		const pixelState = computePixelStateForX(
			x,
			slotAccess.slotsByX[x],
			assignment,
			distances,
			width
		);
		minDistances[x] = pixelState.bestDistance;
		secondDistances[x] = pixelState.secondDistance;
		bestSlots[x] = pixelState.bestSlot;
		totalCost += pixelState.bestDistance;
	}

	return {
		minDistances,
		secondDistances,
		bestSlots,
		totalCost
	};
}

function evaluateSlotCandidate({
	slotIndex,
	candidateIndex,
	state,
	slotAccess,
	distances,
	width
}) {
	let delta = 0;
	const affectedX = slotAccess.xBySlot[slotIndex];
	for (let i = 0; i < affectedX.length; i += 1) {
		const x = affectedX[i];
		const currentDistance = state.minDistances[x];
		const replacementDistance = distances[candidateIndex * width + x];
		let newDistance = currentDistance;
		if (state.bestSlots[x] === slotIndex) {
			const fallbackDistance = state.secondDistances[x];
			newDistance = replacementDistance < fallbackDistance
				? replacementDistance
				: fallbackDistance;
		} else if (replacementDistance < currentDistance) {
			newDistance = replacementDistance;
		}
		delta += newDistance - currentDistance;
	}
	return state.totalCost + delta;
}

function applySlotAssignment({
	slotIndex,
	assignment,
	state,
	slotAccess,
	distances,
	width
}) {
	const affectedX = slotAccess.xBySlot[slotIndex];
	let totalCost = state.totalCost;
	for (let i = 0; i < affectedX.length; i += 1) {
		const x = affectedX[i];
		const previousDistance = state.minDistances[x];
		const pixelState = computePixelStateForX(
			x,
			slotAccess.slotsByX[x],
			assignment,
			distances,
			width
		);
		state.minDistances[x] = pixelState.bestDistance;
		state.secondDistances[x] = pixelState.secondDistance;
		state.bestSlots[x] = pixelState.bestSlot;
		totalCost += pixelState.bestDistance - previousDistance;
	}
	state.totalCost = totalCost;
}

function optimizeSlotAssignments({
	assignment,
	candidateCount,
	slotAccess,
	distances,
	width,
	opaqueMask,
	maxPasses
}) {
	const state = buildOptimizationState({
		width,
		assignment,
		slotAccess,
		distances,
		opaqueMask
	});

	for (let pass = 0; pass < maxPasses; pass += 1) {
		let changedInPass = false;

		for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
			if (LOCKED_SLOT_INDICES.has(slotIndex)) {
				continue;
			}
			if (slotAccess.xBySlot[slotIndex].length === 0) {
				continue;
			}

			const currentCandidate = assignment[slotIndex];
			let bestCandidate = currentCandidate;
			let bestCost = state.totalCost;

			for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
				if (candidateIndex === currentCandidate) {
					continue;
				}
				const candidateCost = evaluateSlotCandidate({
					slotIndex,
					candidateIndex,
					state,
					slotAccess,
					distances,
					width
				});
				if (candidateCost + IMPROVEMENT_EPSILON < bestCost) {
					bestCost = candidateCost;
					bestCandidate = candidateIndex;
				}
			}

			if (bestCandidate !== currentCandidate) {
				assignment[slotIndex] = bestCandidate;
				applySlotAssignment({
					slotIndex,
					assignment,
					state,
					slotAccess,
					distances,
					width
				});
				changedInPass = true;
			}
		}

		if (!changedInPass) {
			break;
		}
	}

	return assignment;
}

function buildOptimizedSlotsFromAssignment(assignment, candidates) {
	const slots = new Array(SLOT_COUNT);
	for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
		const candidate = candidates[assignment[slotIndex]];
		slots[slotIndex] = {
			red: candidate.red,
			green: candidate.green,
			blue: candidate.blue
		};
	}
	return slots;
}

export function optimizeSpectrum512LineSlotsBruteForce({
	lineData,
	width,
	bitsPerColor,
	initialSlots,
	maxCandidates = DEFAULT_MAX_CANDIDATES,
	maxPasses = DEFAULT_MAX_PASSES
}) {
	if (!lineData || !initialSlots || initialSlots.length !== SLOT_COUNT || width < 1) {
		return null;
	}

	const shadesPerColor = 1 << bitsPerColor;
	const shadesScale = (shadesPerColor - 1) / 255;
	const inverseShadesScale = 1 / shadesScale;
	const boundedMaxCandidates = Math.max(16, Math.min(512, Math.floor(maxCandidates)));
	const boundedPasses = Math.max(1, Math.min(12, Math.floor(maxPasses)));

	const opaqueMask = collectOpaqueMask(lineData, width);
	const hasOpaquePixel = opaqueMask.some(value => value === 1);
	if (!hasOpaquePixel) {
		return initialSlots.map(slot => ({
			red: slot.red,
			green: slot.green,
			blue: slot.blue
		}));
	}

	const candidates = buildLineCandidates({
		lineData,
		width,
		initialSlots,
		shadesScale,
		inverseShadesScale,
		maxCandidates: boundedMaxCandidates
	});
	const sourcePixels = createSourceLinePixels(lineData, width);
	const candidatePixels = createCandidateTexturePixels(candidates);
	const candidateCount = candidates.length;

	let distances = computeDistanceTableWebgl(sourcePixels, candidatePixels, width, candidateCount);
	if (!distances) {
		distances = computeDistanceTableCpu(sourcePixels, candidates, width);
	}

	const assignment = buildInitialAssignment(initialSlots, candidates);
	const slotAccess = buildSlotAccess(width, opaqueMask);
	const optimizedAssignment = optimizeSlotAssignments({
		assignment,
		candidateCount,
		slotAccess,
		distances,
		width,
		opaqueMask,
		maxPasses: boundedPasses
	});

	return buildOptimizedSlotsFromAssignment(optimizedAssignment, candidates);
}
