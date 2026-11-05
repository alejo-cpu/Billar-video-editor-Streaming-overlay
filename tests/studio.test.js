import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { studioStore } from '../src/lib/stores/studioStore.js';

function formatTime(s) {
	if (!s || isNaN(s)) return '00:00:00';
	const hrs = Math.floor(s / 3600);
	const mins = Math.floor((s % 3600) / 60);
	const secs = Math.floor(s % 60);
	return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseTimeToSeconds(val, fallback = 0) {
	if (!val) return fallback;
	const parts = val.split(':').map(Number);
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return Number(val) || fallback;
}

function cleanProjectName(str) {
	if (!str) return 'partida';
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function calculateSeamlessLoop(totalWidthPx, speedPxPerSec = 85) {
	if (!totalWidthPx || totalWidthPx <= 0) return 0;
	return parseFloat((totalWidthPx / speedPxPerSec).toFixed(2));
}

describe('Lógica de Tiempos y Proyectos de Studio', () => {
	it('debe formatear segundos a HH:MM:SS correctamente', () => {
		expect(formatTime(0)).toBe('00:00:00');
		expect(formatTime(65)).toBe('00:01:05');
		expect(formatTime(3665)).toBe('01:01:05');
		expect(formatTime(18000)).toBe('05:00:00');
	});

	it('debe convertir texto de tiempo a segundos con precisión', () => {
		expect(parseTimeToSeconds('00:01:05')).toBe(65);
		expect(parseTimeToSeconds('05:00:00')).toBe(18000);
		expect(parseTimeToSeconds('02:30')).toBe(150);
		expect(parseTimeToSeconds('', 10)).toBe(10);
	});

	it('debe sanitizar nombres de proyecto eliminando caracteres conflictivos', () => {
		expect(cleanProjectName('Gran Final - Bola 8 (Bogotá)')).toBe('Gran_Final_-_Bola_8__Bogota_');
		expect(cleanProjectName('partida #1 / 2026!')).toBe('partida__1___2026_');
	});

	it('debe calcular la duración matemática exacta del bucle de la cinta (W / V)', () => {
		expect(calculateSeamlessLoop(1700, 85)).toBe(20.0);
		expect(calculateSeamlessLoop(2210, 85)).toBe(26.0);
	});
});

describe('Store de Studio: Marcas de tiempo y Deshacer/Rehacer', () => {
	beforeEach(() => {
		if (typeof studioStore.resetToDefault === 'function') {
			studioStore.resetToDefault();
		} else {
			studioStore.clearKeyframes();
		}
	});

	it('debe ordenar cronológicamente las marcas de tiempo que se agreguen desordenadas', () => {
		studioStore.addKeyframe(120.5, 'adjustBalls', { playerKey: 'p1', delta: 1 });
		studioStore.addKeyframe(15.2, 'switchTurn', { active: 'p2' });
		studioStore.addKeyframe(45.0, 'adjustGames', { playerKey: 'p1', delta: 1 });

		const state = get(studioStore);
		expect(state.keyframes.length).toBe(3);
		expect(state.keyframes[0].time).toBe(15.2);
		expect(state.keyframes[1].time).toBe(45.0);
		expect(state.keyframes[2].time).toBe(120.5);
	});

	it('debe soportar Deshacer (Undo) y Rehacer (Redo) respetando el límite de 5 pasos', () => {
		for (let i = 1; i <= 6; i++) {
			studioStore.addKeyframe(i * 10, 'adjustBalls', { delta: 1 });
		}

		let state = get(studioStore);
		expect(state.keyframes.length).toBe(6);
		expect(state.canUndo).toBe(true);

		studioStore.undo();
		studioStore.undo();

		state = get(studioStore);
		expect(state.keyframes.length).toBe(4);
		expect(state.canRedo).toBe(true);

		studioStore.redo();
		state = get(studioStore);
		expect(state.keyframes.length).toBe(5);
	});
});