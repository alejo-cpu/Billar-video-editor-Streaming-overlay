import { writable, get } from 'svelte/store';

const initialStudioState = {
	projectName: '',
	projectFolder: '',
	videoFolder: '',
	audioFolder: '',
	assetsFolder: '',
	videoFile: null,
	videoUrl: null,
	videoName: '',
	duration: 0,
	currentTime: 0,
	isPlaying: false,
	keyframes: [],
	lastSavedAt: null,
	isDirty: false,
	canUndo: false,
	canRedo: false,
	renderProgress: {
		active: false,
		percent: 0,
		fps: 0,
		eta: '',
		downloadUrl: null
	}
};

function createStudioStore() {
	const { subscribe, set, update } = writable({ ...initialStudioState });

	let undoHistory = [];
	let historyIndex = -1;

	function pushHistorySnapshot(kfs) {
		if (historyIndex < undoHistory.length - 1) {
			undoHistory = undoHistory.slice(0, historyIndex + 1);
		}
		undoHistory.push(JSON.parse(JSON.stringify(kfs)));
		if (undoHistory.length > 5) {
			undoHistory.shift();
		}
		historyIndex = undoHistory.length - 1;
	}

	function updateHistoryFlags(s) {
		return {
			...s,
			canUndo: historyIndex > 0,
			canRedo: historyIndex < undoHistory.length - 1
		};
	}

	return {
		subscribe,

		setVideo: (file) => {
			const url = URL.createObjectURL(file);
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				return {
					...s,
					videoFile: file,
					videoUrl: url,
					videoName: file.name,
					projectName:
						s.projectName || file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_'),
					isDirty: true
				};
			});
		},

		setVideoUrlDirect: (url, name) => {
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				return {
					...s,
					videoUrl: url,
					videoName: name,
					videoFile: null,
					isDirty: true
				};
			});
		},

		unloadVideo: () => {
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				return {
					...s,
					videoFile: null,
					videoUrl: null,
					videoName: '',
					duration: 0,
					currentTime: 0,
					isPlaying: false
				};
			});
		},

		relinkVideo: (file) => {
			const url = URL.createObjectURL(file);
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				return {
					...s,
					videoFile: file,
					videoUrl: url,
					videoName: file.name,
					isDirty: true
				};
			});
		},

		setDuration: (d) => update((s) => ({ ...s, duration: d })),
		setTime: (t) => update((s) => ({ ...s, currentTime: t })),
		setIsPlaying: (p) => update((s) => ({ ...s, isPlaying: p })),

		addKeyframe: (time, actionType, payload, soundEnabled = true, isManual = false) => {
			let shouldTriggerAutosave = false;
			update((s) => {
				const id = Date.now() + Math.random();
				const newKf = {
					id,
					time: parseFloat(time.toFixed(2)),
					actionType,
					payload,
					soundEnabled,
					isManual,
					createdTimestamp: Date.now()
				};
				const kfs = [...s.keyframes, newKf].sort((a, b) => a.time - b.time);
				pushHistorySnapshot(kfs);

				if (
					actionType === 'adjustBalls' ||
					actionType === 'resetBalls' ||
					actionType === 'adjustGames' ||
					actionType === 'setTickerItems'
				) {
					shouldTriggerAutosave = true;
				}

				return updateHistoryFlags({
					...s,
					keyframes: kfs,
					isDirty: true
				});
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
			let shouldTriggerAutosave = true;
			update((s) => {
				const kfs = s.keyframes.filter((k) => k.id !== id);
				pushHistorySnapshot(kfs);
				return updateHistoryFlags({
					...s,
					keyframes: kfs,
					isDirty: true
				});
			});
			return shouldTriggerAutosave;
		},

		clearKeyframes: () => {
			update((s) => {
				pushHistorySnapshot([]);
				return updateHistoryFlags({
					...s,
					keyframes: [],
					isDirty: true
				});
			});
			return true;
		},

		setKeyframes: (kfs) => {
			update((s) => {
				pushHistorySnapshot(kfs);
				return updateHistoryFlags({
					...s,
					keyframes: kfs,
					isDirty: true
				});
			});
		},

		undo: () => {
			let triggered = false;
			update((s) => {
				if (historyIndex > 0) {
					historyIndex--;
					const restoredKfs = JSON.parse(JSON.stringify(undoHistory[historyIndex]));
					triggered = true;
					return updateHistoryFlags({
						...s,
						keyframes: restoredKfs,
						isDirty: true
					});
				}
				return updateHistoryFlags({ ...s });
			});
			return triggered;
		},

		redo: () => {
			let triggered = false;
			update((s) => {
				if (historyIndex < undoHistory.length - 1) {
					historyIndex++;
					const restoredKfs = JSON.parse(JSON.stringify(undoHistory[historyIndex]));
					triggered = true;
					return updateHistoryFlags({
						...s,
						keyframes: restoredKfs,
						isDirty: true
					});
				}
				return updateHistoryFlags({ ...s });
			});
			return triggered;
		},

		setRenderProgress: (progress) =>
			update((s) => ({ ...s, renderProgress: { ...s.renderProgress, ...progress } })),

		saveProjectToServer: async (projectData) => {
			const state = get({ subscribe });
			const payload = {
				...projectData,
				projectName: state.projectName || projectData.projectName
			};

			try {
				const res = await fetch('/api/project/save', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = await res.json();
				if (data.success) {
					update((s) => ({
						...s,
						projectFolder: data.projectFolder,
						videoFolder: data.videoFolder,
						audioFolder: data.audioFolder,
						assetsFolder: data.assetsFolder,
						isDirty: false,
						lastSavedAt: Date.now()
					}));
					return { success: true, data };
				}
				return { success: false, error: data.error };
			} catch (err) {
				return { success: false, error: err.message };
			}
		},

		loadProjectData: (projectData) => {
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				const initialKfs = projectData.keyframes || [];
				undoHistory = [JSON.parse(JSON.stringify(initialKfs))];
				historyIndex = 0;

				return {
					...s,
					videoFile: null,
					videoUrl: null,
					currentTime: 0,
					isPlaying: false,
					projectName: projectData.projectName || s.projectName,
					videoName: projectData.videoName || '',
					duration: projectData.duration || 0,
					keyframes: initialKfs,
					projectFolder: projectData.projectFolder || '',
					videoFolder: projectData.videoFolder || '',
					audioFolder: projectData.audioFolder || '',
					assetsFolder: projectData.assetsFolder || '',
					isDirty: false,
					canUndo: false,
					canRedo: false,
					lastSavedAt: Date.now()
				};
			});
		},

		resetToDefault: () => {
			undoHistory = [];
			historyIndex = -1;
			update((s) => {
				if (s.videoUrl && s.videoUrl.startsWith('blob:')) {
					try {
						URL.revokeObjectURL(s.videoUrl);
					} catch (e) {}
				}
				return { ...initialStudioState };
			});
		}
	};
}

export const studioStore = createStudioStore();
