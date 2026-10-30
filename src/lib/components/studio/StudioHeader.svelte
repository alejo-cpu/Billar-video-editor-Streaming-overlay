<script>
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Folder, Save, FileVideo, FolderX, Download, Film } from 'lucide-svelte';

	export let projectName = '';
	export let isDirty = false;
	export let saveFeedbackMessage = '';
	export let videoUrl = null;

	const dispatch = createEventDispatcher();
</script>

<header
	class="h-14 border-b border-white/10 px-4 sm:px-6 relative flex items-center justify-between shrink-0 bg-[#090b11]/90 backdrop-blur-md z-30 shadow-md"
>
	<!-- Bloque Izquierdo: Logo propio limpio sin fondos negros -->
	<div class="flex items-center gap-3 min-w-0 z-10">
		<img
			src="/logo.webp"
			alt="HDP"
			class="h-9 w-auto object-contain shrink-0 bg-transparent"
			on:error={(e) => {
				e.currentTarget.style.display = 'none';
				e.currentTarget.nextElementSibling.style.display = 'flex';
			}}
		/>
		<div
			class="hidden w-8 h-8 rounded-lg items-center justify-center bg-amber-500/10 text-amber-400 shrink-0"
		>
			<Film size={18} />
		</div>

		<div class="flex items-center gap-2 min-w-0">
			<span class="text-xs font-black tracking-wider uppercase font-mono text-white shrink-0"
				>HDP STUDIO</span
			>
			{#if projectName}
				<span
					class="text-[11px] font-mono font-bold text-amber-400 truncate max-w-[150px] md:max-w-[200px]"
					title={projectName}
				>
					• {projectName}
				</span>
			{/if}
		</div>
	</div>

	<!-- Bloque Central: Cápsula de Proyecto CENTRADA DE FORMA ABSOLUTA -->
	<div
		class="absolute left-1/2 -translate-x-1/2 bg-[#11141e]/90 border border-white/10 rounded-xl p-1 flex items-center gap-1 shadow-inner z-20"
	>
		<button
			on:click={() => dispatch('open')}
			class="px-2.5 py-1 hover:bg-white/10 text-xs font-bold rounded-lg transition flex items-center gap-1.5 text-neutral-300 hover:text-white"
			title="Abrir un archivo .billiard"
		>
			<Folder size={13} class="text-amber-400" />
			<span class="hidden sm:inline">Abrir</span>
		</button>

		<button
			on:click={() => dispatch('save')}
			class="px-2.5 py-1 hover:bg-white/10 text-xs font-bold rounded-lg transition flex items-center gap-1.5 text-neutral-300 hover:text-white"
			title="Guardar archivo .billiard"
		>
			<Save size={13} class={isDirty ? 'text-amber-400' : 'text-emerald-400'} />
			<span class="hidden sm:inline">Guardar</span>
			{#if isDirty}
				<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
			{/if}
		</button>

		{#if videoUrl}
			<button
				on:click={() => dispatch('relink')}
				class="px-2.5 py-1 hover:bg-white/10 text-xs font-bold rounded-lg transition flex items-center gap-1.5 text-neutral-300 hover:text-white"
				title="Cambiar video de la partida"
			>
				<FileVideo size={13} class="text-blue-400" />
				<span class="hidden md:inline">Video</span>
			</button>
		{/if}

		<div class="w-[1px] h-3.5 bg-white/15 mx-0.5"></div>

		<button
			on:click={() => dispatch('close')}
			class="px-2 py-1 hover:bg-rose-950/50 hover:text-rose-400 text-xs font-bold rounded-lg transition flex items-center gap-1 text-neutral-400"
			title="Cerrar partida actual"
		>
			<FolderX size={13} />
			<span class="hidden md:inline">Cerrar</span>
		</button>
	</div>

	<!-- Bloque Derecho: Mensaje con espacio holgado sin cortes -->
	<div class="flex items-center gap-3 z-10 flex-1 justify-end">
		{#if saveFeedbackMessage}
			<span
				transition:fade={{ duration: 200 }}
				class="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap text-right hidden sm:inline"
			>
				{saveFeedbackMessage}
			</span>
		{:else if isDirty}
			<span class="text-[11px] font-mono text-amber-400 items-center gap-1 hidden xl:flex">
				<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Sin guardar
			</span>
		{/if}

		<a
			href="?view=control"
			class="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold rounded-lg border border-white/10 transition text-neutral-300 shrink-0"
		>
			Directo
		</a>

		{#if videoUrl}
			<button
				on:click={() => dispatch('render')}
				class="px-3.5 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-black text-xs font-black rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)] transition active:scale-95 shrink-0"
			>
				<Download size={14} /> <span>Renderizar</span>
			</button>
		{/if}
	</div>
</header>
