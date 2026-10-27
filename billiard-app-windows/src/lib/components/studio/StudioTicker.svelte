<script>
  import { onMount, onDestroy } from 'svelte';

  export let items = [];
  export let visible = true;
  export let scale = 1.0;
  export let isFrozen = false;
  export let isPlaying = false;

  const SPEED = 75; // Píxeles por segundo
  const GAP = 28;   // Separación limpia entre marcas (sin espacios gigantes)

  $: activeItems = (items || []).filter(i => i.active);

  let conveyorBoxes = [];
  let itemQueueIndex = 0;
  let animationFrameId = null;
  let lastFrameTime = null;
  let boxCounter = 0;

  // Cálculo exacto del ancho para que no queden huecos excesivos
  function estimateItemWidth(item) {
    const textW = (item.text || '').length * 8.5;
    const logoW = item.logoUrl ? 90 : 0;
    const badgeW = item.type !== 'sponsor' ? 65 : 0;
    return Math.max(120, Math.round(textW + logoW + badgeW + 28));
  }

  function createBox(item, startX) {
    boxCounter++;
    return {
      uid: `box_${boxCounter}_${Date.now()}`,
      item,
      x: startX,
      width: estimateItemWidth(item)
    };
  }

  function seedConveyor() {
    if (activeItems.length === 0) {
      conveyorBoxes = [];
      return;
    }
    const initial = [];
    let currentX = 0;
    let idx = 0;
    while (currentX < 2400) {
      const it = activeItems[idx % activeItems.length];
      const box = createBox(it, currentX);
      initial.push(box);
      currentX += box.width + GAP;
      idx++;
    }
    itemQueueIndex = idx % activeItems.length;
    conveyorBoxes = initial;
  }

  $: if (activeItems.length > 0 && conveyorBoxes.length === 0) {
    seedConveyor();
  }

  function updateConveyor(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const deltaSec = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (isPlaying && !isFrozen && activeItems.length > 0) {
      const distance = SPEED * deltaSec;

      const updated = [];
      for (let i = 0; i < conveyorBoxes.length; i++) {
        const b = conveyorBoxes[i];
        b.x -= distance;
        if (b.x + b.width > -50) {
          updated.push(b);
        }
      }

      let rightmostEdge = 0;
      for (let i = 0; i < updated.length; i++) {
        const edge = updated[i].x + updated[i].width;
        if (edge > rightmostEdge) rightmostEdge = edge;
      }

      if (rightmostEdge < 1920) {
        const nextItem = activeItems[itemQueueIndex % activeItems.length];
        if (nextItem) {
          const spawnX = Math.max(1920, rightmostEdge + GAP);
          const newBox = createBox(nextItem, spawnX);
          updated.push(newBox);
          itemQueueIndex = (itemQueueIndex + 1) % activeItems.length;
        }
      }

      conveyorBoxes = updated;
    }

    animationFrameId = requestAnimationFrame(updateConveyor);
  }

  onMount(() => {
    seedConveyor();
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(updateConveyor);
  });

  onDestroy(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });
</script>

<style>
  /* Altura 100% y flex centrado: asegura 17px de margen arriba y abajo para que AVISO nunca se corte */
  .ticker-box {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    will-change: transform, left;
    white-space: nowrap;
  }
</style>

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
    
    {#if isFrozen}
      <div class="studio-marquee-segment flex items-center w-max h-full">
        {#each activeItems as item}
          <div class="flex items-center gap-3 pr-8 font-mono text-sm uppercase flex-shrink-0">
            {#if item.logoUrl}
              <img src={item.logoUrl} alt="" class="h-6 max-w-[100px] object-contain flex-shrink-0" />
            {/if}
            {#if item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white">{item.text}</span>
              <span class="text-amber-400 font-black">★</span>
            {:else if item.type === 'aviso'}
              <span class="px-2 py-0.5 text-xs rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex-shrink-0 leading-normal">AVISO</span>
              <span class="text-xs font-bold text-neutral-200">{item.text}</span>
              <span class="text-blue-400">●</span>
            {:else if item.type === 'advertencia'}
              <span class="px-2 py-0.5 text-xs rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex-shrink-0 leading-normal">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200">{item.text}</span>
              <span class="text-amber-400">▲</span>
            {:else}
              <span class="text-xs text-neutral-300">{item.text}</span>
              <span class="text-neutral-500">◆</span>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="relative w-full h-full overflow-hidden">
        {#each conveyorBoxes as b (b.uid)}
          <div 
            class="ticker-box flex items-center gap-3 font-mono text-sm uppercase"
            style="left: {b.x}px;"
          >
            {#if b.item.logoUrl}
              <img src={b.item.logoUrl} alt="" class="h-6 max-w-[100px] object-contain flex-shrink-0" />
            {/if}

            {#if b.item.type === 'sponsor'}
              <span class="text-sm font-extrabold tracking-widest text-white">{b.item.text}</span>
              <span class="text-amber-400 font-black">★</span>
            {:else if b.item.type === 'aviso'}
              <span class="px-2 py-0.5 text-xs rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex-shrink-0 leading-normal">AVISO</span>
              <span class="text-xs font-bold text-neutral-200">{b.item.text}</span>
              <span class="text-blue-400">●</span>
            {:else if b.item.type === 'advertencia'}
              <span class="px-2 py-0.5 text-xs rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex-shrink-0 leading-normal">ATENCIÓN</span>
              <span class="text-xs font-bold text-amber-200">{b.item.text}</span>
              <span class="text-amber-400">▲</span>
            {:else}
              <span class="text-xs text-neutral-300">{b.item.text}</span>
              <span class="text-neutral-500">◆</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  </div>
</footer>
