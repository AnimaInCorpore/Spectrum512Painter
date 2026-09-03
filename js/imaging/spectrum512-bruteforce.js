import { rgbToOklab } from '../vendor/jscolorquantizer/quantizers/core.js';
import {
	LOGICAL_COLOR_COUNT,
	SLOT_COUNT,
	clampColor,
	getSpectrum512ColorSlotIndex
} from './spectrum512-slots.js';

const DEFAULT_MAX_CANDIDATES = 128;
const DEFAULT_MAX_PASSES = 4;
const IMPROVEMENT_EPSILON = 0.000001;

// The greedy pass in spectrum512.js reserves slots 0 and 32 for the background color but
// only protects slot 32 from being merged away, so slot 32 is the one that must stay put
// here too. Locking slot 0 as well would freeze a slot the greedy pass may already have
// reassigned, and it is reachable at a single column (x = 0) anyway.
const LOCKED_SLOT_INDICES = new Set([32]);

function colorKey(red, green, blue) {
	return (red << 16) | (green << 8) | blue;
}

function toChannel(value) {
	return Math.round(clampColor(value));
}

function collectOpaqueMask(lineData, width) {
	const opaque = new Uint8Array(width);
	for (let x = 0; x < width; x += 1) {
		opaque[x] = lineData[x * 4 + 3] === 255 ? 1 : 0;
	}
	return opaque;
}

function hasAnyOpaquePixel(opaqueMask) {
	for (let i = 0; i < opaqueMask.length; i += 1) {
		if (opaqueMask[i]) {
			return true;
		}
	}
	return false;
}

function cloneSlots(initialSlots) {
	const cloned = new Array(SLOT_COUNT);
	for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
		const slot = initialSlots[slotIndex];
		cloned[slotIndex] = {
			red: slot.red,
			green: slot.green,
			blue: slot.blue
		};
	}
	return cloned;
}

/**
 * Candidate colors the optimizer may assign to a slot: every color already present in the
 * incoming slots first, so the initial assignment reproduces the greedy result exactly and
 * the search can never end up worse than where it started, then the line's own colors by
 * descending frequency until the budget is spent.
 */
function buildLineCandidates({ lineData, width, initialSlots, maxCandidates }) {
	const counts = new Map();
	for (let x = 0; x < width; x += 1) {
		const index = x * 4;
		if (lineData[index + 3] !== 255) {
			continue;
		}
		const key = colorKey(
			toChannel(lineData[index]),
			toChannel(lineData[index + 1]),
			toChannel(lineData[index + 2])
		);
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
		addColor((key >> 16) & 0xff, (key >> 8) & 0xff, key & 0xff);
	}

	if (candidates.length === 0) {
		addColor(0, 0, 0);
	}

	return candidates;
}

/** Squared Oklab distance from every pixel in the line to every candidate color. */
function computeDistanceTable(lineData, candidates, width) {
	const candidateCount = candidates.length;
	const sourceOklab = new Array(width);
	for (let x = 0; x < width; x += 1) {
		const index = x * 4;
		sourceOklab[x] = rgbToOklab([
			toChannel(lineData[index]),
			toChannel(lineData[index + 1]),
			toChannel(lineData[index + 2])
		]);
	}

	const distances = new Float32Array(width * candidateCount);
	for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
		const candidateLab = candidates[candidateIndex].oklab;
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

/** Which slots each column can draw from, and which columns each slot serves. */
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

/**
 * Total cost if `slotIndex` were reassigned to `candidateIndex`, without touching state.
 * Where the slot currently wins its column the runner-up becomes the fallback; elsewhere
 * the column can only improve.
 */
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

/** Coordinate descent over the slots, repeated until a pass finds no improvement. */
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

function optimizeLineSlots({ lineData, width, initialSlots, maxCandidates, maxPasses }) {
	const opaqueMask = collectOpaqueMask(lineData, width);
	if (!hasAnyOpaquePixel(opaqueMask)) {
		return cloneSlots(initialSlots);
	}

	const candidates = buildLineCandidates({ lineData, width, initialSlots, maxCandidates });
	const assignment = optimizeSlotAssignments({
		assignment: buildInitialAssignment(initialSlots, candidates),
		candidateCount: candidates.length,
		slotAccess: buildSlotAccess(width, opaqueMask),
		distances: computeDistanceTable(lineData, candidates, width),
		width,
		opaqueMask,
		maxPasses
	});

	return buildOptimizedSlotsFromAssignment(assignment, candidates);
}

/**
 * Refines the greedy per-line slot colors. `lineData` is expected to already hold colors
 * quantized to the target bit depth, as produced by the dither pass in spectrum512.js;
 * candidates are drawn from it verbatim. Returns one array of 48 slots per input line, or
 * null for a line that could not be processed.
 */
export function optimizeSpectrum512LineSlotsBruteForceBatch({
	lines,
	width,
	maxCandidates = DEFAULT_MAX_CANDIDATES,
	maxPasses = DEFAULT_MAX_PASSES
}) {
	if (!Array.isArray(lines) || width < 1) {
		return [];
	}

	const boundedMaxCandidates = Number.isFinite(maxCandidates)
		? Math.max(16, Math.min(512, Math.floor(maxCandidates)))
		: DEFAULT_MAX_CANDIDATES;
	const boundedPasses = Number.isFinite(maxPasses)
		? Math.max(1, Math.min(12, Math.floor(maxPasses)))
		: DEFAULT_MAX_PASSES;

	const optimizedLines = new Array(lines.length);

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		if (
			!line
			|| !line.lineData
			|| !line.initialSlots
			|| line.initialSlots.length !== SLOT_COUNT
		) {
			optimizedLines[lineIndex] = null;
			continue;
		}

		optimizedLines[lineIndex] = optimizeLineSlots({
			lineData: line.lineData,
			width,
			initialSlots: line.initialSlots,
			maxCandidates: boundedMaxCandidates,
			maxPasses: boundedPasses
		});
	}

	return optimizedLines;
}
