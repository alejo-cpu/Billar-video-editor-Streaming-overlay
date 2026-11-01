<script>
	import { onMount } from 'svelte';
	import { studioStore } from '../../stores/studioStore.js';
	import StudioHeader from './StudioHeader.svelte';
	import StudioScoreboard from './StudioScoreboard.svelte';
	import StudioTicker from './StudioTicker.svelte';
	import StudioModals from './StudioModals.svelte';
	import EffectsLayer from '../overlay/EffectsLayer.svelte';
	import ImageCropModal from '../control/ImageCropModal.svelte';
	import { liveEffect } from '../../stores/matchStore.js';
	import * as htmlToImage from 'html-to-image';
	import {
		Play,
		Pause,
		Upload,
		Trash2,
		Volume2,
		VolumeX,
		Maximize,
		Minimize,
		ToggleLeft,
		ToggleRight,
		UserCheck,
		ArrowLeftRight,
		Eye,
		EyeOff,
		X,
		Plus,
		ArrowUp,
		ArrowDown,
		ListMusic,
		Video,
		Shuffle,
		FolderOpen,
		ChevronDown,
		ChevronUp,
		ImagePlus,
		Disc,
		Image as ImageIcon,
		RefreshCw,
		RotateCcw,
		Undo2,
		Redo2,
		Trophy,
		Info
	} from 'lucide-svelte';

	let videoContainer;
	let videoElement;
	let bgAudioElement;
	let fileInput;
	let relinkFileInput;
	let projectFileInput;
	let musicFilesInput;
	let musicFolderInput;
	let confettiCanvas;
	let isFullscreen = false;
	let renderWs = null;

	let activeTab = 'players';

	let showCropModalP1 = false;
	let showCropModalP2 = false;
	let showMissingVideoModal = false;
	let showMusicInfoModal = false;
	let showClearConfirmModal = false;
	let suggestedVideoFolder = '';

	let videoAspectCss = '16 / 9';
	let previewScale = 1;
	let resizeObserver = null;

	let showControls = true;
	let hideControlsTimer = null;

	let isPlaylistExpanded = false;
	let isKeyframesExpanded = false;

	let isTickerFrozen = false;
	let isCapturingHud = false;
	let autoSaveTimer = null;
	let saveFeedbackMessage = '';
	let renderErrorData = null;

	function cleanProjectName(str) {
		if (!str) return 'partida';
		return str
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-zA-Z0-9_-]/g, '_');
	}

	function parseTimeToSeconds(val, fallback = 0) {
		if (!val) return fallback;
		const parts = val.split(':').map(Number);
		if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
		if (parts.length === 2) return parts[0] * 60 + parts[1];
		return Number(val) || fallback;
	}

	/* ==================== CONTROL DE AUDIO ==================== */
	let videoAudioSettings = { volume: 1.0, muted: false };

	$: if (videoElement) {
		videoElement.volume = videoAudioSettings.muted ? 0 : videoAudioSettings.volume;
		videoElement.muted = videoAudioSettings.muted;
	}

	let bgSettings = {
		volume: 0.35,
		loop: true,
		fadeIn: true,
		fadeOut: true,
		rangeStart: 0,
		rangeEnd: 0
	};

	let bgPlaylist = [];
	let isSamplingTrack = false;
	let samplingSongId = null;
	let samplingTimer = null;
	let wasVideoPlayingBeforeSample = false;

	let activeTrackSongId = null;
	let playedKeyframeIds = new Set();

	const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

	const DEFAULT_TICKER_ITEMS = [
		{ id: 1, type: 'sponsor', text: 'HDP BILLAR', logoUrl: '', active: true }
	];

	const DEFAULT_STUDIO_CONFIG = {
		p1: { name: 'JUGADOR 1', avatar: DEFAULT_AVATAR, pocket: '' },
		p2: { name: 'JUGADOR 2', avatar: DEFAULT_AVATAR, pocket: '' },
		showAvatars: true,
		turns: { enabled: true, active: 'p1' },
		modality: 'ONE POCKET',
		race: 'RACE TO 3',
		uiScale: { hud: 1.0, ticker: 1.0 },
		ticker: {
			visible: true,
			items: DEFAULT_TICKER_ITEMS
		}
	};

	const EMOJI_REACTIONS = [
		{ key: 'confetti', icon: '🎉', img: '/stickers/confetti.webp' },
		{ key: 'fire', icon: '🔥', img: '/stickers/fire.webp' },
		{ key: 'wink', icon: '😉', img: '/stickers/wink.webp' },
		{ key: 'sunglasses', icon: '😎', img: '/stickers/sunglasses.webp' },
		{ key: 'clap', icon: '👏', img: '/stickers/clap.webp' },
		{ key: 'target', icon: '🎯', img: '/stickers/target.webp' },
		{ key: 'crown', icon: '👑', img: '/stickers/crown.webp' },
		{ key: 'ball8', icon: '🎱', img: '/stickers/ball8.webp' }
	];

	/* ==================== ESTADO BASE AISLADO ==================== */
	let studioConfig = JSON.parse(JSON.stringify(DEFAULT_STUDIO_CONFIG));
	let masterTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));
	let stagedTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));
	let initialTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));

	let newTickerText = '';
	let newTickerType = 'sponsor';
	let newTickerLogo = '';
	let logoUploadTab = 'file';

	function handleTickerLogoFile(e) {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (ev) => {
				newTickerLogo = ev.target.result;
			};
			reader.readAsDataURL(file);
		}
	}

	function getActiveItemsAtTime(t) {
		const past = keyframes.filter((k) => k.time <= t + 0.05 && k.actionType === 'setTickerItems');
		if (past.length > 0) {
			return past[past.length - 1].payload?.items || [];
		}
		return initialTickerItems || [];
	}

	function syncTickerStateForCurrentTime(t) {
		if (!masterTickerItems || masterTickerItems.length === 0) {
			stagedTickerItems = [];
			return;
		}
		const activeList = getActiveItemsAtTime(t);
		const activeIds = new Set(activeList.map((it) => String(it.id || it.text)));

		stagedTickerItems = masterTickerItems.map((item) => ({
			...item,
			active: activeIds.has(String(item.id || item.text))
		}));
	}

	let lastTimelineCheckedTime = 0;
	$: {
		if (isPlaying && Math.abs(currentTime - lastTimelineCheckedTime) > 0.1) {
			const crossedTickerKf = keyframes.some(
				(k) =>
					k.actionType === 'setTickerItems' &&
					k.time > Math.min(lastTimelineCheckedTime, currentTime) &&
					k.time <= Math.max(lastTimelineCheckedTime, currentTime) + 0.05
			);
			if (crossedTickerKf) {
				syncTickerStateForCurrentTime(currentTime);
			}
			lastTimelineCheckedTime = currentTime;
		}
	}

	function addDraftTickerItem() {
		if (!newTickerText.trim()) return;
		const newItem = {
			id: Date.now(),
			type: newTickerType,
			text: newTickerText.trim().toUpperCase(),
			logoUrl: newTickerLogo.trim(),
			active: true
		};

		masterTickerItems = [...masterTickerItems, newItem];
		stagedTickerItems = [...stagedTickerItems, newItem];
		newTickerText = '';
		newTickerLogo = '';
		showFeedback('Elemento añadido. Pulsa "Aplicar Cambios" para grabarlo');
	}

	function toggleDraftTickerItem(id) {
		stagedTickerItems = stagedTickerItems.map((i) =>
			i.id === id ? { ...i, active: !i.active } : i
		);
		masterTickerItems = masterTickerItems.map((i) =>
			i.id === id ? { ...i, active: !i.active } : i
		);
	}

	function removeDraftTickerItem(id) {
		masterTickerItems = masterTickerItems.filter((i) => i.id !== id);
		stagedTickerItems = stagedTickerItems.filter((i) => i.id !== id);
		showFeedback('Elemento eliminado de la lista');
	}

	function applyStudioTickerChanges() {
		studioConfig.ticker.items = JSON.parse(JSON.stringify(masterTickerItems));
		const activeAtThisSecond = stagedTickerItems.filter((i) => i.active);

		if (currentTime < 0.25) {
			initialTickerItems = JSON.parse(JSON.stringify(activeAtThisSecond));
		}

		const existingKf = keyframes.find(
			(k) => k.actionType === 'setTickerItems' && Math.abs(k.time - currentTime) < 0.35
		);
		if (existingKf) {
			existingKf.payload = { items: activeAtThisSecond };
			studioStore.setKeyframes([...keyframes]);
		} else {
			triggerKeyframeWithAutosave(currentTime, 'setTickerItems', { items: activeAtThisSecond });
		}
		showFeedback('✓ Cambios aplicados a la cinta en [' + formatTime(currentTime) + ']');
	}

	/* ==================== RESET Y CIERRE ==================== */
	function showFeedback(msg) {
		saveFeedbackMessage = msg;
		setTimeout(() => {
			saveFeedbackMessage = '';
		}, 4500);
	}

	function resetAllToFactoryDefault() {
		if (videoElement) {
			try {
				videoElement.pause();
				videoElement.currentTime = 0;
			} catch (e) {}
		}
		if (bgAudioElement) {
			try {
				bgAudioElement.pause();
				bgAudioElement.currentTime = 0;
				bgAudioElement.src = '';
			} catch (e) {}
		}
		activeTrackSongId = null;
		isSamplingTrack = false;
		samplingSongId = null;
		playedKeyframeIds = new Set();
		lastCheckedTime = 0;
		lastTimelineCheckedTime = 0;

		studioStore.resetToDefault();

		studioConfig = JSON.parse(JSON.stringify(DEFAULT_STUDIO_CONFIG));
		masterTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));
		stagedTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));
		initialTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));

		bgPlaylist = [];
		bgSettings = {
			volume: 0.35,
			loop: true,
			fadeIn: true,
			fadeOut: true,
			rangeStart: 0,
			rangeEnd: 0
		};
		videoAudioSettings = { volume: 1.0, muted: false };
		newTickerText = '';
		newTickerLogo = '';
		showMissingVideoModal = false;
		showClearConfirmModal = false;
	}

	function handleCloseProject() {
		if ($studioStore.isDirty) {
			const confirmClose = confirm(
				'Tienes cambios sin guardar en este proyecto. ¿Seguro que deseas cerrarlo?'
			);
			if (!confirmClose) return;
		}
		resetAllToFactoryDefault();
		showFeedback('✓ Proyecto cerrado');
	}

	function buildProjectPayload() {
		studioConfig.ticker.items = JSON.parse(JSON.stringify(masterTickerItems));
		const projClean = cleanProjectName(
			$studioStore.projectName ||
				($studioStore.videoName
					? $studioStore.videoName.replace(/\.[^/.]+$/, '')
					: 'partida_billar')
		);
		return {
			version: '2.0',
			projectName: projClean,
			videoName: $studioStore.videoName || '',
			duration: duration || 0,
			studioConfig: JSON.parse(JSON.stringify(studioConfig)),
			initialTickerItems: JSON.parse(JSON.stringify(initialTickerItems)),
			keyframes: $studioStore.keyframes,
			bgSettings,
			bgPlaylist: bgPlaylist.map((s) => ({
				id: s.id,
				name: s.name,
				duration: s.duration,
				serverUrl: s.url
			})),
			videoAudioSettings,
			savedAt: Date.now()
		};
	}

	async function handleSaveProject() {
		const payload = buildProjectPayload();
		const res = await studioStore.saveProjectToServer(payload);
		if (res?.success) {
			showFeedback(`✓ Guardado: ${payload.projectName}`);
		} else {
			alert('Error guardando en servidor: ' + (res?.error || 'Desconocido'));
		}
	}

	function handleProjectFileLoad(e) {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (ev) => {
			try {
				const data = JSON.parse(ev.target.result);
				await loadProjectFromObject(data);
				showFeedback('Proyecto abierto: ' + file.name);
			} catch (err) {
				alert('Error al leer el archivo de proyecto: ' + err.message);
			}
		};
		reader.readAsText(file);
		e.target.value = '';
	}

	async function loadProjectFromObject(projectData) {
		if (!projectData) return;

		resetAllToFactoryDefault();

		if (projectData.studioConfig) {
			studioConfig = JSON.parse(JSON.stringify(projectData.studioConfig));
		}

		if (
			projectData.studioConfig?.ticker?.items &&
			Array.isArray(projectData.studioConfig.ticker.items) &&
			projectData.studioConfig.ticker.items.length > 0
		) {
			masterTickerItems = JSON.parse(JSON.stringify(projectData.studioConfig.ticker.items));
		} else if (
			projectData.initialTickerItems &&
			Array.isArray(projectData.initialTickerItems) &&
			projectData.initialTickerItems.length > 0
		) {
			masterTickerItems = JSON.parse(JSON.stringify(projectData.initialTickerItems));
		} else {
			masterTickerItems = JSON.parse(JSON.stringify(DEFAULT_TICKER_ITEMS));
		}

		if (projectData.initialTickerItems && Array.isArray(projectData.initialTickerItems)) {
			initialTickerItems = JSON.parse(JSON.stringify(projectData.initialTickerItems));
		} else {
			initialTickerItems = JSON.parse(
				JSON.stringify(masterTickerItems.filter((it) => it.active !== false))
			);
		}

		stagedTickerItems = JSON.parse(JSON.stringify(masterTickerItems));
		syncTickerStateForCurrentTime(0);

		if (projectData.bgSettings) bgSettings = { ...projectData.bgSettings };
		if (projectData.videoAudioSettings) videoAudioSettings = { ...projectData.videoAudioSettings };

		if (projectData.bgPlaylist && Array.isArray(projectData.bgPlaylist)) {
			bgPlaylist = projectData.bgPlaylist.map((p) => ({
				id: p.id,
				name: p.name,
				duration: p.duration,
				url: p.serverUrl || `/proyectos_billar/${projectData.projectName}/audio/${p.name}.mp3`,
				file: null
			}));
		} else {
			bgPlaylist = [];
		}

		studioStore.loadProjectData(projectData);

		const projName = cleanProjectName(projectData.projectName);
		suggestedVideoFolder = `public/proyectos_billar/${projName}/video`;

		try {
			const checkRes = await fetch(
				`/api/project/check-video?project=${encodeURIComponent(projName)}`
			);
			const checkData = await checkRes.json();
			suggestedVideoFolder = checkData.suggestedPath || suggestedVideoFolder;

			if (checkData.exists && checkData.videoUrl) {
				studioStore.setVideoUrlDirect(checkData.videoUrl, checkData.videoName);
				showMissingVideoModal = false;
				return;
			}
		} catch (e) {}

		showMissingVideoModal = true;
	}

	function handleRelinkVideo(e) {
		const file = e.target.files?.[0];
		if (file) {
			studioStore.relinkVideo(file);
			showMissingVideoModal = false;
			showFeedback('Video vinculado: ' + file.name);
		}
		e.target.value = '';
	}

	/* ==================== AUDIO Y ONDA BEZIER ==================== */
	$: totalPlaylistSeconds = bgPlaylist.reduce((acc, s) => acc + (s.duration || 120), 0);

	$: if (duration > 0 && bgSettings.rangeEnd === 0) {
		bgSettings.rangeEnd = duration;
	}

	function handleRangeChange() {
		if (!bgSettings.loop && totalPlaylistSeconds > 0) {
			const maxPossibleEnd = (bgSettings.rangeStart || 0) + totalPlaylistSeconds;
			if (bgSettings.rangeEnd > maxPossibleEnd) {
				bgSettings.rangeEnd = Math.min(duration || maxPossibleEnd, maxPossibleEnd);
			}
		}
	}

	function computeFadeVolume(videoSec) {
		const rStart = bgSettings.rangeStart || 0;
		const rEnd = bgSettings.rangeEnd > 0 ? bgSettings.rangeEnd : duration || 0;
		const maxVol = Math.max(0, Math.min(1.0, bgSettings.volume ?? 0.35));

		if (videoSec < rStart || videoSec > rEnd) return 0;
		const span = rEnd - rStart;
		if (span <= 0) return 0;
		const fadeWindow = Math.min(3, span / 2);

		if (videoSec - rStart < fadeWindow && fadeWindow > 0) {
			return maxVol * ((videoSec - rStart) / fadeWindow);
		}
		if (rEnd - videoSec < fadeWindow && fadeWindow > 0) {
			return maxVol * ((rEnd - videoSec) / fadeWindow);
		}
		return maxVol;
	}

	function getTrackAtVideoTime(videoSec) {
		if (!bgPlaylist || !bgPlaylist.length) return null;
		const rStart = bgSettings.rangeStart || 0;
		const rEnd = bgSettings.rangeEnd > 0 ? bgSettings.rangeEnd : duration || 0;

		if (videoSec < rStart || videoSec > rEnd || totalPlaylistSeconds <= 0) return null;

		let timeInMusic = videoSec - rStart;
		if (bgSettings.loop) {
			timeInMusic = timeInMusic % totalPlaylistSeconds;
		} else if (timeInMusic >= totalPlaylistSeconds) {
			return null;
		}

		let accumulated = 0;
		for (let i = 0; i < bgPlaylist.length; i++) {
			const s = bgPlaylist[i];
			const sDur = s.duration || 120;
			if (timeInMusic >= accumulated && timeInMusic < accumulated + sDur) {
				return { song: s, index: i, offset: timeInMusic - accumulated, songDuration: sDur };
			}
			accumulated += sDur;
		}
		return null;
	}

	$: currentTrackInfo = getTrackAtVideoTime(currentTime);

	function syncAudioWithVideo(videoSec, playing) {
		if (!bgAudioElement || !bgPlaylist.length || isSamplingTrack) return;

		const track = getTrackAtVideoTime(videoSec);
		const targetVolume = computeFadeVolume(videoSec);
		bgAudioElement.volume = targetVolume;

		if (!track || targetVolume <= 0.001) {
			if (!bgAudioElement.paused) bgAudioElement.pause();
			return;
		}

		if (activeTrackSongId !== track.song.id) {
			activeTrackSongId = track.song.id;
			bgAudioElement.src = track.song.url;
			bgAudioElement.currentTime = track.offset;
			if (playing) bgAudioElement.play().catch(() => {});
		} else {
			if (Math.abs(bgAudioElement.currentTime - track.offset) > 1.2) {
				bgAudioElement.currentTime = track.offset;
			}
			if (playing && bgAudioElement.paused) {
				bgAudioElement.play().catch(() => {});
			} else if (!playing && !bgAudioElement.paused) {
				bgAudioElement.pause();
			}
		}
	}

	$: syncAudioWithVideo(currentTime, isPlaying);

	$: wavePathD = (() => {
		if (!bgPlaylist || bgPlaylist.length === 0) return '';
		const points = [];
		const numPoints = 32;

		for (let i = 0; i <= numPoints; i++) {
			const songIdx = Math.floor((i / numPoints) * bgPlaylist.length) % bgPlaylist.length;
			const song = bgPlaylist[songIdx];
			const seed = (song.name.length * 19 + songIdx * 37 + i * 13) % 100;
			const h = i === 0 || i === numPoints ? 0 : 5 + (seed % 14) + Math.sin(i * 0.75) * 6;
			points.push({ x: (i / numPoints) * 100, y: 26 - h });
		}

		let d = `M 0,26 L 0,${points[0].y}`;
		for (let i = 0; i < points.length - 1; i++) {
			const p0 = points[i];
			const p1 = points[i + 1];
			const cx = (p0.x + p1.x) / 2;
			d += ` Q ${p0.x},${p0.y} ${cx},${(p0.y + p1.y) / 2}`;
		}
		const lastP = points[points.length - 1];
		d += ` L ${lastP.x},${lastP.y} L 100,26 Z`;
		return d;
	})();

	function previewSongSample(song) {
		if (!bgAudioElement) return;
		if (isSamplingTrack && samplingSongId === song.id) {
			stopSongSample();
			return;
		}
		if (isSamplingTrack) stopSongSample();

		wasVideoPlayingBeforeSample = isPlaying;
		if (videoElement && !videoElement.paused) {
			videoElement.pause();
			studioStore.setIsPlaying(false);
		}

		isSamplingTrack = true;
		samplingSongId = song.id;

		const midpoint = Math.max(0, (song.duration || 120) * 0.45);
		bgAudioElement.src = song.url;
		bgAudioElement.currentTime = midpoint;
		bgAudioElement.volume = Math.max(0, Math.min(1.0, bgSettings.volume ?? 0.35));
		bgAudioElement.play().catch(() => {});

		if (samplingTimer) clearTimeout(samplingTimer);
		samplingTimer = setTimeout(() => {
			stopSongSample();
		}, 6000);
	}

	function stopSongSample() {
		if (samplingTimer) clearTimeout(samplingTimer);
		isSamplingTrack = false;
		samplingSongId = null;
		activeTrackSongId = null;
		if (bgAudioElement) bgAudioElement.pause();

		if (wasVideoPlayingBeforeSample && videoElement) {
			videoElement.play();
			studioStore.setIsPlaying(true);
		}
		wasVideoPlayingBeforeSample = false;
		syncAudioWithVideo(currentTime, isPlaying);
	}

	async function handleMusicUpload(e) {
		const files = Array.from(e.target.files || []).filter((f) => {
			return f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name);
		});
		if (!files.length) return;

		const projName = cleanProjectName($studioStore.projectName);

		for (const file of files) {
			try {
				const res = await fetch(
					`/api/project/upload-audio?project=${encodeURIComponent(projName)}`,
					{
						method: 'POST',
						headers: { 'x-file-name': encodeURIComponent(file.name) },
						body: file
					}
				);
				const data = await res.json();
				const songUrl = data.publicUrl || URL.createObjectURL(file);
				const songName = file.name.replace(/\.[^/.]+$/, '');

				const newTrack = {
					id: Date.now() + Math.random(),
					name: songName,
					file,
					url: songUrl,
					duration: 180
				};

				const a = new Audio(songUrl);
				a.onloadedmetadata = () => {
					if (Number.isFinite(a.duration) && a.duration > 0) {
						newTrack.duration = Math.round(a.duration);
						bgPlaylist = [...bgPlaylist];
						handleRangeChange();
					}
				};

				bgPlaylist = [...bgPlaylist, newTrack];
			} catch (err) {
				console.warn('Error subiendo audio al proyecto:', err);
			}
		}

		e.target.value = '';
		handleRangeChange();
	}

	function moveSong(index, direction) {
		const target = index + direction;
		if (target < 0 || target >= bgPlaylist.length) return;
		const item = bgPlaylist[index];
		const newArr = [...bgPlaylist];
		newArr.splice(index, 1);
		newArr.splice(target, 0, item);
		bgPlaylist = newArr;
		activeTrackSongId = null;
	}

	function removeSong(id) {
		bgPlaylist = bgPlaylist.filter((s) => s.id !== id);
		if (samplingSongId === id) stopSongSample();
		activeTrackSongId = null;
		handleRangeChange();
	}

	function clearPlaylist() {
		bgPlaylist = [];
		if (samplingSongId) stopSongSample();
		activeTrackSongId = null;
		if (bgAudioElement) {
			bgAudioElement.pause();
			bgAudioElement.src = '';
		}
	}

	function shufflePlaylistOnce() {
		if (bgPlaylist.length <= 1) return;
		const copy = [...bgPlaylist];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		bgPlaylist = copy;
		activeTrackSongId = null;
		showFeedback('Lista mezclada');
	}

	function resetControlsTimeout() {
		showControls = true;
		if (hideControlsTimer) clearTimeout(hideControlsTimer);
		hideControlsTimer = setTimeout(() => {
			showControls = false;
		}, 2500);
	}

	function handleBeforeUnload(e) {
		if (
			$studioStore.isDirty ||
			$studioStore.projectName ||
			$studioStore.videoUrl ||
			$studioStore.keyframes.length > 0
		) {
			e.preventDefault();
			e.returnValue = '';
			return '';
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('beforeunload', handleBeforeUnload);

		if (videoContainer) {
			resizeObserver = new ResizeObserver(() => updatePreviewScale());
			resizeObserver.observe(videoContainer);
			updatePreviewScale();
		}

		autoSaveTimer = setInterval(
			() => {
				if ($studioStore.videoFile && $studioStore.keyframes.length > 0) {
					handleSaveProject();
				}
			},
			1000 * 60 * 5
		);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('beforeunload', handleBeforeUnload);
			if (resizeObserver) resizeObserver.disconnect();
			if (hideControlsTimer) clearTimeout(hideControlsTimer);
			if (autoSaveTimer) clearInterval(autoSaveTimer);
			if (samplingTimer) clearTimeout(samplingTimer);
		};
	});

	function updateVideoAspect() {
		if (videoElement && videoElement.videoWidth && videoElement.videoHeight) {
			videoAspectCss = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;
		}
	}

	function updatePreviewScale() {
		if (videoContainer) {
			const w = videoContainer.clientWidth;
			if (w > 0) previewScale = w / 1920;
		}
	}

	function handleKeyDown(e) {
		const tag = e.target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable)
			return;

		if (e.code === 'Space') {
			e.preventDefault();
			togglePlay();
		} else if (e.code === 'ArrowRight') {
			e.preventDefault();
			seek(currentTime + 5);
		} else if (e.code === 'ArrowLeft') {
			e.preventDefault();
			seek(currentTime - 5);
		}
	}

	$: videoUrl = $studioStore.videoUrl;
	$: currentTime = $studioStore.currentTime;
	$: duration = $studioStore.duration;
	$: isPlaying = $studioStore.isPlaying;
	$: keyframes = $studioStore.keyframes;
	$: renderProgress = $studioStore.renderProgress;

	function togglePlay() {
		if (!videoElement) return;
		if (isSamplingTrack) stopSongSample();
		resetControlsTimeout();
		if (videoElement.paused) {
			videoElement.play();
			studioStore.setIsPlaying(true);
		} else {
			videoElement.pause();
			studioStore.setIsPlaying(false);
		}
	}

	function seek(t) {
		if (!videoElement) return;
		resetControlsTimeout();
		const safeT = Math.max(0, Math.min(duration || 0, t));
		videoElement.currentTime = safeT;
		studioStore.setTime(safeT);
		syncAudioWithVideo(safeT, isPlaying);
		syncTickerStateForCurrentTime(safeT);

		playedKeyframeIds.forEach((id) => {
			const kf = keyframes.find((k) => k.id === id);
			if (kf && kf.time > safeT) {
				playedKeyframeIds.delete(id);
			}
		});
	}

	function formatTime(s) {
		if (!s || isNaN(s)) return '00:00:00';
		const hrs = Math.floor(s / 3600);
		const mins = Math.floor((s % 3600) / 60);
		const secs = Math.floor(s % 60);
		return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function playClickAudio(type) {
		try {
			let soundPath = '';
			if (type === 'point-plus') soundPath = '/sounds/+1 Point.mp3';
			else if (type === 'point-minus') soundPath = '/sounds/-1 Point.mp3';
			else if (type === 'game-plus') soundPath = '/sounds/+1 Games.mp3';
			if (soundPath) {
				const a = new Audio(soundPath);
				a.volume = 0.5;
				a.play().catch(() => {});
			}
		} catch (e) {}
	}

	function triggerKeyframeWithAutosave(time, type, payload, sound = true) {
		const shouldSave = studioStore.addKeyframe(time, type, payload, sound, true);
		if (shouldSave) {
			setTimeout(() => {
				handleSaveProject();
			}, 1000);
		}
	}

	function markBalls(playerKey, delta) {
		playClickAudio(delta > 0 ? 'point-plus' : 'point-minus');
		triggerKeyframeWithAutosave(currentTime, 'adjustBalls', { playerKey, delta }, false);
	}

	function markResetBalls(playerKey) {
		playClickAudio('point-minus');
		triggerKeyframeWithAutosave(
			currentTime,
			'resetBalls',
			{ playerKey, name: studioConfig[playerKey].name },
			false
		);
	}

	function markGames(playerKey, delta) {
		if (delta > 0) playClickAudio('game-plus');
		triggerKeyframeWithAutosave(currentTime, 'adjustGames', { playerKey, delta }, false);
	}

	function markPocket(playerKey, pocket) {
		triggerKeyframeWithAutosave(currentTime, 'setPocket', { playerKey, pocket }, false);
	}

	function markSwitchTurn() {
		const nextTurn = activeState.turns.active === 'p1' ? 'p2' : 'p1';
		triggerKeyframeWithAutosave(currentTime, 'switchTurn', { active: nextTurn }, false);
	}

	function markToggleTurns() {
		const nextEnabled = !activeState.turns.enabled;
		triggerKeyframeWithAutosave(currentTime, 'toggleTurns', { enabled: nextEnabled }, false);
	}

	let soundToggle = true;
	let lastCheckedTime = 0;

	function markEffect(effect, playerKey) {
		lastCheckedTime = currentTime;
		triggerKeyframeWithAutosave(currentTime, 'effect', { effect, playerKey }, soundToggle);
		liveEffect.set({ effect, playerKey, soundEnabled: soundToggle, id: Date.now() });
	}

	function markTickerToggle(visible) {
		triggerKeyframeWithAutosave(currentTime, 'toggleTicker', { visible }, false);
	}

	function removeKeyframeWithAutosave(id) {
		const shouldSave = studioStore.removeKeyframe(id);
		if (shouldSave) {
			setTimeout(() => {
				handleSaveProject();
			}, 1000);
		}
	}

	function confirmClearAllKeyframes() {
		showClearConfirmModal = false;
		studioStore.clearKeyframes();
		setTimeout(() => {
			handleSaveProject();
		}, 1000);
		showFeedback('✓ Marcas eliminadas');
	}

	$: activeState = (() => {
		let state = {
			p1: { ...studioConfig.p1, balls: 0, games: 0 },
			p2: { ...studioConfig.p2, balls: 0, games: 0 },
			showAvatars: studioConfig.showAvatars,
			turns: { ...studioConfig.turns },
			modality: studioConfig.modality,
			race: studioConfig.race,
			uiScale: { ...studioConfig.uiScale },
			ticker: {
				visible: studioConfig.ticker.visible,
				items: initialTickerItems
			}
		};

		const past = keyframes.filter((k) => k.time <= currentTime + 0.05);

		for (const k of past) {
			if (k.actionType === 'setPocket') {
				state[k.payload.playerKey].pocket = k.payload.pocket;
				const other = k.payload.playerKey === 'p1' ? 'p2' : 'p1';
				state[other].pocket = k.payload.pocket === 'L' ? 'R' : 'L';
			} else if (k.actionType === 'adjustBalls') {
				state[k.payload.playerKey].balls = state[k.payload.playerKey].balls + k.payload.delta;
			} else if (k.actionType === 'resetBalls') {
				state[k.payload.playerKey].balls = 0;
			} else if (k.actionType === 'adjustGames') {
				state[k.payload.playerKey].games = Math.max(
					0,
					state[k.payload.playerKey].games + k.payload.delta
				);
			} else if (k.actionType === 'switchTurn') {
				state.turns.active = k.payload.active;
			} else if (k.actionType === 'toggleTurns') {
				state.turns.enabled = k.payload.enabled;
			} else if (k.actionType === 'toggleTicker') {
				state.ticker.visible = k.payload.visible;
			} else if (k.actionType === 'setTickerItems') {
				state.ticker.items = k.payload.items;
			}
		}
		return state;
	})();

	$: {
		if (isPlaying && Math.abs(currentTime - lastCheckedTime) > 0.08) {
			const crossed = keyframes.filter((k) => k.time > lastCheckedTime && k.time <= currentTime);
			crossed.forEach((ev) => {
				if (playedKeyframeIds.has(ev.id)) return;

				if (ev.isManual && Date.now() - (ev.createdTimestamp || 0) < 1000) {
					playedKeyframeIds.add(ev.id);
					return;
				}

				playedKeyframeIds.add(ev.id);

				if (ev.actionType === 'adjustBalls' || ev.actionType === 'resetBalls') {
					playClickAudio(ev.payload.delta > 0 ? 'point-plus' : 'point-minus');
				} else if (ev.actionType === 'adjustGames' && ev.payload.delta > 0) {
					playClickAudio('game-plus');
				} else if (ev.actionType === 'effect') {
					liveEffect.set({
						effect: ev.payload.effect,
						playerKey: ev.payload.playerKey,
						soundEnabled: ev.soundEnabled,
						id: Date.now()
					});
				}
			});
			lastCheckedTime = currentTime;
		} else if (!isPlaying) {
			lastCheckedTime = currentTime;
		}
	}

	async function captureCleanPng(element, options = {}) {
		let svgDataUrl = await htmlToImage.toSvg(element, options);
		svgDataUrl = svgDataUrl.replace(
			/\b(width|height):\s*([0-9.]+)(?!px|%|em|rem|vw|vh)/gi,
			'$1: $2px'
		);

		const img = new window.Image();
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = svgDataUrl;
		});

		const pixelRatio = options.pixelRatio || 1;
		const w = Math.max(
			1,
			Math.round((options.width || element.offsetWidth || img.width) * pixelRatio)
		);
		const h = Math.max(
			1,
			Math.round((options.height || element.offsetHeight || img.height) * pixelRatio)
		);

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, 0, 0, w, h);

		return canvas.toDataURL('image/png');
	}

	let isUploadingForRender = false;

	async function triggerRender() {
		if (!$studioStore.videoFile && !$studioStore.videoUrl) return;
		isUploadingForRender = true;
		renderErrorData = null;

		try {
			const hudCard =
				videoContainer.querySelector('.studio-scoreboard-card') ||
				videoContainer.querySelector('header');
			const hudSnapshots = [];
			const tickerSnapshots = [];

			if (document.fonts) await document.fonts.ready;

			const scoreEvents = keyframes.filter(
				(k) =>
					k.actionType === 'adjustBalls' ||
					k.actionType === 'resetBalls' ||
					k.actionType === 'adjustGames' ||
					k.actionType === 'setPocket' ||
					k.actionType === 'switchTurn'
			);
			const sortedScoreTimes = [0, ...scoreEvents.map((k) => k.time), duration].sort(
				(a, b) => a - b
			);
			const uniqueScoreTimes = [...new Set(sortedScoreTimes)];

			// Captura estática limpia con números fijados y sin transiciones a medio camino
			isCapturingHud = true;
			await new Promise((r) => setTimeout(r, 60));

			for (let i = 0; i < uniqueScoreTimes.length - 1; i++) {
				const tStart = uniqueScoreTimes[i];
				const tEnd = uniqueScoreTimes[i + 1];
				seek(tStart + 0.02);
				await new Promise((r) => setTimeout(r, 60));

				const dataUrl = await captureCleanPng(hudCard, { pixelRatio: 2, skipFonts: true });
				hudSnapshots.push({ start: tStart, end: tEnd, dataUrl });
			}
			isCapturingHud = false;

			const tickerEvents = keyframes.filter(
				(k) => k.actionType === 'setTickerItems' || k.actionType === 'toggleTicker'
			);
			const sortedTickerTimes = [0, ...tickerEvents.map((k) => k.time), duration].sort(
				(a, b) => a - b
			);
			const uniqueTickerTimes = [...new Set(sortedTickerTimes)];

			isTickerFrozen = true;
			await new Promise((r) => setTimeout(r, 90));

			for (let i = 0; i < uniqueTickerTimes.length - 1; i++) {
				const tStart = uniqueTickerTimes[i];
				const tEnd = uniqueTickerTimes[i + 1];
				seek(tStart + 0.02);
				await new Promise((r) => setTimeout(r, 60));

				// Clasificamos si el cambio en tStart es de visibilidad (ocultar/mostrar) o de marcas (desvanecer)
				const matchedEvent = keyframes.find(
					(k) => Math.abs(k.time - tStart) < 0.25 && (k.actionType === 'toggleTicker' || k.actionType === 'setTickerItems')
				);
				const transitionType = matchedEvent?.actionType === 'toggleTicker' || i === 0 ? 'visibility' : 'fade';

				const tickSegment = videoContainer.querySelector('.studio-marquee-segment');
				if (
					activeState.ticker.visible &&
					activeState.ticker.items.some((it) => it.active) &&
					tickSegment
				) {
					try {
						const dataUrl = await captureCleanPng(tickSegment, { pixelRatio: 1, skipFonts: true });
						tickerSnapshots.push({ start: tStart, end: tEnd, visible: true, dataUrl, transitionType });
					} catch (e) {}
				}
			}

			isTickerFrozen = false;

			let videoFileNameToUse = $studioStore.videoName;
			if ($studioStore.videoFile) {
				const resVideo = await fetch('/api/upload-media', {
					method: 'POST',
					headers: { 'x-file-name': encodeURIComponent($studioStore.videoFile.name) },
					body: $studioStore.videoFile
				});
				const videoData = await resVideo.json();
				videoFileNameToUse = videoData.filename;
			}

			const uploadedPlaylist = [];
			for (const song of bgPlaylist) {
				uploadedPlaylist.push({
					filename: song.url.replace(/^\//, ''),
					duration: song.duration
				});
			}

			isUploadingForRender = false;

			const host =
				typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
			const ws = new WebSocket(`ws://${host}:3001`);
			renderWs = ws;

			ws.onopen = () => {
				studioStore.setRenderProgress({ active: true, percent: 0, fps: 0, eta: '' });
				ws.send(
					JSON.stringify({
						type: 'START_RENDER',
						payload: {
							videoFileName: videoFileNameToUse,
							projectName: $studioStore.projectName,
							events: keyframes,
							duration,
							bgSettings,
							bgPlaylist: uploadedPlaylist,
							videoAudioSettings,
							hudSnapshots,
							tickerSnapshots,
							uiScale: activeState.uiScale
						}
					})
				);
			};

			ws.onmessage = (e) => {
				const msg = JSON.parse(e.data);
				if (msg.type === 'RENDER_PROGRESS') {
					studioStore.setRenderProgress(msg.payload);
				} else if (msg.type === 'RENDER_ERROR') {
					studioStore.setRenderProgress({ active: false, percent: 0, fps: 0 });
					renderErrorData =
						typeof msg.payload === 'object'
							? msg.payload
							: {
									title: 'Inconveniente en la exportación',
									description: String(msg.payload),
									solution: 'Verifica que el video esté disponible y los archivos no estén en uso.'
								};
				}
			};
		} catch (err) {
			isTickerFrozen = false;
			isCapturingHud = false;
			isUploadingForRender = false;
			renderErrorData = {
				title: 'Error inesperado al preparar render',
				description: err.message,
				solution: 'Comprueba tu conexión local y vuelve a intentarlo.'
			};
		}
	}

	function handleCancelRender() {
		if (confirm('¿Deseas cancelar el renderizado?')) {
			if (renderWs && renderWs.readyState === WebSocket.OPEN) {
				renderWs.send(JSON.stringify({ type: 'CANCEL_RENDER' }));
				renderWs.close();
			}
			renderWs = null;
			isUploadingForRender = false;
			studioStore.setRenderProgress({
				active: false,
				percent: 0,
				fps: 0,
				eta: '',
				downloadUrl: null
			});
		}
	}
</script>

<div
	class="min-h-screen bg-[#07080b] text-white font-sans flex flex-col overflow-x-hidden select-none"
>
	<StudioHeader
		projectName={$studioStore.projectName}
		isDirty={$studioStore.isDirty}
		{saveFeedbackMessage}
		{videoUrl}
		on:open={() => projectFileInput.click()}
		on:save={handleSaveProject}
		on:relink={() => relinkFileInput.click()}
		on:close={handleCloseProject}
		on:render={triggerRender}
	/>

	<main class="flex-1 grid grid-cols-[1fr_400px] gap-4 p-4 overflow-hidden">
		<div class="flex flex-col gap-3 min-w-0">
			<!-- REPRODUCTOR DE VIDEO CON EVENTOS on:ended, on:pause y on:play -->
			<div
				bind:this={videoContainer}
				tabindex="0"
				role="region"
				aria-label="Reproductor de video y marcador"
				on:mousemove={resetControlsTimeout}
				on:mouseenter={resetControlsTimeout}
				class="relative bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center shadow-2xl group [transform:translateZ(0)] mx-auto w-full outline-none"
				style="
          height: 68vh;
          max-height: 68vh;
          aspect-ratio: {videoAspectCss};
          max-width: calc(68vh * ({videoAspectCss}));
        "
				on:dragover|preventDefault
				on:drop|preventDefault={(e) => {
					const file = e.dataTransfer?.files?.[0];
					if (file) studioStore.setVideo(file);
				}}
			>
				{#if videoUrl}
					<video
						bind:this={videoElement}
						src={videoUrl}
						class="w-full h-full object-cover"
						on:timeupdate={() => studioStore.setTime(videoElement.currentTime)}
						on:ended={() => {
							studioStore.setIsPlaying(false);
							if (bgAudioElement && !bgAudioElement.paused) bgAudioElement.pause();
						}}
						on:pause={() => {
							if (!isSamplingTrack) studioStore.setIsPlaying(false);
						}}
						on:play={() => {
							studioStore.setIsPlaying(true);
						}}
						on:loadedmetadata={() => {
							studioStore.setDuration(videoElement.duration);
							updateVideoAspect();
							updatePreviewScale();
							if (bgSettings.rangeEnd === 0) bgSettings.rangeEnd = videoElement.duration;
						}}
					>
						<track kind="captions" />
					</video>

					<div
						class="video-overlay-wrapper absolute top-0 left-0 pointer-events-none overflow-hidden origin-top-left"
						style="
              width: 1920px;
              height: 1080px;
              transform: scale({previewScale});
              transform-origin: 0 0;
            "
					>
						<StudioScoreboard matchState={activeState} isCapturing={isCapturingHud} />
						<EffectsLayer customCanvas={confettiCanvas} />
						<StudioTicker
							items={activeState.ticker.items}
							visible={activeState.ticker.visible}
							scale={activeState.uiScale.ticker}
							isFrozen={isTickerFrozen}
							{isPlaying}
						/>
					</div>

					<canvas
						bind:this={confettiCanvas}
						width="1920"
						height="1080"
						class="absolute inset-0 pointer-events-none z-40 w-full h-full"
					></canvas>

					<!-- CONTROLES CON ONDA BEZIER ESTILO YOUTUBE -->
					<div
						class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-3 flex flex-col gap-0 transition-opacity duration-300 z-50
            {showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
					>
						<div class="w-full h-7 relative flex items-end pointer-events-none overflow-visible">
							{#if bgPlaylist.length > 0 && duration > 0}
								<div
									class="absolute bottom-0 h-7 flex items-end"
									style="
                    left: {(Math.max(0, bgSettings.rangeStart || 0) / duration) * 100}%;
                    width: {(Math.max(
										0,
										(bgSettings.rangeEnd || duration) - (bgSettings.rangeStart || 0)
									) /
										duration) *
										100}%;
                  "
								>
									<svg
										class="w-full h-full overflow-visible"
										preserveAspectRatio="none"
										viewBox="0 0 100 26"
									>
										<defs>
											<linearGradient id="audioWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
												<stop offset="0%" stop-color="#f59e0b" stop-opacity="0.65" />
												<stop offset="60%" stop-color="#d97706" stop-opacity="0.30" />
												<stop offset="100%" stop-color="#b45309" stop-opacity="0.05" />
											</linearGradient>
											<filter id="waveGlow" x="-5%" y="-20%" width="110%" height="140%">
												<feDropShadow
													dx="0"
													dy="-1"
													stdDeviation="1.2"
													flood-color="#fbbf24"
													flood-opacity="0.5"
												/>
											</filter>
										</defs>
										<path
											fill="url(#audioWaveGrad)"
											stroke="#fbbf24"
											stroke-width="1.2"
											stroke-linecap="round"
											filter="url(#waveGlow)"
											d={wavePathD}
										/>
									</svg>
								</div>
							{/if}
						</div>

						<div
							class="relative w-full h-3 flex items-center cursor-pointer select-none"
							on:click={(e) => {
								const rect = e.currentTarget.getBoundingClientRect();
								const pos = (e.clientX - rect.left) / rect.width;
								seek(pos * (duration || 0));
							}}
							on:keydown={(e) => {
								if (e.key === 'ArrowRight') seek(currentTime + 5);
								if (e.key === 'ArrowLeft') seek(currentTime - 5);
							}}
							tabindex="0"
							role="slider"
							aria-valuenow={currentTime}
							aria-valuemin="0"
							aria-valuemax={duration || 100}
						>
							<div class="relative w-full h-1.5 bg-neutral-700/80 rounded-full overflow-hidden">
								<div
									class="h-full bg-amber-400"
									style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
								></div>
							</div>

							{#each keyframes.filter( (k) => (duration > 0 ? k.time <= duration : true) ) as kf (kf.id)}
								<div
									class="absolute w-2 h-2 rounded-full -translate-x-1/2 pointer-events-none shadow-md z-20
                    {kf.actionType === 'adjustBalls' || kf.actionType === 'resetBalls'
										? 'bg-amber-400'
										: kf.actionType === 'adjustGames'
											? 'bg-emerald-400'
											: kf.actionType === 'switchTurn'
												? 'bg-blue-400'
												: kf.actionType === 'setTickerItems'
													? 'bg-teal-400'
													: 'bg-purple-400'}"
									style="left: {duration > 0 ? (kf.time / duration) * 100 : 0}%"
								></div>
							{/each}
						</div>

						<div class="flex items-center justify-between text-xs pt-1">
							<div class="flex items-center gap-3">
								<button on:click={togglePlay} class="text-white hover:text-amber-400 transition">
									{#if isPlaying}<Pause size={17} />{:else}<Play size={17} />{/if}
								</button>
								<div class="flex items-center gap-2 font-mono text-[11px]">
									<span class="text-white font-bold">{formatTime(currentTime)}</span>
									<span class="text-neutral-500">/</span>
									<span class="text-neutral-400">{formatTime(duration)}</span>
								</div>
							</div>

							<div class="flex items-center gap-3">
								<span class="hidden sm:inline text-[10px] text-neutral-400 font-mono"
									>Espacio: Pausa | ← / →: ±5s</span
								>
								<button
									on:click={() => {
										if (!document.fullscreenElement)
											videoContainer.requestFullscreen().catch(() => {});
										else document.exitFullscreen().catch(() => {});
									}}
									class="text-white hover:text-amber-400 transition"
								>
									{#if isFullscreen}<Minimize size={17} />{:else}<Maximize size={17} />{/if}
								</button>
							</div>
						</div>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center gap-3 p-8 text-center">
						<Upload size={38} class="text-amber-400 animate-bounce" />
						<span class="text-sm font-bold text-neutral-300"
							>Arrastra aquí el video de tu partida (.mp4, .mkv, .mov)</span
						>
						<span class="text-xs text-neutral-500">o</span>
						<button
							on:click={() => fileInput.click()}
							class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl transition"
						>
							Seleccionar video de tu equipo
						</button>
						<input
							bind:this={fileInput}
							type="file"
							accept="video/*"
							on:change={(e) => {
								const file = e.target.files?.[0];
								if (file) studioStore.setVideo(file);
							}}
							class="hidden"
						/>
					</div>
				{/if}

				<audio bind:this={bgAudioElement}></audio>
			</div>

			<!-- PANEL DE CONTROL CON 3 PESTAÑAS -->
			<div
				class="bg-[#0f121a] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-xl"
			>
				<div class="flex items-center gap-2 border-b border-white/5 pb-2">
					<button
						on:click={() => (activeTab = 'players')}
						class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'players'
							? 'bg-amber-500 text-black'
							: 'text-neutral-400 hover:text-white'}"
					>
						Jugadores y Puntos
					</button>
					<button
						on:click={() => (activeTab = 'interface')}
						class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'interface'
							? 'bg-amber-500 text-black'
							: 'text-neutral-400 hover:text-white'}"
					>
						Interfaz y Escalas
					</button>
					<button
						on:click={() => (activeTab = 'sponsors')}
						class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'sponsors'
							? 'bg-amber-500 text-black'
							: 'text-neutral-400 hover:text-white'}"
					>
						Sponsors y Cinta
					</button>
				</div>

				<!-- PESTAÑA 1: JUGADORES Y PUNTOS -->
				{#if activeTab === 'players'}
					<div class="grid grid-cols-2 gap-4">
						<!-- JUGADOR 1 -->
						<div class="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-3">
							<div class="flex items-center justify-between border-b border-white/5 pb-2 gap-1.5">
								<input
									type="text"
									bind:value={studioConfig.p1.name}
									class="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-bold text-xs text-amber-400 uppercase outline-none"
								/>

								<div class="flex items-center gap-1 shrink-0">
									<button
										on:click={() => (showCropModalP1 = true)}
										class="text-[10px] px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
									>
										Foto
									</button>
									{#if studioConfig.p1.avatar && studioConfig.p1.avatar !== DEFAULT_AVATAR}
										<button
											on:click={() => (studioConfig.p1.avatar = DEFAULT_AVATAR)}
											class="text-[10px] px-1.5 py-1 bg-neutral-900 hover:bg-rose-950/70 hover:text-rose-400 text-neutral-400 rounded border border-neutral-800 transition"
											title="Quitar foto y usar avatar por defecto"
										>
											<RotateCcw size={10} />
										</button>
									{/if}
								</div>

								<select
									value={activeState.p1.pocket}
									on:change={(e) => markPocket('p1', e.target.value)}
									class="bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold rounded px-1.5 py-1 text-amber-400 outline-none cursor-pointer shrink-0"
								>
									<option value="">Tronera: --</option>
									<option value="L">Tronera: L</option>
									<option value="R">Tronera: R</option>
								</select>
							</div>

							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
									<div class="flex items-center gap-1">
										<span
											class="text-[10px] font-mono {activeState.p1.balls < 0
												? 'text-rose-400 font-bold'
												: 'text-neutral-400'}"
										>
											Bolas: {activeState.p1.balls}
										</span>
										<button
											on:click={() => markResetBalls('p1')}
											class="p-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 transition"
											title="Poner bolas a 0"
										>
											<RotateCcw size={9} />
										</button>
									</div>
									<div class="flex gap-1">
										<button
											on:click={() => markBalls('p1', -1)}
											class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button
										>
										<button
											on:click={() => markBalls('p1', 1)}
											class="px-2 py-0.5 bg-amber-500 text-black rounded font-black text-xs"
											>+</button
										>
									</div>
								</div>

								<div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
									<span class="text-[10px] font-mono text-neutral-400"
										>Games: {activeState.p1.games}</span
									>
									<div class="flex gap-1">
										<button
											on:click={() => markGames('p1', -1)}
											class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button
										>
										<button
											on:click={() => markGames('p1', 1)}
											class="px-2 py-0.5 bg-neutral-700 rounded font-black text-xs">+</button
										>
									</div>
								</div>
							</div>

							<div
								class="grid grid-cols-4 gap-1.5 mt-2.5 p-1.5 bg-[#08090d] rounded-xl border border-white/5"
							>
								{#each EMOJI_REACTIONS as item (item.key)}
									<button
										on:click={() => markEffect(item.key, 'p1')}
										class="group/emo relative h-10 flex items-center justify-center rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400 text-xl transition active:scale-90"
									>
										<span>{item.icon}</span>
										<div
											class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 p-1 bg-[#0c0e15] border border-amber-500/60 rounded-xl shadow-xl opacity-0 group-hover/emo:opacity-100 pointer-events-none transition-all duration-150 z-50 flex items-center justify-center min-w-[46px] min-h-[46px]"
										>
											{#if item.key === 'confetti'}
												<span class="text-2xl animate-bounce">🎉</span>
											{:else}
												<img src={item.img} alt="" class="w-9 h-9 object-contain" />
											{/if}
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- JUGADOR 2 -->
						<div class="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-3">
							<div class="flex items-center justify-between border-b border-white/5 pb-2 gap-1.5">
								<input
									type="text"
									bind:value={studioConfig.p2.name}
									class="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-bold text-xs text-white uppercase outline-none"
								/>

								<div class="flex items-center gap-1 shrink-0">
									<button
										on:click={() => (showCropModalP2 = true)}
										class="text-[10px] px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300"
									>
										Foto
									</button>
									{#if studioConfig.p2.avatar && studioConfig.p2.avatar !== DEFAULT_AVATAR}
										<button
											on:click={() => (studioConfig.p2.avatar = DEFAULT_AVATAR)}
											class="text-[10px] px-1.5 py-1 bg-neutral-900 hover:bg-rose-950/70 hover:text-rose-400 text-neutral-400 rounded border border-neutral-800 transition"
											title="Quitar foto y usar avatar por defecto"
										>
											<RotateCcw size={10} />
										</button>
									{/if}
								</div>

								<select
									value={activeState.p2.pocket}
									on:change={(e) => markPocket('p2', e.target.value)}
									class="bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold rounded px-1.5 py-1 text-amber-400 outline-none cursor-pointer shrink-0"
								>
									<option value="">Tronera: --</option>
									<option value="L">Tronera: L</option>
									<option value="R">Tronera: R</option>
								</select>
							</div>

							<div class="grid grid-cols-2 gap-2">
								<div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
									<div class="flex items-center gap-1">
										<span
											class="text-[10px] font-mono {activeState.p2.balls < 0
												? 'text-rose-400 font-bold'
												: 'text-neutral-400'}"
										>
											Bolas: {activeState.p2.balls}
										</span>
										<button
											on:click={() => markResetBalls('p2')}
											class="p-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-amber-400 transition"
											title="Poner bolas a 0"
										>
											<RotateCcw size={9} />
										</button>
									</div>
									<div class="flex gap-1">
										<button
											on:click={() => markBalls('p2', -1)}
											class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button
										>
										<button
											on:click={() => markBalls('p2', 1)}
											class="px-2 py-0.5 bg-amber-500 text-black rounded font-black text-xs"
											>+</button
										>
									</div>
								</div>

								<div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
									<span class="text-[10px] font-mono text-neutral-400"
										>Games: {activeState.p2.games}</span
									>
									<div class="flex gap-1">
										<button
											on:click={() => markGames('p2', -1)}
											class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button
										>
										<button
											on:click={() => markGames('p2', 1)}
											class="px-2 py-0.5 bg-neutral-700 rounded font-black text-xs">+</button
										>
									</div>
								</div>
							</div>

							<div
								class="grid grid-cols-4 gap-1.5 mt-2.5 p-1.5 bg-[#08090d] rounded-xl border border-white/5"
							>
								{#each EMOJI_REACTIONS as item (item.key)}
									<button
										on:click={() => markEffect(item.key, 'p2')}
										class="group/emo relative h-10 flex items-center justify-center rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400 text-xl transition active:scale-90"
									>
										<span>{item.icon}</span>
										<div
											class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 p-1 bg-[#0c0e15] border border-amber-500/60 rounded-xl shadow-xl opacity-0 group-hover/emo:opacity-100 pointer-events-none transition-all duration-150 z-50 flex items-center justify-center min-w-[46px] min-h-[46px]"
										>
											{#if item.key === 'confetti'}
												<span class="text-2xl animate-bounce">🎉</span>
											{:else}
												<img src={item.img} alt="" class="w-9 h-9 object-contain" />
											{/if}
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- PESTAÑA 2: INTERFAZ Y ESCALAS -->
				{#if activeTab === 'interface'}
					<div class="flex flex-col gap-4">
						<div
							class="flex items-center gap-2.5 flex-wrap bg-black/20 p-2.5 rounded-xl border border-white/5"
						>
							<button
								on:click={markToggleTurns}
								class="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition {activeState
									.turns.enabled
									? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
									: 'bg-neutral-800 border-neutral-700 text-neutral-400'}"
							>
								{#if activeState.turns.enabled}<ToggleRight size={16} class="text-amber-400" /> Turnos:
									ON{:else}<ToggleLeft size={16} /> Turnos: OFF{/if}
							</button>

							{#if activeState.turns.enabled}
								<button
									on:click={markSwitchTurn}
									class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-1.5"
								>
									<UserCheck size={14} /> Cambiar Turno
								</button>
							{/if}

							<button
								on:click={() => {
									studioConfig.showAvatars = !studioConfig.showAvatars;
								}}
								class="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition {studioConfig.showAvatars
									? 'bg-neutral-800 border-neutral-700 text-white'
									: 'bg-neutral-900 border-neutral-800 text-neutral-500'}"
							>
								<ImageIcon
									size={14}
									class={studioConfig.showAvatars ? 'text-amber-400' : 'text-neutral-500'}
								/>
								Fotos: {studioConfig.showAvatars ? 'ON' : 'OFF'}
							</button>

							<button
								on:click={() => {
									const temp = studioConfig.p1.pocket;
									studioConfig.p1.pocket = studioConfig.p2.pocket;
									studioConfig.p2.pocket = temp;
								}}
								class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl flex items-center gap-1.5"
							>
								<ArrowLeftRight size={14} class="text-amber-400" /> Invertir (L ⇄ R)
							</button>

							<select
								bind:value={studioConfig.modality}
								class="bg-neutral-900 border border-neutral-700 text-xs font-bold rounded-xl px-2.5 py-1.5 text-white outline-none cursor-pointer"
							>
								<option value="ONE POCKET">ONE POCKET</option>
								<option value="BOLA 8">BOLA 8</option>
								<option value="BOLA 9">BOLA 9</option>
								<option value="BOLA 10">BOLA 10</option>
							</select>

							<div
								class="flex items-center bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 gap-1.5"
							>
								<Trophy size={13} class="text-amber-400 shrink-0" />
								<span class="text-[10px] font-mono text-neutral-400 uppercase">Meta:</span>
								<input
									type="text"
									bind:value={studioConfig.race}
									placeholder="RACE TO 3"
									class="bg-transparent text-xs font-mono font-bold text-amber-300 uppercase outline-none w-28"
								/>
							</div>
						</div>

						<div class="flex items-center gap-6 bg-black/30 p-3 rounded-xl border border-white/5">
							<div class="flex items-center gap-3">
								<span class="text-xs font-mono text-neutral-400 uppercase">Escala Marcador:</span>
								<input
									type="range"
									min="0.70"
									max="1.50"
									step="0.05"
									bind:value={studioConfig.uiScale.hud}
									class="w-28 accent-amber-500 h-1.5 bg-neutral-800 rounded cursor-pointer"
								/>
								<span class="text-xs font-mono font-bold text-amber-400 w-10"
									>{Math.round(studioConfig.uiScale.hud * 100)}%</span
								>
							</div>

							<div class="w-[1px] h-6 bg-white/10"></div>

							<div class="flex items-center gap-3">
								<span class="text-xs font-mono text-neutral-400 uppercase">Escala Cinta:</span>
								<input
									type="range"
									min="0.70"
									max="1.50"
									step="0.05"
									bind:value={studioConfig.uiScale.ticker}
									class="w-28 accent-amber-500 h-1.5 bg-neutral-800 rounded cursor-pointer"
								/>
								<span class="text-xs font-mono font-bold text-amber-400 w-10"
									>{Math.round(studioConfig.uiScale.ticker * 100)}%</span
								>
							</div>
						</div>
					</div>
				{/if}

				<!-- PESTAÑA 3: SPONSORS Y CINTA -->
				{#if activeTab === 'sponsors'}
					<div class="flex flex-col gap-3">
						<div
							class="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5"
						>
							<div class="flex flex-col">
								<span class="text-xs font-bold text-neutral-300">Visibilidad de la cinta:</span>
								<span class="text-[10px] text-neutral-400"
									>Marca en [{formatTime(currentTime)}]</span
								>
							</div>

							<div class="flex items-center gap-2">
								<button
									on:click={() => markTickerToggle(!activeState.ticker.visible)}
									class="px-3.5 py-1.5 rounded-xl text-xs font-black border flex items-center gap-2 transition {activeState
										.ticker.visible
										? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
										: 'bg-neutral-900 border-neutral-700 text-neutral-400'}"
								>
									{#if activeState.ticker.visible}
										<Eye size={15} class="text-emerald-400" /> Visible
									{:else}
										<EyeOff size={15} /> Oculta
									{/if}
								</button>

								<button
									on:click={applyStudioTickerChanges}
									class="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md transition active:scale-95"
								>
									<RefreshCw size={14} /> Aplicar Cambios en [{formatTime(currentTime)}]
								</button>
							</div>
						</div>

						<div class="flex flex-col gap-3 bg-[#090b10] p-3.5 rounded-xl border border-white/5">
							<div class="flex items-center gap-2">
								<select
									bind:value={newTickerType}
									class="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2.5 py-2 outline-none font-bold cursor-pointer"
								>
									<option value="sponsor">Sponsor</option>
									<option value="aviso">Aviso</option>
									<option value="advertencia">Advertencia</option>
									<option value="mensaje">Mensaje</option>
								</select>

								<input
									type="text"
									bind:value={newTickerText}
									on:keydown={(e) => e.key === 'Enter' && addDraftTickerItem()}
									placeholder="Texto del sponsor o aviso..."
									class="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white px-3 py-2 outline-none font-mono focus:border-amber-500"
								/>

								<button
									on:click={addDraftTickerItem}
									class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 border border-white/10"
								>
									<Plus size={15} class="text-amber-400" /> Añadir
								</button>
							</div>

							<div
								class="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5 text-xs"
							>
								<div class="flex items-center gap-2">
									<span class="text-neutral-400 font-bold flex items-center gap-1 text-[11px]"
										><ImagePlus size={14} class="text-amber-400" /> Logo (Opcional):</span
									>
									<div class="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
										<button
											type="button"
											on:click={() => (logoUploadTab = 'file')}
											class="text-[10px] px-2.5 py-1 rounded-md transition {logoUploadTab === 'file'
												? 'bg-amber-500 text-black font-black'
												: 'text-neutral-400 hover:text-white'}"
										>
											Archivo
										</button>
										<button
											type="button"
											on:click={() => (logoUploadTab = 'url')}
											class="text-[10px] px-2.5 py-1 rounded-md transition {logoUploadTab === 'url'
												? 'bg-amber-500 text-black font-black'
												: 'text-neutral-400 hover:text-white'}"
										>
											URL
										</button>
									</div>
								</div>

								<div class="flex items-center gap-2 flex-1 justify-end pl-3">
									{#if logoUploadTab === 'file'}
										<label
											class="cursor-pointer px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-[11px] font-bold rounded-lg transition flex items-center gap-1.5"
										>
											<Upload size={12} class="text-amber-400" />
											<span>{newTickerLogo ? 'Cambiar imagen' : 'Seleccionar logo'}</span>
											<input
												type="file"
												accept="image/*"
												on:change={handleTickerLogoFile}
												class="hidden"
											/>
										</label>
									{:else}
										<input
											type="text"
											bind:value={newTickerLogo}
											placeholder="https://ejemplo.com/logo.png"
											class="flex-1 max-w-[200px] bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none font-mono"
										/>
									{/if}

									{#if newTickerLogo}
										<div class="flex items-center gap-1.5 bg-transparent px-1 py-0.5">
											<img
												src={newTickerLogo}
												alt="preview"
												class="h-6 w-auto max-w-[60px] object-contain bg-transparent"
											/>
											<button
												on:click={() => (newTickerLogo = '')}
												class="text-neutral-400 hover:text-rose-400"
												title="Quitar logo"
											>
												<X size={12} />
											</button>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
							{#each stagedTickerItems as item (item.id)}
								<div
									class="flex items-center justify-between p-2 rounded-lg border {item.active
										? 'bg-neutral-900/80 border-white/10'
										: 'bg-neutral-950/40 border-neutral-800 opacity-50'} transition"
								>
									<div class="flex items-center gap-2 overflow-hidden">
										{#if item.logoUrl}
											<img
												src={item.logoUrl}
												alt="logo"
												class="h-6 w-auto max-w-[40px] object-contain bg-transparent shrink-0"
											/>
										{/if}
										<span
											class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded {item.type ===
											'sponsor'
												? 'bg-amber-950 text-amber-400 border border-amber-500/40'
												: item.type === 'aviso'
													? 'bg-blue-950 text-blue-400 border border-blue-500/40'
													: 'bg-neutral-800 text-neutral-400'}"
										>
											{item.type}
										</span>
										<span class="text-xs font-mono font-bold text-white truncate max-w-[150px]"
											>{item.text}</span
										>
									</div>
									<div class="flex items-center gap-1 shrink-0">
										<button
											on:click={() => toggleDraftTickerItem(item.id)}
											class="p-1 hover:text-white text-neutral-400 transition"
											title={item.active
												? 'Visible en este segundo (clic para ocultar)'
												: 'Oculto en este segundo (clic para mostrar)'}
										>
											{#if item.active}<Eye size={14} class="text-emerald-400" />{:else}<EyeOff
													size={14}
													class="text-neutral-500"
												/>{/if}
										</button>
										<button
											on:click={() => removeDraftTickerItem(item.id)}
											class="p-1 hover:text-rose-400 text-neutral-500 transition"
											title="Eliminar definitivamente del proyecto"
										>
											<Trash2 size={14} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- COLUMNA DERECHA: AUDIO, PLAYLIST Y TIMELINE -->
		<div
			class="bg-[#0c0e15] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden shadow-xl"
		>
			<div class="border-b border-white/10 pb-3 flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
						<Video size={15} class="text-amber-400" /> Audio Original del Vídeo
					</span>
					<button
						on:click={() => (videoAudioSettings.muted = !videoAudioSettings.muted)}
						class="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1
              {videoAudioSettings.muted
							? 'bg-neutral-900 border-neutral-700 text-neutral-400'
							: 'bg-emerald-950 border-emerald-500/50 text-emerald-300'}"
					>
						{#if videoAudioSettings.muted}
							<VolumeX size={13} /> Mudo
						{:else}
							<Volume2 size={13} class="text-emerald-400" /> Activo
						{/if}
					</button>
				</div>

				<div class="flex items-center gap-2">
					<span class="text-[10px] font-mono text-neutral-400">Vol:</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={videoAudioSettings.volume}
						disabled={videoAudioSettings.muted}
						class="w-full accent-amber-500 h-1 bg-neutral-800 rounded disabled:opacity-40 cursor-pointer"
					/>
					<span class="text-[10px] font-mono text-amber-400 w-8"
						>{Math.round(videoAudioSettings.volume * 100)}%</span
					>
				</div>
			</div>

			<div class="border-b border-white/10 pb-3 flex flex-col gap-2.5">
				<div class="flex items-center justify-between">
					<span class="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
						<ListMusic size={15} class="text-amber-400" /> Playlist ({bgPlaylist.length})
					</span>

					<div class="flex items-center gap-1.5">
						{#if bgPlaylist.length > 0}
							<button
								on:click={clearPlaylist}
								class="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-1.5 py-1"
								>Vaciar</button
							>
						{/if}
						<button
							on:click={() => musicFilesInput.click()}
							class="text-[10px] font-bold px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-white/10 flex items-center gap-1"
						>
							<Plus size={12} class="text-amber-400" /> Canciones
						</button>
						<button
							on:click={() => musicFolderInput.click()}
							class="text-[10px] font-bold px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-white/10 flex items-center gap-1"
						>
							<FolderOpen size={12} class="text-amber-400" /> Carpeta
						</button>
					</div>

					<input
						bind:this={musicFilesInput}
						type="file"
						multiple
						accept="audio/*"
						on:change={handleMusicUpload}
						class="hidden"
					/>
					<input
						bind:this={musicFolderInput}
						type="file"
						webkitdirectory
						directory
						multiple
						on:change={handleMusicUpload}
						class="hidden"
					/>
				</div>

				{#if bgPlaylist.length > 0}
					<div class="bg-black/40 border border-white/5 rounded-xl p-2.5 flex flex-col gap-2">
						<div class="flex items-center justify-between">
							<span class="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
								<span>Rango Activo</span>
								<button
									on:click={() => (showMusicInfoModal = true)}
									class="text-neutral-400 hover:text-amber-400 transition"
									title="Ver explicación de la música"
								>
									<Info size={13} />
								</button>
							</span>
							<span class="text-[10px] font-mono text-neutral-400"
								>Total: {formatTime(totalPlaylistSeconds)}</span
							>
						</div>

						<div class="grid grid-cols-2 gap-2 text-xs font-mono">
							<div
								class="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 gap-1.5"
							>
								<span class="text-neutral-400 text-[10px]">Inicio:</span>
								<input
									type="text"
									value={formatTime(bgSettings.rangeStart || 0)}
									on:change={(e) => {
										bgSettings.rangeStart = Math.max(0, parseTimeToSeconds(e.target.value, 0));
										handleRangeChange();
									}}
									class="w-full bg-transparent text-amber-400 font-bold outline-none text-center"
								/>
							</div>

							<div
								class="flex items-center bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 gap-1.5"
							>
								<span class="text-neutral-400 text-[10px]">Fin:</span>
								<input
									type="text"
									value={formatTime(bgSettings.rangeEnd || duration || 0)}
									on:change={(e) => {
										bgSettings.rangeEnd = Math.max(
											bgSettings.rangeStart || 0,
											parseTimeToSeconds(e.target.value, duration || 0)
										);
										handleRangeChange();
									}}
									class="w-full bg-transparent text-amber-400 font-bold outline-none text-center"
								/>
							</div>
						</div>
					</div>

					<div
						class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono"
					>
						<Disc
							size={14}
							class="text-amber-400 shrink-0 {isPlaying && currentTrackInfo ? 'animate-spin' : ''}"
						/>
						{#if currentTrackInfo}
							<div class="truncate flex-1 min-w-0">
								<span class="text-amber-300 font-bold">Pista {currentTrackInfo.index + 1}:</span>
								<span class="text-white truncate">{currentTrackInfo.song.name}</span>
							</div>
							<span class="text-[10px] text-amber-400 font-bold shrink-0">
								{formatTime(currentTrackInfo.offset)} / {formatTime(currentTrackInfo.songDuration)}
							</span>
						{:else}
							<span class="text-neutral-400 italic text-[10px]"
								>Silencio (fuera del rango de música)</span
							>
						{/if}
					</div>

					<div class="flex items-center justify-between text-[11px] text-neutral-400">
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={bgSettings.loop}
								on:change={handleRangeChange}
								class="accent-amber-500"
							/>
							<span>Bucle Playlist</span>
						</label>

						<button
							type="button"
							on:click={shufflePlaylistOnce}
							class="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 transition text-[11px] font-bold"
						>
							<Shuffle size={13} class="text-amber-400" />
							<span>Mezclar Lista</span>
						</button>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-[10px] font-mono text-neutral-400">Vol:</span>
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							bind:value={bgSettings.volume}
							on:input={() => {
								if (bgAudioElement) bgAudioElement.volume = computeFadeVolume(currentTime);
							}}
							class="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
						/>
						<span class="text-[10px] font-mono text-amber-400 w-8"
							>{Math.round(bgSettings.volume * 100)}%</span
						>
					</div>

					<div
						class="flex flex-col gap-1.5 overflow-y-auto pr-1 bg-black/40 p-2 rounded-xl border border-white/5 transition-all duration-300 {isPlaylistExpanded
							? 'max-h-72'
							: 'max-h-36'}"
					>
						{#each bgPlaylist as song, idx (song.id)}
							<div
								class="flex items-center justify-between p-1.5 bg-neutral-900/80 rounded-lg text-xs font-mono border border-white/5 {currentTrackInfo
									?.song?.id === song.id
									? 'border-amber-500/70 bg-amber-950/30'
									: ''}"
							>
								<div class="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
									<button
										type="button"
										on:click|stopPropagation={() => previewSongSample(song)}
										class="p-1 rounded text-neutral-400 hover:text-amber-400 transition"
										title="Escuchar muestra rápida de 6 segundos"
									>
										{#if isSamplingTrack && samplingSongId === song.id}
											<Pause size={13} class="text-amber-400 animate-pulse" />
										{:else}
											<Play size={13} />
										{/if}
									</button>
									<span class="text-amber-400 font-bold shrink-0">{idx + 1}.</span>
									<span class="truncate text-white text-[11px]">{song.name}</span>
								</div>

								<div class="flex items-center gap-1 shrink-0">
									<button
										on:click={() => moveSong(idx, -1)}
										disabled={idx === 0}
										class="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
										><ArrowUp size={12} /></button
									>
									<button
										on:click={() => moveSong(idx, 1)}
										disabled={idx === bgPlaylist.length - 1}
										class="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
										><ArrowDown size={12} /></button
									>
									<button
										on:click={() => removeSong(song.id)}
										class="p-1 text-neutral-500 hover:text-rose-400"><Trash2 size={12} /></button
									>
								</div>
							</div>
						{/each}
					</div>

					{#if bgPlaylist.length > 3}
						<button
							on:click={() => (isPlaylistExpanded = !isPlaylistExpanded)}
							class="w-full py-1 text-[10px] font-bold text-neutral-400 hover:text-amber-400 flex items-center justify-center gap-1 bg-neutral-900/50 rounded-lg transition"
						>
							{#if isPlaylistExpanded}<ChevronUp size={13} /> Contraer lista{:else}<ChevronDown
									size={13}
								/> Expandir lista ({bgPlaylist.length}){/if}
						</button>
					{/if}
				{:else}
					<p class="text-[11px] text-neutral-500 italic text-center py-1">
						Sin música de fondo añadida.
					</p>
				{/if}
			</div>

			<div class="flex items-center justify-between bg-black/30 p-2 rounded-xl text-xs">
				<span class="text-neutral-400">Sonido en reacciones:</span>
				<button
					on:click={() => (soundToggle = !soundToggle)}
					class="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition {soundToggle
						? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
						: 'bg-neutral-800 border-neutral-700 text-neutral-400'}"
				>
					{#if soundToggle}<Volume2 size={13} /> Con Audio{:else}<VolumeX size={13} /> Mudo{/if}
				</button>
			</div>

			<div class="flex items-center justify-between border-b border-white/5 pb-1">
				<div class="flex items-center gap-2">
					<span class="text-xs font-mono font-bold text-neutral-400"
						>Marcas ({keyframes.length})</span
					>
					<div class="flex items-center gap-1">
						<button
							on:click={() => {
								if (studioStore.undo()) setTimeout(() => handleSaveProject(), 1000);
							}}
							disabled={!$studioStore.canUndo}
							class="p-1 rounded bg-neutral-900 border border-white/5 hover:bg-neutral-800 text-neutral-300 disabled:opacity-25 transition"
							title="Deshacer último cambio (máx 5 pasos)"
						>
							<Undo2 size={12} />
						</button>
						<button
							on:click={() => {
								if (studioStore.redo()) setTimeout(() => handleSaveProject(), 1000);
							}}
							disabled={!$studioStore.canRedo}
							class="p-1 rounded bg-neutral-900 border border-white/5 hover:bg-neutral-800 text-neutral-300 disabled:opacity-25 transition"
							title="Rehacer cambio revertido"
						>
							<Redo2 size={12} />
						</button>
					</div>
				</div>

				{#if keyframes.length > 0}
					<button
						on:click={() => (showClearConfirmModal = true)}
						class="text-[10px] text-rose-400 hover:text-rose-300 font-bold transition"
					>
						Borrar todas
					</button>
				{/if}
			</div>

			<div
				class="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 transition-all duration-300 {isKeyframesExpanded
					? 'max-h-[460px]'
					: 'max-h-[190px]'}"
			>
				{#if keyframes.length === 0}
					<div
						class="flex flex-col items-center justify-center p-6 text-center text-neutral-500 text-xs"
					>
						<span>No hay marcas aún.</span>
						<span>Adelanta el video y pulsa puntos para registrar jugadas.</span>
					</div>
				{/if}

				{#each keyframes.filter((k) => (duration > 0 ? k.time <= duration : true)) as kf (kf.id)}
					<div
						class="flex items-center justify-between p-2 rounded-xl bg-neutral-900/70 border border-white/5 hover:border-white/10 transition text-xs font-mono"
					>
						<button on:click={() => seek(kf.time)} class="text-amber-400 font-bold hover:underline">
							[{formatTime(kf.time)}]
						</button>

						<span class="text-neutral-300 text-[11px] truncate max-w-[140px]">
							{#if kf.actionType === 'adjustBalls'}
								{kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Bolas: {kf.payload.delta > 0
									? '+1'
									: '-1'}
							{:else if kf.actionType === 'resetBalls'}
								{kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Reset Bolas (0)
							{:else if kf.actionType === 'adjustGames'}
								{kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Game: {kf.payload.delta > 0
									? '+1'
									: '-1'}
							{:else if kf.actionType === 'setPocket'}
								{kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Tronera: {kf.payload.pocket}
							{:else if kf.actionType === 'switchTurn'}
								Turno: {kf.payload.active === 'p1' ? 'P1' : 'P2'}
							{:else if kf.actionType === 'toggleTurns'}
								Turnos: {kf.payload.enabled ? 'ON' : 'OFF'}
							{:else if kf.actionType === 'toggleTicker'}
								Cinta: {kf.payload.visible ? 'Visible' : 'Oculta'}
							{:else if kf.actionType === 'setTickerItems'}
								Cinta: {kf.payload.items.filter((i) => i.active).length} marcas activas
							{:else if kf.actionType === 'effect'}
								{kf.payload.effect} ({kf.payload.playerKey === 'p1' ? 'P1' : 'P2'})
							{/if}
						</span>

						<div class="flex items-center gap-1.5">
							{#if kf.actionType === 'effect'}
								<button
									on:click={() => studioStore.toggleKeyframeSound(kf.id)}
									class="p-1 text-neutral-400 hover:text-white"
								>
									{#if kf.soundEnabled}<Volume2 size={13} class="text-amber-400" />{:else}<VolumeX
											size={13}
										/>{/if}
								</button>
							{/if}
							<button
								on:click={() => removeKeyframeWithAutosave(kf.id)}
								class="p-1 text-neutral-500 hover:text-rose-400"
							>
								<Trash2 size={13} />
							</button>
						</div>
					</div>
				{/each}
			</div>

			{#if keyframes.length > 5}
				<button
					on:click={() => (isKeyframesExpanded = !isKeyframesExpanded)}
					class="w-full py-1 text-[10px] font-bold text-neutral-400 hover:text-amber-400 flex items-center justify-center gap-1 bg-neutral-900/50 rounded-lg transition"
				>
					{#if isKeyframesExpanded}<ChevronUp size={13} /> Contraer marcas{:else}<ChevronDown
							size={13}
						/> Expandir marcas ({keyframes.length}){/if}
				</button>
			{/if}
		</div>
	</main>

	<!-- Inputs ocultos para carga de archivos de proyecto y video -->
	<input
		bind:this={projectFileInput}
		type="file"
		accept=".billiard,.json"
		on:change={handleProjectFileLoad}
		class="hidden"
	/>
	<input
		bind:this={relinkFileInput}
		type="file"
		accept="video/*"
		on:change={handleRelinkVideo}
		class="hidden"
	/>

	<StudioModals
		{showClearConfirmModal}
		{showMusicInfoModal}
		{showMissingVideoModal}
		{suggestedVideoFolder}
		{isUploadingForRender}
		{renderProgress}
		{renderErrorData}
		on:cancelClear={() => (showClearConfirmModal = false)}
		on:confirmClear={confirmClearAllKeyframes}
		on:closeMusicInfo={() => (showMusicInfoModal = false)}
		on:closeMissingVideo={() => (showMissingVideoModal = false)}
		on:relink={() => relinkFileInput.click()}
		on:cancelRender={handleCancelRender}
		on:closeError={() => (renderErrorData = null)}
		on:closeDownload={() => studioStore.setRenderProgress({ downloadUrl: null })}
	/>

	{#if showCropModalP1}
		<ImageCropModal
			initialImage={studioConfig.p1.avatar}
			on:close={() => (showCropModalP1 = false)}
			on:save={(e) => {
				studioConfig.p1.avatar = e.detail;
				showCropModalP1 = false;
			}}
		/>
	{/if}
	{#if showCropModalP2}
		<ImageCropModal
			initialImage={studioConfig.p2.avatar}
			on:close={() => (showCropModalP2 = false)}
			on:save={(e) => {
				studioConfig.p2.avatar = e.detail;
				showCropModalP2 = false;
			}}
		/>
	{/if}
</div>

<style>
	.video-overlay-wrapper :global(header) {
		position: absolute !important;
		top: 0.75rem !important;
	}
	.video-overlay-wrapper :global(footer) {
		position: absolute !important;
		bottom: 0 !important;
	}
	.video-overlay-wrapper :global(.fixed) {
		position: absolute !important;
	}
</style>
