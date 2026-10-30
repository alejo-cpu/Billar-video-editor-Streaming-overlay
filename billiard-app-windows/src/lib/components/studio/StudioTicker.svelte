<script>
	import { onMount, onDestroy } from 'svelte';

	export let items = [];
	export let visible = true;
	export let scale = 1.0;
	export let isFrozen = false;
	export let isPlaying = false;

	$: activeQueue = (items || []).filter((i) => i.active);

	// Bucle repetido para FFmpeg (render) para que mida más de 3000px y nunca deje vacíos negros a la derecha
	$: loopBlock = (() => {
		if (activeQueue.length === 0) return [];
		let list = [...activeQueue];
		while (list.length < 16) {
			list = [...list, ...activeQueue];
		}
		return list;
	})();

	const SPEED = 75; // Velocidad fija y constante
	const GAP = 36; // Separación limpia entre marcas

	let containerEl;
	let containerWidth = 1920;
	let liveItems = [];
	let queueIndex = 0;
	let nextInstanceId = 1;
	let animId = null;
	let lastTime = null;
	let lastSignature = '';

	$: activeSignature = activeQueue
		.map((i) => (i.id || i.text) + ':' + (i.active ? '1' : '0'))
		.join('|');

	$: {
		if (activeSignature !== lastSignature && visible) {
			lastSignature = activeSignature;
			resetConveyor();
		}
	}

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

	function resetConveyor() {
		liveItems = [];
		queueIndex = 0;
		if (activeQueue.length === 0) return;

		if (containerEl) {
			containerWidth = containerEl.clientWidth || 1920;
		}

		let curX = 0;
		let count = 0;
		while (curX < containerWidth && count < activeQueue.length * 3) {
			const data = activeQueue[queueIndex % activeQueue.length];
			queueIndex++;
			const estimatedW = Math.max(
				120,
				(data.text || '').length * 10 + (data.logoUrl ? 80 : 0) + 70
			);
			liveItems = [
				...liveItems,
				{
					instanceId: nextInstanceId++,
					item: data,
					x: curX,
					width: estimatedW,
					el: null
				}
			];
			curX += estimatedW + GAP;
			count++;
		}
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
			containerWidth = containerEl.clientWidth || 1920;
		}

		if (isPlaying && !isFrozen) {
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
					if (last && !last.width && last.el) {
						last.width = last.el.offsetWidth;
					}
					if (last && last.width > 0) {
						const nextSpawnX = last.x + last.width + GAP;
						if (nextSpawnX <= containerWidth) {
							spawnItem(nextSpawnX);
						}
					}
				}
			}

			if (liveItems.length > 0 && liveItems[0].width > 0) {
				if (liveItems[0].x + liveItems[0].width < -50) {
					liveItems = liveItems.slice(1);
				}
			}
		}

		animId = requestAnimationFrame(updateConveyor);
	}

	function handleResize() {
		if (containerEl) {
			containerWidth = containerEl.clientWidth || 1920;
		}
	}

	onMount(() => {
		handleResize();
		window.addEventListener('resize', handleResize);
		resetConveyor();
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
	class="fixed bottom-0 left-0 right-0 h-14 border-t border-white/15 px-6 flex items-center justify-between z-40 shrink-0 pointer-events-none select-none shadow-[0_-8px_25px_rgba(0,0,0,0.85)]"
	style="
    background: linear-gradient(180deg, rgba(16, 19, 26, 0.95) 0%, rgba(7, 8, 11, 0.97) 100%);
    transform: translateY({visible ? '0%' : '140%'}) scale({scale}); 
    transform-origin: bottom center; 
    transition: transform 1.6s cubic-bezier(0.16, 1, 0.3, 1);
  "
>
	<div
		bind:this={containerEl}
		class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center"
	>
		{#if isFrozen}
			<!-- Bloque para renderizado FFmpeg: repetido de forma continua para medir más de 3000px y no dejar vacíos negros -->
			<div class="studio-marquee-segment flex items-center w-max h-full">
				{#each loopBlock as item}
					<div class="flex items-center gap-3 pr-9 font-mono text-sm uppercase flex-shrink-0">
						{#if item.logoUrl}
							<div class="h-6 max-w-[100px] min-w-[28px] flex items-center justify-center shrink-0">
								<img
									src={item.logoUrl}
									alt=""
									class="h-6 max-w-[100px] w-auto object-contain shrink-0 smooth-logo"
								/>
							</div>
						{/if}
						{#if item.type === 'sponsor'}
							<span class="text-sm font-extrabold tracking-widest text-white leading-none"
								>{item.text}</span
							>
							<span class="text-amber-400 font-black text-sm leading-none">★</span>
						{:else if item.type === 'aviso'}
							<span
								class="h-5 px-2 rounded bg-blue-950/90 border border-blue-500/50 text-blue-300 font-sans font-bold flex items-center justify-center text-xs leading-none shrink-0"
								>AVISO</span
							>
							<span class="text-xs font-bold text-neutral-200 leading-none">{item.text}</span>
							<span class="text-blue-400 text-xs leading-none">●</span>
						{:else if item.type === 'advertencia'}
							<span
								class="h-5 px-2 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 font-sans font-bold flex items-center justify-center text-xs leading-none shrink-0"
								>ATENCIÓN</span
							>
							<span class="text-xs font-bold text-amber-200 leading-none">{item.text}</span>
							<span class="text-amber-400 text-xs leading-none">▲</span>
						{:else}
							<span class="text-xs text-neutral-300 leading-none">{item.text}</span>
							<span class="text-neutral-500 text-xs leading-none">◆</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
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
							<div class="h-6 max-w-[100px] min-w-[28px] flex items-center justify-center shrink-0">
								<img
									src={live.item.logoUrl}
									alt=""
									class="h-6 max-w-[100px] w-auto object-contain shrink-0 smooth-logo"
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
		{/if}
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
	}
</style>
