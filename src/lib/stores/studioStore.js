import { writable, get } from 'svelte/store';

const initialStudioState = {
  projectName: '',
  projectFolder: '',
  videoFolder: '',
  audioFolder: '',
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
      update(s => ({
        ...s,
        videoFile: file,
        videoUrl: url,
        videoName: file.name,
        projectName: s.projectName || file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_'),
        isDirty: true
      }));
    },
    setVideoUrlDirect: (url, name) => {
      update(s => ({
        ...s,
        videoUrl: url,
        videoName: name,
        videoFile: null,
        isDirty: true
      }));
    },
    relinkVideo: (file) => {
      const url = URL.createObjectURL(file);
      update(s => ({
        ...s,
        videoFile: file,
        videoUrl: url,
        videoName: file.name,
        isDirty: true
      }));
    },
    setDuration: (d) => update(s => ({ ...s, duration: d })),
    setTime: (t) => update(s => ({ ...s, currentTime: t })),
    setIsPlaying: (p) => update(s => ({ ...s, isPlaying: p })),

    addKeyframe: (time, actionType, payload, soundEnabled = true, isManual = false) => {
      let shouldTriggerAutosave = false;
      update(s => {
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
        
        if (actionType === 'adjustBalls' || actionType === 'adjustGames' || actionType === 'setTickerItems') {
          shouldTriggerAutosave = true;
        }

        return { ...s, keyframes: kfs, isDirty: true };
      });
      return shouldTriggerAutosave;
    },

    toggleKeyframeSound: (id) => {
      update(s => ({
        ...s,
        keyframes: s.keyframes.map(k => k.id === id ? { ...k, soundEnabled: !k.soundEnabled } : k),
        isDirty: true
      }));
    },

    removeKeyframe: (id) => {
      update(s => ({
        ...s,
        keyframes: s.keyframes.filter(k => k.id !== id),
        isDirty: true
      }));
    },

    clearKeyframes: () => update(s => ({ ...s, keyframes: [], isDirty: true })),

    setRenderProgress: (progress) => update(s => ({ ...s, renderProgress: { ...s.renderProgress, ...progress } })),

    // Guardar en la estructura proyectos_billar/[Nombre]/ sin descargas molestas
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
          update(s => ({
            ...s,
            projectFolder: data.projectFolder,
            videoFolder: data.videoFolder,
            audioFolder: data.audioFolder,
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
      update(s => ({
        ...s,
        projectName: projectData.projectName || s.projectName,
        videoName: projectData.videoName || s.videoName,
        duration: projectData.duration || s.duration,
        keyframes: projectData.keyframes || [],
        isDirty: false,
        lastSavedAt: Date.now()
      }));
    }
  };
}

export const studioStore = createStudioStore();
