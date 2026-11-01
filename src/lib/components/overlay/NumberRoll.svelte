<script>
	import { fly } from 'svelte/transition';
	export let value;
	export let customClass = 'text-base font-black text-[#fbc02d]';

	let prevValue = value;
	let direction = 1;

	function updateRoll(val) {
		if (val !== prevValue) {
			direction = val > prevValue ? 1 : -1;
			prevValue = val;
		}
	}

	$: updateRoll(value);
</script>

<div
	class="relative overflow-hidden inline-grid place-items-center min-w-[1.4rem] h-[1.3em] leading-none"
>
	{#key value}
		<span
			in:fly={{ y: -12 * direction, duration: 200 }}
			out:fly={{ y: 12 * direction, duration: 200 }}
			class="font-mono leading-none col-start-1 row-start-1 flex items-center justify-center text-center {customClass}"
		>
			{value}
		</span>
	{/key}
</div>
