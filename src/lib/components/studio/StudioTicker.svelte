<script>
	import { onMount, onDestroy } from 'svelte';

	export let items = [];
	export let visible = true;
	export let scale = 1.0;
	export let isFrozen = false;
	export let isPlaying = false;

	$: activeQueue = (items || []).filter((i) => i.active);

	// Bloque con repetición suficiente para superar cualquier resolución
	$: loopBlock = (() => {
		if (activeQueue.length === 0) return [];
		let list = [...activeQueue];
		while (list.length < 16) {
			list = [...list, ...activeQueue];
		}
		return list;
	})();

	const SPEED = 85;

	let segmentEl;
	let segmentWidth = 1920;
	let animId = null;
	let lastTime = null;
	let offset = 0;
	let lastSignature = '';
	let isBreathing = false;

	$: activeSignature = activeQueue
		.map((i) => (i.id || i.text) + ':' + (i.active ? '1' : '0'))
		.join('|');

	function handleSignatureChange(sig, isVisible) {
		if (sig !== lastSignature && isVisible) {
			lastSignature = sig;
			triggerBreathingTransition();
		}
	}

	$: handleSignatureChange(activeSignature, visible);

	function triggerBreathingTransition() {
		isBreathing = true;
		setTimeout(() => {
			measureSegment();
			isBreathing = false;
		}, 260);
	}

	function measureSegment() {
		if (segmentEl) {
			const w = segmentEl.offsetWidth;
			if (w > 0) segmentWidth = w;
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

		measureSegment();

		if (isPlaying && !isFrozen && segmentWidth > 0) {
			offset -= SPEED * dt;
			if (offset <= -segmentWidth) {
				offset += segmentWidth;
			}
		}

		animId = requestAnimationFrame(updateConveyor);
	}

	onMount(() => {
		measureSegment();
		window.addEventListener('resize', measureSegment);
		animId = requestAnimationFrame(updateConveyor);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', measureSegment);
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
    transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  "
>
	<div
		class="flex-1 overflow-hidden relative ticker-mask min-w-0 h-full flex items-center transition-opacity duration-300 {isBreathing
			? 'opacity-0'
			: 'opacity-100'}"
	>
		{#if isFrozen}
			<div class="studio-marquee-segment flex items-center w-max h-full">
				{#each loopBlock as item, idx (`${item.id || item.text}-${idx}`)}
					<div class="flex items-center gap-3 pr-10 font-mono text-sm uppercase flex-shrink-0">
						{#if item.logoUrl}
							<div class="h-6 max-w-[100px] min-w-[28px] flex items-center justify-center shrink-0">
								<img
									src={item.logoUrl}
									alt=""
									class="h-6 max-w-[100px] w-auto object-contain shrink-0 smooth-logo bg-transparent"
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
			<!-- Carrusel continuo de doble segmento con costura exacta sin padding duplicado -->
			<div
				class="absolute top-0 bottom-0 flex items-center will-change-transform"
				style="transform: translate3d({offset}px, 0, 0);"
			>
				<!-- Segmento A -->
				<div bind:this={segmentEl} class="flex items-center shrink-0">
					{#each loopBlock as item, idx (`segA-${item.id || item.text}-${idx}`)}
						<div class="flex items-center gap-3 pr-10 font-mono text-sm uppercase flex-shrink-0">
							{#if item.logoUrl}
								<div class="h-6 max-w-[100px] min-w-[28px] flex items-center justify-center shrink-0">
									<img
										src={item.logoUrl}
										alt=""
										class="h-6 max-w-[100px] w-auto object-contain shrink-0 smooth-logo bg-transparent"
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

				<!-- Segmento B (gemelo contiguo con la misma separación de 40px) -->
				<div class="flex items-center shrink-0" aria-hidden="true">
					{#each loopBlock as item, idx (`segB-${item.id || item.text}-${idx}`)}
						<div class="flex items-center gap-3 pr-10 font-mono text-sm uppercase flex-shrink-0">
							{#if item.logoUrl}
								<div class="h-6 max-w-[100px] min-w-[28px] flex items-center justify-center shrink-0">
									<img
										src={item.logoUrl}
										alt=""
										class="h-6 max-w-[100px] w-auto object-contain shrink-0 smooth-logo bg-transparent"
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
			</div>
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
