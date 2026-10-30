<script>
	import OnePocketScoreboard from './OnePocketScoreboard.svelte';
	import TickerMarquee from './TickerMarquee.svelte';
	import EffectsLayer from './EffectsLayer.svelte';
</script>

<main class="w-screen h-screen relative overflow-hidden bg-transparent select-none font-sans">
	<OnePocketScoreboard />
	<EffectsLayer />
	<TickerMarquee />
</main>
