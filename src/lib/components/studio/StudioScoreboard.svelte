<script>
  export let matchState = {};

  $: p1 = matchState.p1 || { name: 'JUGADOR 1', balls: 0, games: 0, pocket: '', avatar: '' };
  $: p2 = matchState.p2 || { name: 'JUGADOR 2', balls: 0, games: 0, pocket: '', avatar: '' };
  $: showAvatars = matchState.showAvatars ?? true;
  $: turns = matchState.turns || { enabled: false, active: 'p1' };
  $: modality = matchState.modality || 'ONE POCKET';
  $: race = matchState.race || 'RACE TO 3';
  $: hudScale = matchState.uiScale?.hud || 1.0;

  $: isP1Active = turns.enabled && turns.active === 'p1';
  $: isP2Active = turns.enabled && turns.active === 'p2';

  $: maxNameLength = Math.max((p1.name || '').trim().length, (p2.name || '').trim().length);
  $: isShortMode = maxNameLength <= 6;

  $: hudWidthClass = (() => {
    if (showAvatars) {
      if (isShortMode) return 'w-[750px]';
      if (maxNameLength <= 14) return 'w-[900px]';
      return 'w-[960px]';
    } else {
      if (isShortMode) return 'w-[650px]';
      if (maxNameLength <= 14) return 'w-[780px]';
      return 'w-[840px]';
    }
  })();
</script>

<header 
  class="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center select-none font-sans"
  style="transform: translateX(-50%) scale({hudScale}); transform-origin: top center;"
>
  <div 
    class="studio-scoreboard-card border-t border-x border-white/20 px-8 py-2.5 text-white transition-all duration-300 {hudWidthClass}"
    style="clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 16px 100%); background: linear-gradient(180deg, #12151e 0%, #08090d 100%); filter: drop-shadow(0 8px 16px rgba(0,0,0,0.85));"
  >
    <div class="grid grid-cols-[1fr_auto_1fr] items-center w-full">
      
      <!-- ================= JUGADOR 1 (IZQUIERDA) ================= -->
      <div class="flex items-center justify-between w-full min-w-0 pr-3">
        
        <div class="flex items-center gap-2.5 shrink-0">
          <span class="w-4 text-center text-xs font-black font-mono tracking-wider leading-none {isP1Active ? 'text-amber-400' : 'text-neutral-500'}">
            {p1.pocket || ''}
          </span>

          <div class="flex items-center gap-2 px-3 py-1.5 rounded border transition-all duration-300 shrink-0
            {isP1Active 
              ? 'border-[#c27813] bg-[#1a1103]/95 shadow-[inset_0_0_8px_rgba(194,120,19,0.3)]' 
              : 'border-neutral-700 bg-neutral-900/95'}"
          >
            <span class="text-[10px] font-extrabold uppercase font-mono tracking-wider leading-none flex items-center {isP1Active ? 'text-[#e5a01d]' : 'text-neutral-400'}">
              BOLAS:
            </span>
            <div class="w-[1px] h-3.5 {isP1Active ? 'bg-[#8c5205]' : 'bg-neutral-700'} shrink-0"></div>
            <span class="font-mono text-base font-black leading-none text-center min-w-[14px] {isP1Active ? 'text-[#fbc02d]' : 'text-white'}">
              {p1.balls}
            </span>
          </div>
        </div>

        <div class="flex-1 min-w-0 max-w-[240px] px-3 flex items-center justify-center">
          <span 
            class="text-sm font-extrabold tracking-wider text-white uppercase truncate text-center block max-w-full leading-normal" 
            title={p1.name}
          >
            {p1.name}
          </span>
        </div>

        {#if showAvatars}
          <div class="relative shrink-0 w-10 h-10 flex items-center justify-center">
            <img 
              alt={p1.name} 
              class="w-10 h-10 rounded-full object-cover bg-neutral-900 shadow-sm
                {isP1Active ? 'ring-2 ring-amber-400' : 'ring-1 ring-white/20'}" 
              src={p1.avatar} 
            />
          </div>
        {/if}

      </div>

      <!-- ================= BLOQUE CENTRAL ================= -->
      <div class="flex items-center justify-center shrink-0 px-4 py-0.5 border-x border-white/15 my-auto">
        <div class="w-[110px] flex flex-col items-center justify-center leading-none">
          <span class="text-[8.5px] font-black text-[#e5a01d] tracking-[0.16em] font-mono leading-tight uppercase">
            {modality}
          </span>
          <span class="text-[7px] font-bold text-[#e5a01d] tracking-[0.12em] font-mono leading-tight uppercase mt-[1px]">
            {race}
          </span>
          
          <div class="flex items-center justify-center gap-1.5 font-mono my-0.5 leading-none">
            <span class="text-xl font-black text-[#fbc02d] leading-none">{p1.games}</span>
            <span class="text-sm font-bold text-neutral-500 leading-none pb-[1px]">:</span>
            <span class="text-xl font-black text-[#fbc02d] leading-none">{p2.games}</span>
          </div>
          
          <span class="text-[7px] font-bold text-neutral-400 tracking-[0.14em] font-mono leading-tight uppercase">
            GAMES
          </span>
        </div>
      </div>

      <!-- ================= JUGADOR 2 (DERECHA) ================= -->
      <div class="flex items-center justify-between w-full min-w-0 pl-3">
        
        {#if showAvatars}
          <div class="relative shrink-0 w-10 h-10 flex items-center justify-center">
            <img 
              alt={p2.name} 
              class="w-10 h-10 rounded-full object-cover bg-neutral-900 shadow-sm
                {isP2Active ? 'ring-2 ring-amber-400' : 'ring-1 ring-white/20'}" 
              src={p2.avatar} 
            />
          </div>
        {/if}

        <div class="flex-1 min-w-0 max-w-[240px] px-3 flex items-center justify-center">
          <span 
            class="text-sm font-extrabold tracking-wider text-white uppercase truncate text-center block max-w-full leading-normal" 
            title={p2.name}
          >
            {p2.name}
          </span>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded border transition-all duration-300 shrink-0
            {isP2Active 
              ? 'border-[#c27813] bg-[#1a1103]/95 shadow-[inset_0_0_8px_rgba(194,120,19,0.3)]' 
              : 'border-neutral-700 bg-neutral-900/95'}"
          >
            <span class="text-[10px] font-extrabold uppercase font-mono tracking-wider leading-none flex items-center {isP2Active ? 'text-[#e5a01d]' : 'text-neutral-400'}">
              BOLAS:
            </span>
            <div class="w-[1px] h-3.5 {isP2Active ? 'bg-[#8c5205]' : 'bg-neutral-700'} shrink-0"></div>
            <span class="font-mono text-base font-black leading-none text-center min-w-[14px] {isP2Active ? 'text-[#fbc02d]' : 'text-white'}">
              {p2.balls}
            </span>
          </div>

          <span class="w-4 text-center text-xs font-black font-mono tracking-wider leading-none {isP2Active ? 'text-amber-400' : 'text-neutral-500'}">
            {p2.pocket || ''}
          </span>
        </div>

      </div>

    </div>
  </div>
</header>
