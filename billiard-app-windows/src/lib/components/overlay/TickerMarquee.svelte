<script>
  import { matchStore } from '../../stores/matchStore.js';
  $: ticker = $matchStore.ticker;
  $: activeItems = (ticker?.items || []).filter(i => i.active);
  $: tickerScale = $matchStore.uiScale?.ticker || 1.0;

  $: loopBlock = (() => {
    if (activeItems.length === 0) return [];
    let list = [...activeItems];
    const minItems = Math.max(8, Math.ceil(24 / Math.max(1, activeItems.length)));
    while (list.length < minItems) {
      list = [...list, ...activeItems];
    }
    return list;
  })();

  $: durationSeconds = Math.max(20, loopBlock.length * 3.8);
</script>

<style>
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

<footer
  class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/15 px-6 flex items-center justify-between z-40 shrink-0 gap-6 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.85)] transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
  style="
    background: linear-gradient(180deg, rgba(16, 19, 26, 0.95) 0%, rgba(7, 8, 11, 0.97) 100%);
    transform: scale({tickerScale}) translateY({ticker?.visible ? '0%' : '140%'}); 
    transform-origin: bottom center;
  "
>
  <div class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center">
    
    <div class="conveyor-rail" style="--conveyor-duration: {durationSeconds}s;">
      
      <!-- BLOQUE A -->
      <div class="conveyor-segment">
        {#each loopBlock as item}
          <div class="ticker-box flex items-center gap-3 mr-12 font-mono text-sm uppercase leading-none">
            {#if item.logoUrl}
              <div class="h-6 max-w-[110px] flex items-center justify-center flex-shrink-0">
                <img src={item.logoUrl} alt="" class="h-6 max-w-[110px] object-contain" />
              </div>
            {/if}

            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white leading-none">{item.text}</span>
              <span class="text-amber-400 font-black text-sm leading-none">★</span>
            {:else if item.type === 'aviso'}
              <span class="h-5 px-2 rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none flex-shrink-0">AVISO</span>
              <span class="text-xs font-bold text-neutral-200 leading-none">{item.text}</span>
              <span class="text-blue-400 text-xs leading-none">●</span>
            {:else if item.type === 'advertencia'}
              <span class="h-5 px-2 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none flex-shrink-0">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200 leading-none">{item.text}</span>
              <span class="text-amber-400 text-xs leading-none">▲</span>
            {:else}
              <span class="text-xs text-neutral-300 leading-none">{item.text}</span>
              <span class="text-neutral-500 text-xs leading-none">◆</span>
            {/if}
          </div>
        {/each}
      </div>

      <!-- BLOQUE B -->
      <div class="conveyor-segment" aria-hidden="true">
        {#each loopBlock as item}
          <div class="ticker-box flex items-center gap-3 mr-12 font-mono text-sm uppercase leading-none">
            {#if item.logoUrl}
              <div class="h-6 max-w-[110px] flex items-center justify-center flex-shrink-0">
                <img src={item.logoUrl} alt="" class="h-6 max-w-[110px] object-contain" />
              </div>
            {/if}

            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white leading-none">{item.text}</span>
              <span class="text-amber-400 font-black text-sm leading-none">★</span>
            {:else if item.type === 'aviso'}
              <span class="h-5 px-2 rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none flex-shrink-0">AVISO</span>
              <span class="text-xs font-bold text-neutral-200 leading-none">{item.text}</span>
              <span class="text-blue-400 text-xs leading-none">●</span>
            {:else if item.type === 'advertencia'}
              <span class="h-5 px-2 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none flex-shrink-0">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200 leading-none">{item.text}</span>
              <span class="text-amber-400 text-xs leading-none">▲</span>
            {:else}
              <span class="text-xs text-neutral-300 leading-none">{item.text}</span>
              <span class="text-neutral-500 text-xs leading-none">◆</span>
            {/if}
          </div>
        {/each}
      </div>

    </div>

  </div>
</footer>
