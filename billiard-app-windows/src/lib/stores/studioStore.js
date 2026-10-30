import { writable, get } from 'svelte/store';

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

const initialStudioState = {
	projectName: '',
	videoFile: null,
	videoUrl: null,
	videoName: '',
	duration: 0,
	currentTime: 0,
	isPlaying: false,
	keyframes: [],
	lastSavedAt: null,
	isDirty: false,
	renderProgress: {
		active: false,
		percent: 0,
		fps: 0,
		eta: '',
		downloadUrl: null
	}
};

function createStudioStore() {
	const { subscribe, set, update } = writable(initialStudioState);

	return {
		subscribe,
		setVideo: (file) => {
			const url = URL.createObjectURL(file);
			update((s) => ({
				...s,
				videoFile: file,
				videoUrl: url,
				videoName: file.name,
				projectName: s.projectName || file.name.replace(/\.[^/.]+$/, ''),
				isDirty: true
			}));
		},
		// Re-vincular video conservando el 100% de las marcas del proyecto
		relinkVideo: (file) => {
			const url = URL.createObjectURL(file);
			update((s) => ({
				...s,
				videoFile: file,
				videoUrl: url,
				videoName: file.name,
				isDirty: true
			}));
		},
		setDuration: (d) => update((s) => ({ ...s, duration: d })),
		setTime: (t) => update((s) => ({ ...s, currentTime: t })),
		setIsPlaying: (p) => update((s) => ({ ...s, isPlaying: p })),

		addKeyframe: (time, actionType, payload, soundEnabled = true) => {
			let shouldTriggerAutosave = false;
			update((s) => {
				const id = Date.now() + Math.random();
				const newKf = { id, time: parseFloat(time.toFixed(2)), actionType, payload, soundEnabled };
				const kfs = [...s.keyframes, newKf].sort((a, b) => a.time - b.time);

				// Disparar autoguardado ante cambios de puntos o games
				if (
					actionType === 'adjustBalls' ||
					actionType === 'adjustGames' ||
					actionType === 'setTickerItems'
				) {
					shouldTriggerAutosave = true;
				}

				return { ...s, keyframes: kfs, isDirty: true };
			});
			return shouldTriggerAutosave;
		},

		toggleKeyframeSound: (id) => {
			update((s) => ({
				...s,
				keyframes: s.keyframes.map((k) =>
					k.id === id ? { ...k, soundEnabled: !k.soundEnabled } : k
				),
				isDirty: true
			}));
		},

		removeKeyframe: (id) => {
			update((s) => ({
				...s,
				keyframes: s.keyframes.filter((k) => k.id !== id),
				isDirty: true
			}));
		},

		clearKeyframes: () => update((s) => ({ ...s, keyframes: [], isDirty: true })),

		setKeyframes: (kfs) => update((s) => ({ ...s, keyframes: kfs, isDirty: true })),

		setRenderProgress: (progress) =>
			update((s) => ({ ...s, renderProgress: { ...s.renderProgress, ...progress } })),

		// Cargar datos completos de un archivo .billiard
		loadProjectData: (projectData) => {
			update((s) => ({
				...s,
				projectName: projectData.projectName || s.projectName,
				videoName: projectData.videoName || s.videoName,
				duration: projectData.duration || s.duration,
				keyframes: projectData.keyframes || [],
				isDirty: false,
				lastSavedAt: Date.now()
			}));
		},

		markSaved: (projectName) => {
			update((s) => ({
				...s,
				projectName: projectName || s.projectName,
				isDirty: false,
				lastSavedAt: Date.now()
			}));
		}
	};
}

export const studioStore = createStudioStore();
