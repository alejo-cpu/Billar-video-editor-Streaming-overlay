import { writable } from 'svelte/store';

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

export const initialMatchState = {
  p1: { name: 'JUGADOR 1', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
  p2: { name: 'JUGADOR 2', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
  showAvatars: true,
  turns: { enabled: true, active: 'p1' },
  modality: 'ONE POCKET',
  race: 'RACE TO 3'
};

function createStudioStore() {
  const { subscribe, set, update } = writable({
    videoUrl: null,
    videoFile: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    keyframes: [], // Lista cronológica de eventos
    bgMusic: {
      url: null,
      file: null,
      loop: true,
      fadeIn: true,
      fadeOut: true,
      volume: 0.3
    },
    renderProgress: {
      active: false,
      percent: 0,
      fps: 0,
      eta: '',
      downloadUrl: null
    }
  });

  return {
    subscribe,
    setVideo: (file) => {
      const url = URL.createObjectURL(file);
      update(s => ({ ...s, videoFile: file, videoUrl: url }));
    },
    setDuration: (d) => update(s => ({ ...s, duration: d })),
    setTime: (t) => update(s => ({ ...s, currentTime: t })),
    setIsPlaying: (p) => update(s => ({ ...s, isPlaying: p })),
    setBgMusicFile: (file) => {
      const url = URL.createObjectURL(file);
      update(s => ({ ...s, bgMusic: { ...s.bgMusic, file, url } }));
    },
    updateBgMusicSettings: (settings) => update(s => ({ ...s, bgMusic: { ...s.bgMusic, ...settings } })),
    addKeyframe: (time, actionType, payload, soundEnabled = true) => {
      update(s => {
        const id = Date.now() + Math.random();
        const newKf = { id, time: parseFloat(time.toFixed(2)), actionType, payload, soundEnabled };
        const kfs = [...s.keyframes, newKf].sort((a, b) => a.time - b.time);
        return { ...s, keyframes: kfs };
      });
    },
    toggleKeyframeSound: (id) => {
      update(s => ({
        ...s,
        keyframes: s.keyframes.map(k => k.id === id ? { ...k, soundEnabled: !k.soundEnabled } : k)
      }));
    },
    removeKeyframe: (id) => {
      update(s => ({ ...s, keyframes: s.keyframes.filter(k => k.id !== id) }));
    },
    clearKeyframes: () => update(s => ({ ...s, keyframes: [] })),
    setRenderProgress: (progress) => update(s => ({ ...s, renderProgress: { ...s.renderProgress, ...progress } }))
  };
}

export const studioStore = createStudioStore();
