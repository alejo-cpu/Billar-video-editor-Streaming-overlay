<script>
  import { scale } from 'svelte/transition';
  import { matchStore } from '../../stores/matchStore.js';
  import NumberRoll from './NumberRoll.svelte';

  $: p1 = $matchStore.p1;
  $: p2 = $matchStore.p2;
  $: showAvatars = $matchStore.showAvatars;
  $: turns = $matchStore.turns;
  $: modality = $matchStore.modality;
  $: race = $matchStore.race;
  $: timer = $matchStore.timer;
  $: hudScale = $matchStore.uiScale?.hud || 1.0;

  $: isP1Active = turns.enabled && turns.active === 'p1';
  $: isP2Active = turns.enabled && turns.active === 'p2';

  $: maxNameLength = Math.max((p1.name || '').length, (p2.name || '').length);
  $: isShortMode = maxNameLength <= 6;

  $: hudWidthClass = (() => {
    if (showAvatars) return isShortMode ? 'w-[750px]' : 'w-[890px]';
    return isShortMode ? 'w-[650px]' : 'w-[760px]';
  })();

  $: timerWidthClass = (() => {
    if (showAvatars) return isShortMode ? 'w-[540px]' : 'w-[680px]';
    return isShortMode ? 'w-[480px]' : 'w-[580px]';
  })();
</script>

<header 
  class="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center select-none font-sans transition-transform duration-300 ease-out"
  style="transform: translateX(-50%) scale({hudScale}); transform-origin: top center;"
>
  
  <!-- RECORTE TRAPEZOIDAL ORIGINAL CON CLIP-PATH -->
  <div 
    class="border-t border-x border-white/20 px-7 py-2.5 text-white transition-all duration-500 ease-in-out shadow-[0_8px_20px_rgba(0,0,0,0.85)] {hudWidthClass}"
    style="clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 16px 100%); background: linear-gradient(180deg, #10131a 0%, #08090d 100%);"
  >
    <div class="grid grid-cols-[1fr_auto_1fr] items-center w-full">
      
      <!-- ================= JUGADOR 1 ================= -->
      <div class="flex items-center justify-between w-full min-w-0 pr-3">
        
        <div class="flex items-center gap-2 shrink-0">
          <span class="w-4 text-center text-xs font-black {isP1Active ? 'text-amber-400' : 'text-neutral-500'} font-mono tracking-wider shrink-0">
            {p1.pocket || ''}
          </span>

          <!-- Caja de bolas con alineación interna centrada de todos sus elementos -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded border transition-all duration-300 shrink-0
            {isP1Active 
              ? 'border-[#c27813] bg-[#1a1103]/95 shadow-[inset_0_0_10px_rgba(194,120,19,0.35)]' 
              : 'border-neutral-700 bg-neutral-900/95'}"
          >
            <span class="text-[10px] font-extrabold uppercase font-mono tracking-wider flex items-center leading-none {isP1Active ? 'text-[#e5a01d]' : 'text-neutral-400'}">BOLAS:</span>
            <div class="w-[1px] h-3.5 {isP1Active ? 'bg-[#8c5205]' : 'bg-neutral-700'} shrink-0"></div>
            <div class="flex items-center justify-center leading-none">
              <NumberRoll value={p1.balls} customClass="text-base font-black {isP1Active ? 'text-[#fbc02d]' : 'text-white'}" />
            </div>
          </div>
        </div>

        <!-- Nombre completo sin cortes -->
        <div class="flex-1 min-w-0 px-2 flex items-center justify-center">
          <span class="text-sm font-extrabold tracking-wider text-white uppercase truncate text-center w-full" title={p1.name}>
            {p1.name}
          </span>
        </div>

        {#if showAvatars}
          <div transition:scale={{ duration: 250 }} class="relative shrink-0 w-10 h-10 flex items-center justify-center">
            <img alt={p1.name} class="w-10 h-10 rounded-full object-cover transition-all duration-300 bg-neutral-900
              {isP1Active ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'ring-1 ring-white/20'}" 
              src={p1.avatar} 
            />
          </div>
        {/if}
      </div>

      <!-- ================= CENTRO CON ESPACIO AMPLIO (NADA QUEDA APLASTADO) ================= -->
      <div class="flex items-center justify-center shrink-0 px-4 border-x border-white/15">
        <div class="w-[110px] flex flex-col items-center justify-center py-0.5">
          <div class="text-[9px] font-black text-[#e5a01d] tracking-[0.18em] font-mono leading-tight uppercase">{modality}</div>
          <div class="text-[7.5px] font-bold text-[#e5a01d] tracking-[0.14em] font-mono leading-tight uppercase mt-0.5">{race}</div>
          
          <div class="flex items-center gap-1.5 font-mono my-0.5">
            <NumberRoll value={p1.games} customClass="text-2xl font-black text-[#fbc02d]" />
            <span class="text-lg font-bold text-neutral-500 leading-none pb-0.5">:</span>
            <NumberRoll value={p2.games} customClass="text-2xl font-black text-[#fbc02d]" />
          </div>
          
          <div class="text-[7.5px] font-bold text-neutral-400 tracking-[0.16em] font-mono leading-tight uppercase">GAMES</div>
        </div>
      </div>

      <!-- ================= JUGADOR 2 ================= -->
      <div class="flex items-center justify-between w-full min-w-0 pl-3">
        {#if showAvatars}
          <div transition:scale={{ duration: 250 }} class="relative shrink-0 w-10 h-10 flex items-center justify-center">
            <img alt={p2.name} class="w-10 h-10 rounded-full object-cover transition-all duration-300 bg-neutral-900
              {isP2Active ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'ring-1 ring-white/20'}" 
              src={p2.avatar} 
            />
          </div>
        {/if}

        <div class="flex-1 min-w-0 px-2 flex items-center justify-center">
          <span class="text-sm font-extrabold tracking-wider text-white uppercase truncate text-center w-full" title={p2.name}>
            {p2.name}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded border transition-all duration-300 shrink-0
            {isP2Active 
              ? 'border-[#c27813] bg-[#1a1103]/95 shadow-[inset_0_0_10px_rgba(194,120,19,0.35)]' 
              : 'border-neutral-700 bg-neutral-900/95'}"
          >
            <span class="text-[10px] font-extrabold uppercase font-mono tracking-wider flex items-center leading-none {isP2Active ? 'text-[#e5a01d]' : 'text-neutral-400'}">BOLAS:</span>
            <div class="w-[1px] h-3.5 {isP2Active ? 'bg-[#8c5205]' : 'bg-neutral-700'} shrink-0"></div>
            <div class="flex items-center justify-center leading-none">
              <NumberRoll value={p2.balls} customClass="text-base font-black {isP2Active ? 'text-[#fbc02d]' : 'text-white'}" />
            </div>
          </div>

          <span class="w-4 text-center text-xs font-black {isP2Active ? 'text-amber-400' : 'text-neutral-500'} font-mono tracking-wider shrink-0">
            {p2.pocket || ''}
          </span>
        </div>

      </div>

    </div>
  </div>

  <!-- RELOJ DE TIRO -->
  <div
    class="transition-all duration-500 ease-in-out z-40 mt-1.5 flex items-center justify-between gap-3 {timerWidthClass}
    {timer.enabled ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}"
  >
    <div class="h-[7.5px] bg-black/90 w-full rounded-full overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
      <div
        class="h-full bg-amber-400 rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(251,191,36,0.8)]"
        style="width: {timer.maxSeconds > 0 ? (timer.seconds / timer.maxSeconds) * 100 : 0}%"
      ></div>
    </div>
    
    <span class="text-xs font-mono font-bold text-amber-400 min-w-[26px] text-right">
      {Math.ceil(timer.seconds)}s
    </span>
  </div>

</header>
