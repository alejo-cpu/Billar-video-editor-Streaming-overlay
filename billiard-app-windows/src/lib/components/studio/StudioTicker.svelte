<script>
  export let items = [];
  export let visible = true;
  export let scale = 1.0;

  $: activeItems = (items || []).filter(i => i.active);

  $: loopBlock = (() => {
    if (activeItems.length === 0) return [];
    let list = [...activeItems];
    while (list.length < 16) {
      list = [...list, ...activeItems];
    }
    return list;
  })();

  $: durationSeconds = Math.max(20, loopBlock.length * 3.0);
</script>

<style>
  @keyframes infiniteScroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-100%, 0, 0); }
  }

  .studio-marquee-track {
    display: flex;
    width: max-content;
    height: 100%;
    align-items: center;
  }

  .studio-marquee-segment {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 0;
    will-change: transform;
    transform: translateZ(0);
    animation: infiniteScroll var(--duration, 35s) linear infinite;
  }
</style>

<footer
  class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/15 bg-gradient-to-r from-[#07080b] via-[#0d0e15] to-[#07080b] px-6 flex items-center justify-between z-40 shrink-0 gap-6 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.7)]"
  style="transform: translateY({visible ? '0%' : '140%'}) scale({scale}); transform-origin: bottom center; transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);"
>
  <div class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center">
    
    <div class="studio-marquee-track" style="--duration: {durationSeconds}s;">
      
      <div class="studio-marquee-segment">
        {#each loopBlock as item}
          <div class="flex items-center gap-3 pr-12 shrink-0 font-mono text-sm uppercase">
            {#if item.logoUrl}
              <img src={item.logoUrl} alt="" class="h-6 max-w-[100px] object-contain" />
            {/if}

            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white">{item.text}</span>
              <span class="text-amber-400 font-black">★</span>
            {:else if item.type === 'aviso'}
              <span class="px-2 py-0.5 text-xs rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 font-sans font-bold">AVISO</span>
              <span class="text-xs font-bold text-neutral-200">{item.text}</span>
              <span class="text-blue-400">●</span>
            {:else if item.type === 'advertencia'}
              <span class="px-2 py-0.5 text-xs rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-sans font-bold">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200">{item.text}</span>
              <span class="text-amber-400">▲</span>
            {:else}
              <span class="text-xs text-neutral-300">{item.text}</span>
              <span class="text-neutral-500">◆</span>
            {/if}
          </div>
        {/each}
      </div>

      <div class="studio-marquee-segment" aria-hidden="true">
        {#each loopBlock as item}
          <div class="flex items-center gap-3 pr-12 shrink-0 font-mono text-sm uppercase">
            {#if item.logoUrl}
              <img src={item.logoUrl} alt="" class="h-6 max-w-[100px] object-contain" />
            {/if}

            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white">{item.text}</span>
              <span class="text-amber-400 font-black">★</span>
            {:else if item.type === 'aviso'}
              <span class="px-2 py-0.5 text-xs rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 font-sans font-bold">AVISO</span>
              <span class="text-xs font-bold text-neutral-200">{item.text}</span>
              <span class="text-blue-400">●</span>
            {:else if item.type === 'advertencia'}
              <span class="px-2 py-0.5 text-xs rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-sans font-bold">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200">{item.text}</span>
              <span class="text-amber-400">▲</span>
            {:else}
              <span class="text-xs text-neutral-300">{item.text}</span>
              <span class="text-neutral-500">◆</span>
            {/if}
          </div>
        {/each}
      </div>

    </div>

  </div>
</footer>
