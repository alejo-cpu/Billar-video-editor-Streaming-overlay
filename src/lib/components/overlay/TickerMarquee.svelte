<script>
	import { onMount, onDestroy } from 'svelte';
	import { matchStore } from '../../stores/matchStore.js';

	$: ticker = $matchStore.ticker;
	$: activeQueue = (ticker?.items || []).filter((i) => i.active);
	$: tickerScale = $matchStore.uiScale?.ticker || 1.0;

	const SPEED = 95;
	const GAP = 42;

	let containerEl;
	let containerWidth = 1920;
	let liveItems = [];
	let queueIndex = 0;
	let nextInstanceId = 1;
	let animId = null;
	let lastTime = null;

	function spawnItem(startX) {
		if (activeQueue.length === 0) return;
		const data = activeQueue[queueIndex % activeQueue.length];
		queueIndex++;

		liveItems = [
			...liveItems,
			{
				instanceId: nextInstanceId++,
				item: data,
				x: startX,
				width: 0,
				el: null
			}
		];
	}

	function updateConveyor(now) {
		if (!lastTime) lastTime = now;
		const dt = (now - lastTime) / 1000;
		lastTime = now;

		if (dt > 0.1) {
			animId = requestAnimationFrame(updateConveyor);
			return;
		}

		if (containerEl) {
			containerWidth = containerEl.clientWidth || window.innerWidth || 1920;
		}

		// Traslacion continua en coma flotante con aceleracion GPU
		for (let i = 0; i < liveItems.length; i++) {
			const live = liveItems[i];
			if (!live.width && live.el) {
				live.width = live.el.offsetWidth;
			}
			live.x -= SPEED * dt;
			if (live.el) {
				live.el.style.transform = `translate3d(${live.x}px, 0, 0)`;
			}
		}

		if (activeQueue.length > 0) {
			if (liveItems.length === 0) {
				spawnItem(containerWidth);
			} else {
				const last = liveItems[liveItems.length - 1];
				if (last && last.width > 0) {
					const nextSpawnX = last.x + last.width + GAP;
					if (nextSpawnX <= containerWidth) {
						spawnItem(nextSpawnX);
					}
				}
			}
		}

		if (liveItems.length > 0 && liveItems[0].width > 0) {
			if (liveItems[0].x + liveItems[0].width < -30) {
				liveItems = liveItems.slice(1);
			}
		}

		animId = requestAnimationFrame(updateConveyor);
	}

	function handleResize() {
		if (containerEl) {
			containerWidth = containerEl.clientWidth || window.innerWidth || 1920;
		}
	}

	onMount(() => {
		handleResize();
		window.addEventListener('resize', handleResize);
		animId = requestAnimationFrame(updateConveyor);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', handleResize);
			if (animId) cancelAnimationFrame(animId);
		}
	});
</script>

<footer
	class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/10 px-6 flex items-center justify-between z-40 shrink-0 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.7)] transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
	style="
    background: rgba(6, 8, 12, 0.90);
    transform: scale({tickerScale}) translateY({ticker?.visible ? '0%' : '140%'}); 
    transform-origin: bottom center;
  "
>
	<div bind:this={containerEl} class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full">
		{#each liveItems as live (live.instanceId)}
			<div
				bind:this={live.el}
				class="absolute top-0 bottom-0 flex items-center will-change-transform"
				style="transform: translate3d({live.x}px, 0, 0);"
			>
				<div
					class="flex items-center gap-3 font-mono text-sm uppercase leading-none whitespace-nowrap shrink-0"
				>
					{#if live.item.logoUrl}
						<div class="h-6 max-w-[110px] min-w-[28px] flex items-center justify-center shrink-0">
							<img
								src={live.item.logoUrl}
								alt=""
								class="h-6 max-w-[110px] w-auto object-contain shrink-0 smooth-logo"
								loading="eager"
								decoding="sync"
							/>
						</div>
					{/if}

					{#if live.item.type === 'sponsor'}
						<span class="text-sm font-extrabold tracking-widest text-white leading-none"
							>{live.item.text}</span
						>
						<span class="text-amber-400 font-black text-sm leading-none">★</span>
					{:else if live.item.type === 'aviso'}
						<span
							class="h-5 px-2 rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none shrink-0"
							>AVISO</span
						>
						<span class="text-xs font-bold text-neutral-200 leading-none">{live.item.text}</span>
						<span class="text-blue-400 text-xs leading-none">●</span>
					{:else if live.item.type === 'advertencia'}
						<span
							class="h-5 px-2 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none shrink-0"
							>ATENCIÓN</span
						>
						<span class="text-xs font-bold text-amber-200 leading-none">{live.item.text}</span>
						<span class="text-amber-400 text-xs leading-none">▲</span>
					{:else}
						<span class="text-xs text-neutral-300 leading-none">{live.item.text}</span>
						<span class="text-neutral-500 text-xs leading-none">◆</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</footer>

<style>
	.ticker-mask {
		isolation: isolate;
		mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
		-webkit-mask-image: linear-gradient(to right, transparent, black 4%, black 96%, transparent);
	}

	.smooth-logo {
		transform: translateZ(0);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
		filter: blur(0px);
		image-rendering: auto;
	}
</style>
