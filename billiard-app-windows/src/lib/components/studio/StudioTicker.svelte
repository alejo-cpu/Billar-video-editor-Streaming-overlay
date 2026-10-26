<script>
  export let items = [];
  export let visible = true;
  export let scale = 1.0;
  export let isFrozen = false;
  export let isPlaying = false; // Se congela automáticamente al pausar el video

  // Filtrar solo los sponsors activos
  $: activeItems = (items || []).filter(i => i.active);

  // Asegura que un ciclo mida al menos 2400px para que nunca haya huecos en pantallas 1080p
  $: loopBlock = (() => {
    if (activeItems.length === 0) return [];
    let list = [...activeItems];
    const minItems = Math.max(8, Math.ceil(24 / Math.max(1, activeItems.length)));
    while (list.length < minItems) {
      list = [...list, ...activeItems];
    }
    return list;
  })();

  // Velocidad constante a 75 píxeles por segundo:
  // Calculamos la duración proporcional a la cantidad de elementos
  $: durationSeconds = Math.max(20, loopBlock.length * 3.8);
</script>

<style>
  /* Desplazamiento al -50% continuo: el bloque 2 toma el lugar exacto del bloque 1 */
  @keyframes conveyorScroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-50%, 0, 0); }
  }

  .conveyor-rail {
    display: flex;
    width: max-content;
    height: 100%;
    align-items: center;
    will-change: transform;
    animation: conveyorScroll var(--conveyor-duration, 35s) linear infinite;
  }

  /* Si el video está pausado, la cinta se detiene en seco en el píxel actual */
  .conveyor-rail.paused {
    animation-play-state: paused !important;
  }

  /* Al sacar fotos PNG para el render, se congela a frame 0 exacto sin cortes */
  .conveyor-rail.frozen {
    animation: none !important;
    transform: translate3d(0, 0, 0) !important;
  }

  .conveyor-segment {
    display: flex;
    align-items: center;
    height: 100%;
    width: max-content;
    flex-shrink: 0;
  }

  .ticker-box {
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>

<!-- Barra negra con acabado ahumado elegante (96% opaco, estilo broadcast) -->
<footer
  class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/15 px-6 flex items-center justify-between z-40 shrink-0 gap-6 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.85)]"
  style="
    background: linear-gradient(180deg, rgba(16, 19, 26, 0.95) 0%, rgba(7, 8, 11, 0.97) 100%);
    transform: translateY({visible ? '0%' : '140%'}) scale({scale}); 
    transform-origin: bottom center; 
    transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
  "
>
  <div class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center">
    
    <div 
      class="conveyor-rail" 
      class:paused={!isPlaying && !isFrozen}
      class:frozen={isFrozen}
      style="--conveyor-duration: {durationSeconds}s;"
    >
      
      <!-- BLOQUE A -->
      <div class="conveyor-segment">
        {#each loopBlock as item}
          <div class="ticker-box flex items-center gap-3 pr-12 font-mono text-sm uppercase">
            {#if item.logoUrl}
              <img src={item.logoUrl} alt="" class="h-6 max-w-[110px] object-contain flex-shrink-0" />
            {/if}

            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white">{item.text}</span>
              <span class="text-amber-400 font-black">★</span>
            {:else if item.type === 'aviso'}
              <span class="px-2 py-0.5 text-xs rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex-shrink-0">AVISO</span>
              <span class="text-xs font-bold text-neutral-200">{item.text}</span>
              <span class="text-blue-400">●</span>
            {:else if item.type === 'advertencia'}
              <span class="px-2 py-0.5 text-xs rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex-shrink-0">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200">{item.text}</span>
              <span class="text-amber-400">▲</span>
            {:else}
              <span class="text-xs text-neutral-300">{item.text}</span>
              <span class="text-neutral-500">◆</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- BLOQUE B (Continúa exactamente donde termina el bloque A) -->
      {#if !isFrozen}
        <div class="conveyor-segment" aria-hidden="true">
          {#each loopBlock as item}
            <div class="ticker-box flex items-center gap-3 pr-12 font-mono text-sm uppercase">
              {#if item.logoUrl}
                <img src={item.logoUrl} alt="" class="h-6 max-w-[110px] object-contain flex-shrink-0" />
              {/if}

              {#if item.type === 'sponsor'}
                <span class="text-sm font-extrabold tracking-widest text-white">{item.text}</span>
                <span class="text-amber-400 font-black">★</span>
              {:else if item.type === 'aviso'}
                <span class="px-2 py-0.5 text-xs rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex-shrink-0">AVISO</span>
                <span class="text-xs font-bold text-neutral-200">{item.text}</span>
                <span class="text-blue-400">●</span>
              {:else if item.type === 'advertencia'}
                <span class="px-2 py-0.5 text-xs rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex-shrink-0">ATENCIÓN</span>
                <span class="text-xs font-bold text-amber-200">{item.text}</span>
                <span class="text-amber-400">▲</span>
              {:else}
                <span class="text-xs text-neutral-300">{item.text}</span>
                <span class="text-neutral-500">◆</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

    </div>

  </div>
</footer>
