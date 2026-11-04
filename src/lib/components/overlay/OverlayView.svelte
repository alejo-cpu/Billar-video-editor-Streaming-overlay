<script>
	import { matchStore } from '../../stores/matchStore.js';
	import OnePocketScoreboard from './OnePocketScoreboard.svelte';
	import EightBallScoreboard from './EightBallScoreboard.svelte';
	import TickerMarquee from './TickerMarquee.svelte';
	import EffectsLayer from './EffectsLayer.svelte';

	$: modality = $matchStore.modality;
</script>

<main class="w-screen h-screen relative overflow-hidden bg-transparent select-none font-sans">
	{#if modality === 'BOLA 8'}
		<EightBallScoreboard />
	{:else}
		<OnePocketScoreboard />
	{/if}

	<EffectsLayer />
	<TickerMarquee />
</main>