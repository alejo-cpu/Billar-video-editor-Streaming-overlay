<script>
	import OverlayView from './lib/components/overlay/OverlayView.svelte';
	import ControlView from './lib/components/control/ControlView.svelte';
	import StudioView from './lib/components/studio/StudioView.svelte';

	const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	let currentView = params?.get('view') || 'overlay';
</script>

{#if currentView === 'control'}
	<ControlView />
{:else if currentView === 'studio'}
	<StudioView />
{:else}
	<OverlayView />
{/if}
