<script>
  import { matchStore } from '../../stores/matchStore.js';
  $: ticker = $matchStore.ticker;
  $: activeItems = ticker.items.filter(i => i.active);
  $: tickerScale = $matchStore.uiScale?.ticker || 1.0;

  $: loopBlock = (() => {
    if (activeItems.length === 0) return [];
    let list = [...activeItems];
    while (list.length < 10) {
      list = [...list, ...activeItems];
    }
    return list;
  })();

  $: durationSeconds = Math.max(25, loopBlock.length * 4);
</script>

<style>
  @keyframes infiniteScroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-100%, 0, 0); }
  }

  .marquee-track {
    display: flex;
    width: max-content;
  }

  .marquee-segment {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    will-change: transform;
    transform: translateZ(0);
    animation: infiniteScroll var(--duration, 40s) linear infinite;
  }
</style>

<!-- ANIMACIÓN UNIFICADA: ESCALA + TRASLACIÓN EN EL MISMO STYLE (NUNCA FALLA EL OCULTAR) -->
<footer
  class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/15 bg-gradient-to-r from-[#07080b] via-[#0d0e15] to-[#07080b] px-6 flex items-center justify-between z-40 shrink-0 gap-6 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.7)] transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
  style="transform: scale({tickerScale}) translateY({ticker.visible ? '0%' : '120%'}); transform-origin: bottom center;"
>
  <div class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center">
    
    <div class="marquee-track h-14" style="--duration: {durationSeconds}s;">
      
      <!-- SEGMENTO 1: TODOS CON h-14, flex items-center Y leading-none PARA LÍNEA HORIZONTAL PERFECTA -->
      <div class="marquee-segment h-14">
        {#each loopBlock as item}
          <div class="h-14 flex items-center gap-3 mr-12 shrink-0 font-mono text-sm uppercase leading-none">
            {#if item.logoUrl}
              <div class="h-7 max-w-[120px] flex items-center justify-center">
                <img src={item.logoUrl} alt="" class="h-7 max-w-[120px] object-contain" />
              </div>
            {/if}

            {#if item.type === 'sponsor'}
              <span class="h-14 flex items-center text-base font-extrabold tracking-widest text-white leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-amber-400 font-black leading-none text-base">★</span>
            {:else if item.type === 'aviso'}
              <span class="h-5 px-2 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none">AVISO</span>
              <span class="h-14 flex items-center text-sm font-bold text-neutral-200 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-blue-400 leading-none">●</span>
            {:else if item.type === 'advertencia'}
              <span class="h-5 px-2 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none">ATENCIÓN</span>
              <span class="h-14 flex items-center text-sm font-bold text-amber-200 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-amber-400 leading-none">▲</span>
            {:else}
              <span class="h-14 flex items-center text-sm text-neutral-300 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-neutral-500 leading-none">◆</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- SEGMENTO 2 -->
      <div class="marquee-segment h-14" aria-hidden="true">
        {#each loopBlock as item}
          <div class="h-14 flex items-center gap-3 mr-12 shrink-0 font-mono text-sm uppercase leading-none">
            {#if item.logoUrl}
              <div class="h-7 max-w-[120px] flex items-center justify-center">
                <img src={item.logoUrl} alt="" class="h-7 max-w-[120px] object-contain" />
              </div>
            {/if}

            {#if item.type === 'sponsor'}
              <span class="h-14 flex items-center text-base font-extrabold tracking-widest text-white leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-amber-400 font-black leading-none text-base">★</span>
            {:else if item.type === 'aviso'}
              <span class="h-5 px-2 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none">AVISO</span>
              <span class="h-14 flex items-center text-sm font-bold text-neutral-200 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-blue-400 leading-none">●</span>
            {:else if item.type === 'advertencia'}
              <span class="h-5 px-2 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none">ATENCIÓN</span>
              <span class="h-14 flex items-center text-sm font-bold text-amber-200 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-amber-400 leading-none">▲</span>
            {:else}
              <span class="h-14 flex items-center text-sm text-neutral-300 leading-none">{item.text}</span>
              <span class="h-14 flex items-center text-neutral-500 leading-none">◆</span>
            {/if}
          </div>
        {/each}
      </div>

    </div>

  </div>
</footer>
