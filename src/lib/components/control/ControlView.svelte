<script>
  import { onMount } from 'svelte';
  import { matchStore } from '../../stores/matchStore.js';
  import PlayerCard from './PlayerCard.svelte';
  import TickerAdmin from './TickerAdmin.svelte';
  import { ArrowLeftRight, Play, Pause, RotateCcw, Clock, ToggleLeft, ToggleRight, UserCheck, Image, Sliders, QrCode, X } from 'lucide-svelte';

  $: timer = $matchStore.timer;
  $: turns = $matchStore.turns;
  $: showAvatars = $matchStore.showAvatars;
  $: uiScale = $matchStore.uiScale || { hud: 1.0, ticker: 1.0 };

  let customSecondsInput = 30;
  let showQrModal = false;
  let serverNetworkIp = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      if (data && data.ip && data.ip !== 'localhost' && data.ip !== '127.0.0.1') {
        serverNetworkIp = data.ip;
      }
    } catch (e) {}
  });

  $: mobileHost = (serverNetworkIp && (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')))
    ? serverNetworkIp
    : (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

  $: currentMobileUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${mobileHost}:5173/?view=control`
    : '';
</script>

<div class="min-h-screen bg-[#07080b] text-white p-3 sm:p-6 font-sans flex flex-col gap-4 sm:gap-6 overflow-x-hidden">
  
  <!-- Barra Superior -->
  <header class="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/10 pb-4 gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg sm:text-xl font-black tracking-wider uppercase font-mono text-amber-400">Panel de Control</h1>
        <p class="text-[11px] sm:text-xs text-neutral-400">Control de partida en vivo para OBS Studio y Móvil</p>
      </div>

      <!-- Botón Móvil visible en cabecera en pantallas chicas -->
      <button
        on:click={() => showQrModal = true}
        class="lg:hidden px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/50 bg-amber-950/40 text-amber-300 flex items-center gap-1.5"
      >
        <QrCode size={14} class="text-amber-400" /> Móvil
      </button>
    </div>

    <!-- Acciones Rápidas (En PC exactamente igual, en móvil con flex-wrap para que no se desborde) -->
    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
      
      <!-- DESLIZADORES DE ESCALA (HUD Y CINTA) -->
      <div class="flex items-center gap-2 sm:gap-3 bg-[#0a0c12] border border-neutral-800 px-2.5 sm:px-3 py-1.5 rounded-xl">
        <Sliders size={14} class="text-amber-400 shrink-0" />
        
        <!-- Escala Marcador -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span class="text-[9px] sm:text-[10px] font-mono text-neutral-400 uppercase">HUD:</span>
          <input
            type="range"
            min="0.70"
            max="1.50"
            step="0.05"
            value={uiScale.hud}
            on:input={(e) => matchStore.setHudScale(e.target.value)}
            class="w-14 sm:w-16 accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
          />
          <span class="text-[9px] sm:text-[10px] font-mono font-bold text-amber-400 w-7 sm:w-8 text-right">{Math.round(uiScale.hud * 100)}%</span>
        </div>

        <div class="w-[1px] h-3.5 bg-neutral-800"></div>

        <!-- Escala Cinta -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span class="text-[9px] sm:text-[10px] font-mono text-neutral-400 uppercase">Cinta:</span>
          <input
            type="range"
            min="0.70"
            max="1.50"
            step="0.05"
            value={uiScale.ticker}
            on:input={(e) => matchStore.setTickerScale(e.target.value)}
            class="w-14 sm:w-16 accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
          />
          <span class="text-[9px] sm:text-[10px] font-mono font-bold text-amber-400 w-7 sm:w-8 text-right">{Math.round(uiScale.ticker * 100)}%</span>
        </div>
      </div>

      <!-- BOTÓN CONECTAR MÓVIL EN ESCRITORIO -->
      <button
        on:click={() => showQrModal = true}
        class="hidden lg:flex px-3 py-2 rounded-xl text-xs font-bold border border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 items-center gap-1.5 transition active:scale-95 shadow-sm"
        title="Ver enlace y QR para tu celular"
      >
        <QrCode size={15} class="text-amber-400" /> Móvil
      </button>

      <!-- Activar / Desactivar Fotos -->
      <button
        on:click={() => matchStore.toggleAvatars()}
        class="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition
          {showAvatars ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}"
      >
        <Image size={14} class={showAvatars ? 'text-amber-400' : 'text-neutral-500'} />
        Fotos: {showAvatars ? 'ON' : 'OFF'}
      </button>

      <!-- Control Maestro de Turnos -->
      <button
        on:click={() => matchStore.toggleTurns()}
        class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 sm:gap-2 transition
          {turns.enabled ? 'bg-amber-950/70 border-amber-500/60 text-amber-300' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}"
      >
        {#if turns.enabled}
          <ToggleRight size={17} class="text-amber-400" /> Turnos: ON
        {:else}
          <ToggleLeft size={17} /> Turnos: OFF
        {/if}
      </button>

      {#if turns.enabled}
        <button
          on:click={() => matchStore.switchTurn()}
          class="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md"
        >
          <UserCheck size={14} /> Cambiar Turno
        </button>
      {/if}

      <!-- Invertir Troneras -->
      <button
        on:click={() => matchStore.swapPockets()}
        class="px-3 sm:px-4 py-1.5 sm:py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-xs font-bold rounded-xl flex items-center gap-1.5 sm:gap-2 transition active:scale-95"
      >
        <ArrowLeftRight size={14} class="text-amber-400" /> Invertir (L ⇄ R)
      </button>

      <select
        value={$matchStore.modality}
        on:change={(e) => matchStore.updateState(s => ({ ...s, modality: e.target.value }))}
        class="bg-neutral-900 border border-neutral-700 text-xs font-bold rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-white outline-none cursor-pointer"
      >
        <option value="ONE POCKET">ONE POCKET</option>
        <option value="BOLA 8">BOLA 8 (Próximamente)</option>
        <option value="BOLA 9">BOLA 9 (Próximamente)</option>
      </select>
    </div>
  </header>

  <!-- TARJETAS DE JUGADORES: En PC 2 columnas exactas; en celular 1 columna apilada -->
  <main class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
    <PlayerCard playerKey="p1" title="Jugador 1" />
    <PlayerCard playerKey="p2" title="Jugador 2" />
  </main>

  <!-- CONTROLES DEL RELOJ DE TIRO -->
  <div class="bg-[#10131c] border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between shadow-xl gap-4">
    <div class="flex items-center justify-between sm:justify-start gap-3">
      <div class="flex items-center gap-3">
        <Clock size={22} class="text-amber-400 shrink-0" />
        <div>
          <h4 class="text-xs sm:text-sm font-bold uppercase font-mono tracking-wider text-white">Reloj de Tiro</h4>
          <span class="text-[10px] sm:text-xs text-neutral-400">{timer.enabled ? 'Barra activa bajo el HUD' : 'Oculto'}</span>
        </div>
      </div>
      <button
        on:click={() => matchStore.toggleTimer()}
        class="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg border transition {timer.enabled ? 'bg-amber-950/70 border-amber-500/50 text-amber-300' : 'bg-neutral-900 border-neutral-700 text-neutral-400'}"
      >
        {timer.enabled ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>

    <!-- Botonera centralizada -->
    <div class="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4">
      
      <div class="flex items-center bg-[#090b10] border border-neutral-700/80 rounded-xl p-1 gap-1.5 sm:gap-2 shadow-inner">
        <span class="text-xs font-mono font-bold text-neutral-400 pl-2">Fijar:</span>
        <input
          type="number"
          min="5"
          max="180"
          bind:value={customSecondsInput}
          class="w-12 sm:w-14 bg-neutral-900 border border-neutral-700 focus:border-amber-500 text-xs sm:text-sm font-mono font-black text-amber-400 outline-none text-center py-1 rounded-lg"
        />
        <span class="text-xs font-mono text-neutral-400">s</span>
        <button
          on:click={() => matchStore.setCustomTimer(customSecondsInput)}
          class="px-2.5 sm:px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-bold text-white rounded-lg transition border border-white/5"
        >
          OK
        </button>
      </div>

      <span class="text-2xl sm:text-3xl font-black font-mono text-amber-400 w-14 sm:w-16 text-center drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
        {Math.ceil(timer.seconds)}s
      </span>

      <button
        on:click={() => matchStore.setTimerRunning(!timer.running)}
        class="flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 {timer.running ? 'bg-amber-500 text-black' : 'bg-emerald-600 text-white'} text-xs sm:text-sm font-black rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-lg"
      >
        {#if timer.running}
          <Pause size={16} /> Pausar
        {:else}
          <Play size={16} /> Iniciar
        {/if}
      </button>

      <button
        on:click={() => matchStore.resetTimer(timer.maxSeconds)}
        class="px-3 sm:px-4 py-2 sm:py-2.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition border border-white/10"
      >
        <RotateCcw size={15} class="text-amber-400" />
      </button>

    </div>
  </div>

  <!-- GESTOR DE TICKER / MARCAS -->
  <TickerAdmin />

  <!-- MODAL DE CONEXIÓN CON EL MÓVIL MEDIANTE QR -->
  {#if showQrModal}
    <div class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-[#12151e] border border-amber-500/40 rounded-2xl p-5 sm:p-6 text-white max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl relative">
        <button
          on:click={() => showQrModal = false}
          class="absolute top-4 right-4 text-neutral-400 hover:text-white transition"
        >
          <X size={20} />
        </button>

        <h3 class="text-sm font-black uppercase font-mono tracking-wider text-amber-400 flex items-center gap-2">
          <QrCode size={18} /> Conectar con tu Móvil
        </h3>
        <p class="text-xs text-neutral-400 text-center">
          Conéctate a la misma red Wi-Fi y escanea este código con la cámara de tu celular:
        </p>

        <div class="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data={encodeURIComponent(currentMobileUrl)}"
            alt="Código QR de Conexión Móvil"
            class="w-44 h-44 object-contain"
          />
        </div>

        <div class="bg-black/60 p-2.5 rounded-xl border border-white/10 w-full text-center">
          <span class="text-[11px] font-mono text-neutral-300 break-all select-all font-bold">
            {currentMobileUrl}
          </span>
        </div>

        <button
          on:click={() => showQrModal = false}
          class="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-xl transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  {/if}

</div>
