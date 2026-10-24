<script>
  import { onMount } from 'svelte';
  import { studioStore } from '../../stores/studioStore.js';
  import StudioScoreboard from './StudioScoreboard.svelte';
  import StudioTicker from './StudioTicker.svelte';
  import EffectsLayer from '../overlay/EffectsLayer.svelte';
  import ImageCropModal from '../control/ImageCropModal.svelte';
  import { liveEffect } from '../../stores/matchStore.js';
  import * as htmlToImage from 'html-to-image';
  import confetti from 'canvas-confetti';
  import {
    Play, Pause, Upload, Trash2, Volume2, VolumeX, Download, Clock,
    Music, Film, Sparkles, Maximize, Minimize, ToggleLeft,
    ToggleRight, UserCheck, ArrowLeftRight, Sliders, Image, Eye, EyeOff, X, Plus, Image as ImageIcon
  } from 'lucide-svelte';

  let videoContainer;
  let videoElement;
  let bgAudioElement;
  let fileInput;
  let musicInput;
  let confettiCanvas;
  let isFullscreen = false;
  let renderWs = null;

  let activeTab = 'players';

  let showCropModalP1 = false;
  let showCropModalP2 = false;

  const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

  /* ==================== ESTADO 100% AISLADO DE STUDIO ==================== */
  const STUDIO_KEY = 'billiards_studio_config_v5';
  const savedStudio = typeof localStorage !== 'undefined' ? localStorage.getItem(STUDIO_KEY) : null;
  
  let studioConfig = savedStudio ? JSON.parse(savedStudio) : {
    p1: { name: 'IVAN BELMONTE', avatar: DEFAULT_AVATAR, pocket: 'R' },
    p2: { name: 'ANDREU GARCIA', avatar: DEFAULT_AVATAR, pocket: 'L' },
    showAvatars: true,
    turns: { enabled: true, active: 'p1' },
    modality: 'ONE POCKET',
    race: 'RACE TO 3',
    uiScale: { hud: 1.0, ticker: 1.0 },
    ticker: {
      visible: true,
      items: [
        { id: 1, type: 'sponsor', text: 'HDP BILLAR', logoUrl: '', active: true },
        { id: 2, type: 'aviso', text: 'GRAN FINAL ONE POCKET', logoUrl: '', active: true }
      ]
    }
  };

  function persistStudio() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STUDIO_KEY, JSON.stringify(studioConfig));
    }
  }

  /* GRABACIÓN REAL DE CANVAS-CONFETTI EN WEBM TRANSPARENTE (80KB - 100% IDÉNTICO A OVERLAY) */
  function recordSingleConfettiWebm(isP1) {
    return new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = 720;
      c.style.position = 'fixed';
      c.style.opacity = '0';
      c.style.pointerEvents = 'none';
      document.body.appendChild(c);

      const myConfetti = confetti.create(c, { resize: false, useWorker: false });
      const stream = c.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        document.body.removeChild(c);
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      recorder.start();
      // Parámetros idénticos de EffectsLayer.svelte
      myConfetti({
        particleCount: 100,
        angle: isP1 ? 52 : 128,
        spread: 75,
        startVelocity: 55,
        gravity: 1.25,
        origin: { x: isP1 ? 0.04 : 0.96, y: 0.92 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#10b981', '#3b82f6'],
        ticks: 95,
        decay: 0.92
      });

      setTimeout(() => {
        try { recorder.stop(); } catch (e) {}
      }, 2100);
    });
  }

  async function checkAndRecordTrueConfetti() {
    try {
      const res = await fetch('/api/check-confetti-webm');
      const data = await res.json();
      if (data.ready) return;

      console.log('🎉 Grabando confeti real de canvas-confetti en WebM...');
      const blobP1 = await recordSingleConfettiWebm(true);
      await fetch('/api/upload-confetti-webm?player=p1', { method: 'POST', body: blobP1 });

      const blobP2 = await recordSingleConfettiWebm(false);
      await fetch('/api/upload-confetti-webm?player=p2', { method: 'POST', body: blobP2 });
      console.log('✅ Confeti WebM transparente listo para FFmpeg');
    } catch (e) {
      console.warn('Nota: Generación de confeti WebM:', e);
    }
  }

  onMount(() => {
    checkAndRecordTrueConfetti();
  });

  $: videoUrl = $studioStore.videoUrl;
  $: currentTime = $studioStore.currentTime;
  $: duration = $studioStore.duration;
  $: isPlaying = $studioStore.isPlaying;
  $: keyframes = $studioStore.keyframes;
  $: bgMusic = $studioStore.bgMusic;
  $: renderProgress = $studioStore.renderProgress;

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

  /* ==================== CÁLCULO LOCAL DE TIMELINE ==================== */
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
        items: JSON.parse(JSON.stringify(studioConfig.ticker.items))
      }
    };
    
    const past = keyframes.filter(k => k.time <= currentTime);

    for (const k of past) {
      if (k.actionType === 'setPocket') {
        state[k.payload.playerKey].pocket = k.payload.pocket;
        const other = k.payload.playerKey === 'p1' ? 'p2' : 'p1';
        state[other].pocket = k.payload.pocket === 'L' ? 'R' : 'L';
      } else if (k.actionType === 'adjustBalls') {
        let cur = state[k.payload.playerKey].balls;
        if (k.payload.delta > 0) cur = cur >= 8 ? 0 : cur + 1;
        else cur = cur <= -25 ? 8 : cur - 1;
        state[k.payload.playerKey].balls = cur;
      } else if (k.actionType === 'adjustGames') {
        state[k.payload.playerKey].games = Math.max(0, state[k.payload.playerKey].games + k.payload.delta);
      } else if (k.actionType === 'switchTurn') {
        state.turns.active = k.payload.active;
      } else if (k.actionType === 'toggleTurns') {
        state.turns.enabled = k.payload.enabled;
      } else if (k.actionType === 'toggleTicker') {
        state.ticker.visible = k.payload.visible;
      } else if (k.actionType === 'setTickerItems') {
        state.ticker.items = JSON.parse(JSON.stringify(k.payload.items));
      }
    }
    return state;
  })();

  /* ==================== SINCRONIZACIÓN DE SONIDO ==================== */
  let lastCheckedTime = 0;
  $: {
    if (isPlaying && Math.abs(currentTime - lastCheckedTime) > 0.08) {
      const crossed = keyframes.filter(k => k.time > lastCheckedTime && k.time <= currentTime);
      crossed.forEach(ev => {
        if (ev.actionType === 'adjustBalls') {
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

  /* ==================== MÚSICA EN PREVIEW ==================== */
  $: if (bgAudioElement && bgMusic.url) {
    bgAudioElement.volume = bgMusic.volume;
    bgAudioElement.loop = bgMusic.loop;
    if (isPlaying && bgAudioElement.paused) bgAudioElement.play().catch(() => {});
    else if (!isPlaying && !bgAudioElement.paused) bgAudioElement.pause();
  }

  function handleVideoUpload(e) {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (file) studioStore.setVideo(file);
  }

  function handleMusicUpload(e) {
    const file = e.target.files?.[0];
    if (file) studioStore.setBgMusicFile(file);
  }

  function togglePlay() {
    if (!videoElement) return;
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
    videoElement.currentTime = Math.max(0, Math.min(duration, t));
    studioStore.setTime(videoElement.currentTime);
  }

  function toggleFullscreen() {
    if (!videoContainer) return;
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().catch(() => {});
      isFullscreen = true;
    } else {
      document.exitFullscreen().catch(() => {});
      isFullscreen = false;
    }
  }

  function formatTime(s) {
    if (!s || isNaN(s)) return '00:00:00';
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /* ==================== EVENTOS TIMELINE EN STUDIO ==================== */
  let soundToggle = true;

  function markBalls(playerKey, delta) {
    playClickAudio(delta > 0 ? 'point-plus' : 'point-minus');
    studioStore.addKeyframe(currentTime, 'adjustBalls', { playerKey, delta }, false);
  }

  function markGames(playerKey, delta) {
    if (delta > 0) playClickAudio('game-plus');
    studioStore.addKeyframe(currentTime, 'adjustGames', { playerKey, delta }, false);
  }

  function markPocket(playerKey, pocket) {
    studioStore.addKeyframe(currentTime, 'setPocket', { playerKey, pocket }, false);
  }

  function markSwitchTurn() {
    const nextTurn = activeState.turns.active === 'p1' ? 'p2' : 'p1';
    studioStore.addKeyframe(currentTime, 'switchTurn', { active: nextTurn }, false);
  }

  function markToggleTurns() {
    const nextEnabled = !activeState.turns.enabled;
    studioStore.addKeyframe(currentTime, 'toggleTurns', { enabled: nextEnabled }, false);
  }

  function markEffect(effect, playerKey) {
    studioStore.addKeyframe(currentTime, 'effect', { effect, playerKey }, soundToggle);
    liveEffect.set({ effect, playerKey, soundEnabled: soundToggle, id: Date.now() });
  }

  function markTickerToggle(visible) {
    studioStore.addKeyframe(currentTime, 'toggleTicker', { visible }, false);
  }

  /* GESTOR DE TICKER CON KEYFRAMES EN LÍNEA DE TIEMPO */
  let newTickerText = '';
  let newTickerType = 'sponsor';
  let newTickerLogo = '';
  let logoMode = 'file';

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

  function addStudioTickerItem() {
    if (newTickerText.trim()) {
      const updated = [
        ...activeState.ticker.items,
        {
          id: Date.now(),
          type: newTickerType,
          text: newTickerText.trim().toUpperCase(),
          logoUrl: newTickerLogo.trim(),
          active: true
        }
      ];
      newTickerText = '';
      newTickerLogo = '';
      studioStore.addKeyframe(currentTime, 'setTickerItems', { items: updated }, false);
    }
  }

  function toggleStudioTickerItem(id) {
    const updated = activeState.ticker.items.map(i => i.id === id ? { ...i, active: !i.active } : i);
    studioStore.addKeyframe(currentTime, 'setTickerItems', { items: updated }, false);
  }

  function removeStudioTickerItem(id) {
    const updated = activeState.ticker.items.filter(i => i.id !== id);
    studioStore.addKeyframe(currentTime, 'setTickerItems', { items: updated }, false);
  }

  function handleCancelRender() {
    const ok = confirm('¿Estás seguro de que deseas cancelar el renderizado? Se detendrá el proceso y podrás seguir editando el video.');
    if (!ok) return;

    if (renderWs && renderWs.readyState === WebSocket.OPEN) {
      renderWs.send(JSON.stringify({ type: 'CANCEL_RENDER' }));
      renderWs.close();
    }
    renderWs = null;
    isUploadingForRender = false;
    studioStore.setRenderProgress({ active: false, percent: 0, fps: 0, eta: '', downloadUrl: null });
  }

  /* ==================== CAPTURA RETINA 2X Y RENDERIZADO ==================== */
  let isUploadingForRender = false;

  async function triggerRender() {
    if (!$studioStore.videoFile) return;

    isUploadingForRender = true;

    try {
      const hudCard = videoContainer.querySelector('.studio-scoreboard-card') || videoContainer.querySelector('header');
      const tickSegment = videoContainer.querySelector('.studio-marquee-segment');
      const hudSnapshots = [];
      const tickerSnapshots = [];

      if (document.fonts) {
        await document.fonts.ready;
      }

      // 1. CAPTURAR MARCADOR EN RESOLUCIÓN RETINA 2X
      const scoreEvents = keyframes.filter(k => 
        k.actionType === 'adjustBalls' || k.actionType === 'adjustGames' || k.actionType === 'setPocket' || k.actionType === 'switchTurn'
      );
      const sortedScoreTimes = [0, ...scoreEvents.map(k => k.time), duration].sort((a,b)=>a-b);
      const uniqueScoreTimes = [...new Set(sortedScoreTimes)];
      
      for (let i = 0; i < uniqueScoreTimes.length - 1; i++) {
        const tStart = uniqueScoreTimes[i];
        const tEnd = uniqueScoreTimes[i+1];
        seek(tStart + 0.02);
        await new Promise(r => setTimeout(r, 60));

        const dataUrl = await htmlToImage.toPng(hudCard, {
          pixelRatio: 2,
          skipFonts: true
        });

        hudSnapshots.push({
          start: tStart,
          end: tEnd,
          dataUrl
        });
      }

      // 2. CAPTURAR INTERVALOS DE CINTA INFERIOR
      const tickerEvents = keyframes.filter(k => k.actionType === 'setTickerItems' || k.actionType === 'toggleTicker');
      const sortedTickerTimes = [0, ...tickerEvents.map(k => k.time), duration].sort((a,b)=>a-b);
      const uniqueTickerTimes = [...new Set(sortedTickerTimes)];

      for (let i = 0; i < uniqueTickerTimes.length - 1; i++) {
        const tStart = uniqueTickerTimes[i];
        const tEnd = uniqueTickerTimes[i+1];
        seek(tStart + 0.02);
        await new Promise(r => setTimeout(r, 60));

        if (activeState.ticker.visible && activeState.ticker.items.some(it => it.active) && tickSegment) {
          try {
            const dataUrl = await htmlToImage.toPng(tickSegment, {
              pixelRatio: 1,
              skipFonts: true
            });
            tickerSnapshots.push({
              start: tStart,
              end: tEnd,
              visible: true,
              dataUrl,
              segmentWidth: tickSegment.scrollWidth || tickSegment.offsetWidth || 1200
            });
          } catch (e) {}
        }
      }

      if (hudSnapshots.length === 0) {
        isUploadingForRender = false;
        alert('Error: No se pudo generar la captura del marcador.');
        return;
      }

      const resVideo = await fetch('/api/upload-media', {
        method: 'POST',
        headers: { 'x-file-name': encodeURIComponent($studioStore.videoFile.name) },
        body: $studioStore.videoFile
      });
      const videoData = await resVideo.json();

      let bgMusicFileName = null;
      if ($studioStore.bgMusic.file) {
        const resMusic = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'x-file-name': encodeURIComponent($studioStore.bgMusic.file.name) },
          body: $studioStore.bgMusic.file
        });
        const musicData = await resMusic.json();
        bgMusicFileName = musicData.filename;
      }

      isUploadingForRender = false;

      const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'; ws = new WebSocket(`ws://${host}:3001`);
      renderWs = ws;

      ws.onopen = () => {
        studioStore.setRenderProgress({ active: true, percent: 0, fps: 0, eta: '' });
        ws.send(JSON.stringify({
          type: 'START_RENDER',
          payload: {
            videoFileName: videoData.filename,
            bgMusicFileName,
            events: keyframes,
            duration,
            bgSettings: bgMusic,
            hudSnapshots,
            tickerSnapshots
          }
        }));
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'RENDER_PROGRESS') {
          studioStore.setRenderProgress(msg.payload);
        } else if (msg.type === 'RENDER_ERROR') {
          studioStore.setRenderProgress({ active: false, percent: 0, fps: 0 });
          alert(msg.payload || 'Error en el renderizado con FFmpeg.');
        }
      };
    } catch (err) {
      isUploadingForRender = false;
      alert('Error en el proceso de renderizado: ' + err.message);
    }
  }
</script>

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

<div class="min-h-screen bg-[#07080b] text-white font-sans flex flex-col overflow-x-hidden select-none">
  
  <header class="h-14 border-b border-white/10 px-6 flex items-center justify-between shrink-0 bg-[#0c0e15]">
    <div class="flex items-center gap-3">
      <Film size={20} class="text-amber-400" />
      <div>
        <h1 class="text-sm font-black tracking-wider uppercase font-mono text-white">Estudio de Post-Producción</h1>
        <p class="text-[10px] text-neutral-400 font-mono">Editor VOD Autónomo (Independiente)</p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <a href="?view=control" class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg border border-white/10 transition">
        Modo Directo
      </a>

      {#if videoUrl}
        <button
          on:click={triggerRender}
          class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-2 shadow-lg transition active:scale-95"
        >
          <Download size={16} /> Renderizar y Descargar Video
        </button>
      {/if}
    </div>
  </header>

  <main class="flex-1 grid grid-cols-[1fr_360px] gap-4 p-4 overflow-hidden">
    
    <div class="flex flex-col gap-3 min-w-0">
      
      <!-- REPRODUCTOR COMPACTO Y GENEROSO -->
      <div 
        bind:this={videoContainer}
        class="relative aspect-[16/9] w-full max-h-[54vh] bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center shadow-2xl group [transform:translateZ(0)]"
        on:dragover|preventDefault
        on:drop|preventDefault={handleVideoUpload}
      >
        {#if videoUrl}
          <video
            bind:this={videoElement}
            src={videoUrl}
            class="w-full h-full object-contain"
            on:timeupdate={() => studioStore.setTime(videoElement.currentTime)}
            on:loadedmetadata={() => studioStore.setDuration(videoElement.duration)}
          ></video>

          <div class="video-overlay-wrapper absolute inset-0 pointer-events-none overflow-hidden">
            <StudioScoreboard matchState={activeState} />
            <EffectsLayer customCanvas={confettiCanvas} />
            <StudioTicker 
              items={activeState.ticker.items} 
              visible={activeState.ticker.visible} 
              scale={activeState.uiScale.ticker} 
            />
          </div>

          <canvas bind:this={confettiCanvas} class="absolute inset-0 pointer-events-none z-40 w-full h-full"></canvas>

          <!-- CONTROLES INTEGRADOS EN VIDEO -->
          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
            
            <div 
              class="relative w-full h-3 flex items-center cursor-pointer select-none"
              on:click={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seek(pos * duration);
              }}
            >
              <div class="relative w-full h-1.5 bg-neutral-700/80 rounded-full overflow-hidden">
                <div class="h-full bg-amber-400" style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"></div>
              </div>

              {#each keyframes as kf (kf.id)}
                <div
                  class="absolute w-2 h-2 rounded-full -translate-x-1/2 pointer-events-none shadow-md
                    {kf.actionType === 'adjustBalls' ? 'bg-amber-400' : kf.actionType === 'adjustGames' ? 'bg-emerald-400' : kf.actionType === 'switchTurn' ? 'bg-blue-400' : kf.actionType === 'setTickerItems' ? 'bg-teal-400' : 'bg-purple-400'}"
                  style="left: {duration > 0 ? (kf.time / duration) * 100 : 0}%"
                ></div>
              {/each}
            </div>

            <div class="flex items-center justify-between text-xs">
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

              <button on:click={toggleFullscreen} class="text-white hover:text-amber-400 transition">
                {#if isFullscreen}<Minimize size={17} />{:else}<Maximize size={17} />{/if}
              </button>
            </div>

          </div>
        {:else}
          <div class="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Upload size={38} class="text-amber-400 animate-bounce" />
            <span class="text-sm font-bold text-neutral-300">Arrastrá aquí tu video grabado (.mp4, .mkv, .mov)</span>
            <span class="text-xs text-neutral-500">o</span>
            <button
              on:click={() => fileInput.click()}
              class="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl transition"
            >
              Seleccionar archivo de tu equipo
            </button>
            <input bind:this={fileInput} type="file" accept="video/*" on:change={handleVideoUpload} class="hidden" />
          </div>
        {/if}

        {#if bgMusic.url}
          <audio bind:this={bgAudioElement} src={bgMusic.url}></audio>
        {/if}
      </div>

      <!-- PANEL DE CONTROL EN PESTAÑAS -->
      <div class="bg-[#0f121a] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-xl">
        
        <div class="flex items-center gap-2 border-b border-white/5 pb-2">
          <button
            on:click={() => activeTab = 'players'}
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'players' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}"
          >
            Jugadores y Puntos
          </button>
          <button
            on:click={() => activeTab = 'interface'}
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'interface' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}"
          >
            Ajustes de Interfaz
          </button>
          <button
            on:click={() => activeTab = 'scale'}
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'scale' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}"
          >
            Escalas
          </button>
          <button
            on:click={() => activeTab = 'sponsors'}
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition {activeTab === 'sponsors' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}"
          >
            Sponsors y Cinta
          </button>
        </div>

        {#if activeTab === 'players'}
          <div class="grid grid-cols-2 gap-4">
            
            <!-- JUGADOR 1 -->
            <div class="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-3">
              <div class="flex items-center justify-between border-b border-white/5 pb-2">
                <input
                  type="text"
                  bind:value={studioConfig.p1.name}
                  on:input={persistStudio}
                  class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-bold text-xs text-amber-400 uppercase outline-none"
                />
                <button on:click={() => showCropModalP1 = true} class="text-[10px] px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300">
                  Foto
                </button>
                <select
                  value={activeState.p1.pocket}
                  on:change={(e) => markPocket('p1', e.target.value)}
                  class="bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold rounded px-1.5 py-1 text-amber-400 outline-none cursor-pointer"
                >
                  <option value="">Tronera: --</option>
                  <option value="L">Tronera: L</option>
                  <option value="R">Tronera: R</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span class="text-[10px] font-mono text-neutral-400">Bolas: {activeState.p1.balls}</span>
                  <div class="flex gap-1">
                    <button on:click={() => markBalls('p1', -1)} class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button>
                    <button on:click={() => markBalls('p1', 1)} class="px-2 py-0.5 bg-amber-500 text-black rounded font-black text-xs">+</button>
                  </div>
                </div>
                <div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span class="text-[10px] font-mono text-neutral-400">Games: {activeState.p1.games}</span>
                  <div class="flex gap-1">
                    <button on:click={() => markGames('p1', -1)} class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button>
                    <button on:click={() => markGames('p1', 1)} class="px-2 py-0.5 bg-neutral-700 rounded font-black text-xs">+</button>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                <button on:click={() => markEffect('confetti', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🎉</button>
                <button on:click={() => markEffect('fire', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🔥</button>
                <button on:click={() => markEffect('wink', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">😉</button>
                <button on:click={() => markEffect('sunglasses', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">😎</button>
                <button on:click={() => markEffect('clap', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">👏</button>
                <button on:click={() => markEffect('target', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🎯</button>
                <button on:click={() => markEffect('crown', 'p1')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">👑</button>
              </div>
            </div>

            <!-- JUGADOR 2 -->
            <div class="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-3">
              <div class="flex items-center justify-between border-b border-white/5 pb-2">
                <input
                  type="text"
                  bind:value={studioConfig.p2.name}
                  on:input={persistStudio}
                  class="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-bold text-xs text-white uppercase outline-none"
                />
                <button on:click={() => showCropModalP2 = true} class="text-[10px] px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300">
                  Foto
                </button>
                <select
                  value={activeState.p2.pocket}
                  on:change={(e) => markPocket('p2', e.target.value)}
                  class="bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold rounded px-1.5 py-1 text-amber-400 outline-none cursor-pointer"
                >
                  <option value="">Tronera: --</option>
                  <option value="L">Tronera: L</option>
                  <option value="R">Tronera: R</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span class="text-[10px] font-mono text-neutral-400">Bolas: {activeState.p2.balls}</span>
                  <div class="flex gap-1">
                    <button on:click={() => markBalls('p2', -1)} class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button>
                    <button on:click={() => markBalls('p2', 1)} class="px-2 py-0.5 bg-amber-500 text-black rounded font-black text-xs">+</button>
                  </div>
                </div>
                <div class="flex items-center justify-between bg-black/40 p-2 rounded-lg">
                  <span class="text-[10px] font-mono text-neutral-400">Games: {activeState.p2.games}</span>
                  <div class="flex gap-1">
                    <button on:click={() => markGames('p2', -1)} class="px-2 py-0.5 bg-neutral-800 rounded font-bold text-xs">-</button>
                    <button on:click={() => markGames('p2', 1)} class="px-2 py-0.5 bg-neutral-700 rounded font-black text-xs">+</button>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                <button on:click={() => markEffect('confetti', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🎉</button>
                <button on:click={() => markEffect('fire', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🔥</button>
                <button on:click={() => markEffect('wink', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">😉</button>
                <button on:click={() => markEffect('sunglasses', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">😎</button>
                <button on:click={() => markEffect('clap', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">👏</button>
                <button on:click={() => markEffect('target', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">🎯</button>
                <button on:click={() => markEffect('crown', 'p2')} class="p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-base">👑</button>
              </div>
            </div>

          </div>
        {/if}

        {#if activeTab === 'interface'}
          <div class="flex items-center gap-3 flex-wrap">
            <button
              on:click={markToggleTurns}
              class="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition {activeState.turns.enabled ? 'bg-amber-950/70 border-amber-500/60 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}"
            >
              {#if activeState.turns.enabled}<ToggleRight size={16} class="text-amber-400" /> Turnos: ON{:else}<ToggleLeft size={16} /> Turnos: OFF{/if}
            </button>

            {#if activeState.turns.enabled}
              <button on:click={markSwitchTurn} class="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-1.5">
                <UserCheck size={14} /> Cambiar Turno Aquí
              </button>
            {/if}

            <button
              on:click={() => { studioConfig.showAvatars = !studioConfig.showAvatars; persistStudio(); }}
              class="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition {studioConfig.showAvatars ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}"
            >
              <Image size={14} class={studioConfig.showAvatars ? 'text-amber-400' : 'text-neutral-500'} />
              Fotos: {studioConfig.showAvatars ? 'ON' : 'OFF'}
            </button>

            <button 
              on:click={() => { 
                const temp = studioConfig.p1.pocket; 
                studioConfig.p1.pocket = studioConfig.p2.pocket; 
                studioConfig.p2.pocket = temp; 
                persistStudio(); 
              }} 
              class="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <ArrowLeftRight size={14} class="text-amber-400" /> Invertir (L ⇄ R)
            </button>

            <select
              bind:value={studioConfig.modality}
              on:change={persistStudio}
              class="bg-neutral-900 border border-neutral-700 text-xs font-bold rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
            >
              <option value="ONE POCKET">ONE POCKET</option>
              <option value="BOLA 8">BOLA 8 (Próximamente)</option>
              <option value="BOLA 9">BOLA 9 (Próximamente)</option>
            </select>
          </div>
        {/if}

        {#if activeTab === 'scale'}
          <div class="flex items-center gap-6 bg-black/30 p-3 rounded-xl border border-white/5">
            <div class="flex items-center gap-3">
              <span class="text-xs font-mono text-neutral-400 uppercase">Escala Marcador:</span>
              <input
                type="range" min="0.70" max="1.50" step="0.05"
                bind:value={studioConfig.uiScale.hud}
                on:input={persistStudio}
                class="w-28 accent-amber-500 h-1.5 bg-neutral-800 rounded cursor-pointer"
              />
              <span class="text-xs font-mono font-bold text-amber-400 w-10">{Math.round(studioConfig.uiScale.hud * 100)}%</span>
            </div>

            <div class="w-[1px] h-6 bg-white/10"></div>

            <div class="flex items-center gap-3">
              <span class="text-xs font-mono text-neutral-400 uppercase">Escala Cinta:</span>
              <input
                type="range" min="0.70" max="1.50" step="0.05"
                bind:value={studioConfig.uiScale.ticker}
                on:input={persistStudio}
                class="w-28 accent-amber-500 h-1.5 bg-neutral-800 rounded cursor-pointer"
              />
              <span class="text-xs font-mono font-bold text-amber-400 w-10">{Math.round(studioConfig.uiScale.ticker * 100)}%</span>
            </div>
          </div>
        {/if}

        <!-- PESTAÑA SPONSORS COMPLETA -->
        {#if activeTab === 'sponsors'}
          <div class="flex flex-col gap-3">
            
            <div class="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/5">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-neutral-300">Visibilidad de la cinta en este segundo:</span>
                <span class="text-[10px] text-neutral-400">Marca en [{formatTime(currentTime)}]</span>
              </div>
              <button
                on:click={() => markTickerToggle(!activeState.ticker.visible)}
                class="px-4 py-2 rounded-xl text-xs font-black border flex items-center gap-2 transition {activeState.ticker.visible ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300' : 'bg-neutral-900 border-neutral-700 text-neutral-400'}"
              >
                {#if activeState.ticker.visible}
                  <Eye size={16} class="text-emerald-400" /> Cinta Visible
                {:else}
                  <EyeOff size={16} /> Cinta Oculta
                {/if}
              </button>
            </div>

            <div class="flex flex-col gap-2.5 bg-[#090b10] p-3 rounded-xl border border-white/5">
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
                  on:keydown={(e) => e.key === 'Enter' && addStudioTickerItem()}
                  placeholder="Texto a mostrar desde este segundo..."
                  class="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white px-3 py-2 outline-none font-mono focus:border-amber-500"
                />

                <button on:click={addStudioTickerItem} class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition flex items-center gap-1">
                  <Plus size={15} /> Añadir Aquí
                </button>
              </div>

              <div class="flex items-center gap-3 text-xs pt-1 border-t border-white/5">
                <span class="text-neutral-400 flex items-center gap-1 text-[11px]"><ImageIcon size={13} /> Logo (opcional):</span>
                
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    on:click={() => logoMode = 'file'}
                    class="text-[10px] px-2 py-0.5 rounded {logoMode === 'file' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}"
                  >
                    Archivo
                  </button>
                  <button
                    type="button"
                    on:click={() => logoMode = 'url'}
                    class="text-[10px] px-2 py-0.5 rounded {logoMode === 'url' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400'}"
                  >
                    URL
                  </button>
                </div>

                {#if logoMode === 'file'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    on:change={handleTickerLogoFile} 
                    class="text-[11px] text-neutral-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:bg-neutral-800 file:text-white cursor-pointer"
                  />
                {:else}
                  <input
                    type="text"
                    bind:value={newTickerLogo}
                    placeholder="https://ejemplo.com/logo.png"
                    class="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-xs text-white outline-none font-mono"
                  />
                {/if}

                {#if newTickerLogo}
                  <div class="flex items-center gap-1.5 bg-neutral-800 px-2 py-0.5 rounded">
                    <img src={newTickerLogo} alt="preview" class="h-4 w-6 object-contain" />
                    <span class="text-[10px] text-emerald-400 font-bold">Cargado</span>
                  </div>
                {/if}
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-neutral-400 px-1 pt-1">
              <span>Marcas en este segundo ({formatTime(currentTime)}):</span>
              <span class="text-amber-400 font-mono">Modificar aquí crea un punto en el tiempo</span>
            </div>

            <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {#each activeState.ticker.items as item (item.id)}
                <div class="flex items-center justify-between p-2 rounded-lg border {item.active ? 'bg-neutral-900/80 border-white/10' : 'bg-neutral-950/40 border-neutral-800 opacity-50'} transition">
                  <div class="flex items-center gap-2 overflow-hidden">
                    {#if item.logoUrl}
                      <img src={item.logoUrl} alt="logo" class="h-5 w-7 object-contain bg-black/50 rounded p-0.5" />
                    {/if}
                    <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded {item.type === 'sponsor' ? 'bg-amber-950 text-amber-400 border border-amber-500/40' : item.type === 'aviso' ? 'bg-blue-950 text-blue-400 border border-blue-500/40' : item.type === 'advertencia' ? 'bg-orange-950 text-orange-400 border border-orange-500/40' : 'bg-neutral-800 text-neutral-400'}">
                      {item.type}
                    </span>
                    <span class="text-xs font-mono font-bold text-white truncate max-w-[150px]">{item.text}</span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button on:click={() => toggleStudioTickerItem(item.id)} class="p-1 hover:text-white text-neutral-400 transition" title={item.active ? 'Desactivar en este segundo' : 'Activar en este segundo'}>
                      {#if item.active}<Eye size={14} />{:else}<EyeOff size={14} />{/if}
                    </button>
                    <button on:click={() => removeStudioTickerItem(item.id)} class="p-1 hover:text-rose-400 text-neutral-500 transition" title="Eliminar desde este segundo">
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

    <!-- COLUMNA DERECHA: TIMELINE + MÚSICA -->
    <div class="bg-[#0c0e15] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 overflow-hidden shadow-xl">
      
      <!-- MÚSICA DE FONDO -->
      <div class="border-b border-white/10 pb-3 flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-neutral-300 flex items-center gap-1.5">
            <Music size={14} class="text-amber-400" /> Música de Fondo
          </span>
          <button
            on:click={() => musicInput.click()}
            class="text-[10px] font-bold px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-white/5"
          >
            {bgMusic.file ? 'Cambiar' : 'Subir MP3'}
          </button>
          <input bind:this={musicInput} type="file" accept="audio/*" on:change={handleMusicUpload} class="hidden" />
        </div>

        {#if bgMusic.file}
          <div class="flex items-center justify-between text-[11px] text-neutral-400">
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={bgMusic.loop} on:change={(e) => studioStore.updateBgMusicSettings({ loop: e.target.checked })} class="accent-amber-500" />
              <span>Bucle</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={bgMusic.fadeIn} on:change={(e) => studioStore.updateBgMusicSettings({ fadeIn: e.target.checked })} class="accent-amber-500" />
              <span>Fade In</span>
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={bgMusic.fadeOut} on:change={(e) => studioStore.updateBgMusicSettings({ fadeOut: e.target.checked })} class="accent-amber-500" />
              <span>Fade Out</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-neutral-400">Vol:</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={bgMusic.volume}
              on:input={(e) => studioStore.updateBgMusicSettings({ volume: parseFloat(e.target.value) })}
              class="w-full accent-amber-500 h-1 bg-neutral-800 rounded"
            />
            <span class="text-[10px] font-mono text-amber-400 w-7">{Math.round(bgMusic.volume * 100)}%</span>
          </div>
        {/if}
      </div>

      <!-- SONIDO EN REACCIONES -->
      <div class="flex items-center justify-between bg-black/30 p-2 rounded-xl text-xs">
        <span class="text-neutral-400">Sonido en reacciones:</span>
        <button
          on:click={() => soundToggle = !soundToggle}
          class="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition {soundToggle ? 'bg-amber-950/70 border-amber-500/50 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}"
        >
          {#if soundToggle}<Volume2 size={13} /> Con Audio{:else}<VolumeX size={13} /> Mudo{/if}
        </button>
      </div>

      <!-- LISTA DE EVENTOS -->
      <div class="flex items-center justify-between border-b border-white/5 pb-1">
        <span class="text-xs font-mono font-bold text-neutral-400">Marcas ({keyframes.length})</span>
        {#if keyframes.length > 0}
          <button on:click={() => studioStore.clearKeyframes()} class="text-[10px] text-rose-400 hover:text-rose-300">Borrar todas</button>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 max-h-[360px]">
        {#if keyframes.length === 0}
          <div class="flex flex-col items-center justify-center p-6 text-center text-neutral-500 text-xs">
            <span>No hay marcas aún.</span>
            <span>Adelantá el video y tocá botones para marcar puntos.</span>
          </div>
        {/if}

        {#each keyframes as kf (kf.id)}
          <div class="flex items-center justify-between p-2 rounded-xl bg-neutral-900/70 border border-white/5 hover:border-white/10 transition text-xs font-mono">
            <button on:click={() => seek(kf.time)} class="text-amber-400 font-bold hover:underline">
              [{formatTime(kf.time)}]
            </button>

            <span class="text-neutral-300 text-[11px] truncate max-w-[140px]">
              {#if kf.actionType === 'adjustBalls'}
                {kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Bolas: {kf.payload.delta > 0 ? '+1' : '-1'}
              {:else if kf.actionType === 'adjustGames'}
                {kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Game: {kf.payload.delta > 0 ? '+1' : '-1'}
              {:else if kf.actionType === 'setPocket'}
                {kf.payload.playerKey === 'p1' ? 'P1' : 'P2'} Tronera: {kf.payload.pocket}
              {:else if kf.actionType === 'switchTurn'}
                Turno: {kf.payload.active === 'p1' ? 'P1' : 'P2'}
              {:else if kf.actionType === 'toggleTurns'}
                Turnos: {kf.payload.enabled ? 'ON' : 'OFF'}
              {:else if kf.actionType === 'toggleTicker'}
                Cinta: {kf.payload.visible ? 'Visible' : 'Oculta'}
              {:else if kf.actionType === 'setTickerItems'}
                Cinta: {kf.payload.items.filter(i => i.active).length} marcas activas
              {:else if kf.actionType === 'effect'}
                {kf.payload.effect} ({kf.payload.playerKey === 'p1' ? 'P1' : 'P2'})
              {/if}
            </span>

            <div class="flex items-center gap-1.5">
              {#if kf.actionType === 'effect'}
                <button
                  on:click={() => studioStore.toggleKeyframeSound(kf.id)}
                  class="p-1 text-neutral-400 hover:text-white"
                  title={kf.soundEnabled ? 'Con audio' : 'Mudo'}
                >
                  {#if kf.soundEnabled}<Volume2 size={13} class="text-amber-400" />{:else}<VolumeX size={13} />{/if}
                </button>
              {/if}
              <button on:click={() => studioStore.removeKeyframe(kf.id)} class="p-1 text-neutral-500 hover:text-rose-400">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        {/each}
      </div>

    </div>

  </main>

  <!-- MODAL DE PROGRESO DE RENDERIZADO -->
  {#if renderProgress.active || isUploadingForRender}
    <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="bg-[#10131c] border border-white/20 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-4">
        
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div class="flex items-center gap-3">
            <Film size={22} class="text-amber-400 animate-pulse" />
            <h3 class="text-sm font-bold tracking-wide uppercase font-mono">
              {isUploadingForRender ? 'Preparando video...' : 'Procesando con FFmpeg (Alta Definición)'}
            </h3>
          </div>
          <button
            on:click={handleCancelRender}
            class="px-3.5 py-1.5 bg-neutral-800 hover:bg-rose-600/90 border border-neutral-700 hover:border-rose-500 text-xs font-bold rounded-lg transition flex items-center gap-1.5 text-neutral-300 hover:text-white"
          >
            <X size={14} /> Cancelar
          </button>
        </div>

        {#if !isUploadingForRender}
          <div class="flex flex-col gap-1.5">
            <div class="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div class="h-full bg-amber-400 transition-all duration-300" style="width: {renderProgress.percent}%"></div>
            </div>
            <div class="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span>{renderProgress.percent}% completado</span>
              <span>{renderProgress.fps} FPS</span>
            </div>
          </div>
        {/if}

        <p class="text-[11px] text-neutral-400">
          Al finalizar podrás descargarlo con el botón de descarga.
        </p>

      </div>
    </div>
  {/if}

  <!-- MODAL DE DESCARGA COMPLETADA -->
  {#if renderProgress.downloadUrl}
    <div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div class="relative bg-[#10131c] border border-amber-500/50 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-4 text-center items-center">
        
        <button
          on:click={() => studioStore.setRenderProgress({ downloadUrl: null })}
          class="absolute top-4 right-4 text-neutral-400 hover:text-white transition"
        >
          <X size={20} />
        </button>

        <Sparkles size={32} class="text-amber-400" />
        <h3 class="text-base font-bold uppercase font-mono">¡Video Terminado con Éxito!</h3>
        <p class="text-xs text-neutral-300">El archivo quedó listo en alta definición con el marcador Retina, la cinta inferior, confeti auténtico y audio combinados.</p>
        
        <div class="flex items-center gap-3 w-full justify-center pt-2">
          <a
            href={renderProgress.downloadUrl}
            download="partida_final_con_marcador.mp4"
            class="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl shadow-lg transition active:scale-95"
          >
            Descargar Archivo MP4
          </a>

          <button
            on:click={() => studioStore.setRenderProgress({ downloadUrl: null })}
            class="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-white/10 transition"
          >
            Seguir Editando
          </button>
        </div>

      </div>
    </div>
  {/if}

  {#if showCropModalP1}
    <ImageCropModal 
      initialImage={studioConfig.p1.avatar} 
      on:close={() => showCropModalP1 = false} 
      on:save={(e) => { studioConfig.p1.avatar = e.detail; persistStudio(); showCropModalP1 = false; }} 
    />
  {/if}
  {#if showCropModalP2}
    <ImageCropModal 
      initialImage={studioConfig.p2.avatar} 
      on:close={() => showCropModalP2 = false} 
      on:save={(e) => { studioConfig.p2.avatar = e.detail; persistStudio(); showCropModalP2 = false; }} 
    />
  {/if}

</div>
