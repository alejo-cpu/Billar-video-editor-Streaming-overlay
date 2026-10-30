<script>
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import {
		Trash2,
		Music,
		Clock,
		RefreshCw,
		Play,
		AlertCircle,
		Info,
		FolderOpen,
		Film,
		X,
		Sparkles
	} from 'lucide-svelte';

	export let showClearConfirmModal = false;
	export let showMusicInfoModal = false;
	export let showMissingVideoModal = false;
	export let suggestedVideoFolder = '';
	export let isUploadingForRender = false;
	export let renderProgress = { active: false, percent: 0, fps: 0, downloadUrl: null };
	export let renderErrorData = null;

	const dispatch = createEventDispatcher();
</script>

<!-- MODAL: CONFIRMAR BORRAR TODAS LAS MARCAS -->
{#if showClearConfirmModal}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="bg-[#12151e] border border-amber-500/40 rounded-2xl w-full max-w-sm p-6 text-white shadow-2xl flex flex-col gap-4 text-center items-center"
		>
			<div
				class="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400"
			>
				<Trash2 size={24} />
			</div>

			<div class="flex flex-col gap-1">
				<h3 class="text-sm font-bold uppercase font-mono tracking-wide text-white">
					¿Eliminar todas las marcas?
				</h3>
				<p class="text-xs text-neutral-300 leading-relaxed">
					Se borrarán todos los puntos, jugadas y estados de la cinta en este video. Puedes usar
					Deshacer (↶) para recuperarlas si te equivocas.
				</p>
			</div>

			<div class="flex items-center gap-2 w-full pt-1">
				<button
					on:click={() => dispatch('cancelClear')}
					class="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 font-bold rounded-xl text-xs transition"
				>
					Cancelar
				</button>
				<button
					on:click={() => dispatch('confirmClear')}
					class="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition shadow-md"
				>
					Sí, borrar todas
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: INFORMACIÓN DE MÚSICA -->
{#if showMusicInfoModal}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="bg-[#12151e] border border-amber-500/40 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-4"
		>
			<div class="flex items-center justify-between border-b border-white/10 pb-3">
				<div class="flex items-center gap-2">
					<Music size={18} class="text-amber-400" />
					<h3 class="text-sm font-bold uppercase font-mono tracking-wide">
						Guía de Música de Fondo
					</h3>
				</div>
				<button
					on:click={() => dispatch('closeMusicInfo')}
					class="text-neutral-400 hover:text-white"
				>
					<X size={18} />
				</button>
			</div>

			<div class="flex flex-col gap-3 text-xs text-neutral-300 leading-relaxed font-sans">
				<div class="bg-black/40 p-3 rounded-xl border border-white/5">
					<h4 class="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
						<Clock size={13} /> Rango Activo (Inicio y Fin)
					</h4>
					<p>
						Define el momento exacto donde la música empieza y termina. Entra con un Fade In de 3s y
						sale con un Fade Out de 3s.
					</p>
				</div>

				<div class="bg-black/40 p-3 rounded-xl border border-white/5">
					<h4 class="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
						<RefreshCw size={13} /> Bucle Playlist
					</h4>
					<p>
						Si está <strong>activado</strong>, la lista se repite para cubrir todo el rango. Si está
						<strong>desactivado</strong>, se corta al terminar las canciones.
					</p>
				</div>

				<div class="bg-black/40 p-3 rounded-xl border border-white/5">
					<h4 class="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
						<Play size={13} /> Muestra Rápida (6s)
					</h4>
					<p>
						Pausa el video momentáneamente y reproduce 6 segundos desde la mitad de la canción para
						reconocerla al instante.
					</p>
				</div>
			</div>

			<button
				on:click={() => dispatch('closeMusicInfo')}
				class="w-full py-2 bg-neutral-800 hover:bg-neutral-700 font-bold rounded-xl text-xs transition"
			>
				Entendido
			</button>
		</div>
	</div>
{/if}

<!-- MODAL: VIDEO NO LOCALIZADO -->
{#if showMissingVideoModal}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="bg-[#10131c] border border-amber-500/50 rounded-2xl w-full max-w-xl p-7 text-white shadow-2xl flex flex-col gap-5 text-center items-center"
		>
			<AlertCircle size={44} class="text-amber-400" />

			<div class="flex flex-col gap-1.5">
				<h3 class="text-base sm:text-lg font-black tracking-wide uppercase font-mono text-white">
					Video no localizado
				</h3>
				<p class="text-xs sm:text-sm text-neutral-300">
					No encontramos el video de esta partida. Puedes seleccionarlo ahora o moverlo a la carpeta
					del proyecto para que abra siempre solo.
				</p>
			</div>

			{#if suggestedVideoFolder}
				<div class="bg-black/50 border border-white/10 rounded-xl p-3.5 text-left w-full text-xs">
					<span class="text-amber-400 font-bold flex items-center gap-1.5 mb-1 text-xs">
						<Info size={14} /> Recomendación (Opcional):
					</span>
					<p class="text-neutral-400 text-xs leading-relaxed">
						Si quieres que el video abra automáticamente en el futuro sin tener que seleccionarlo,
						colócalo en:
					</p>
					<div
						class="bg-neutral-900 border border-neutral-700 p-2 rounded mt-1.5 font-mono text-xs text-amber-300 break-all select-all font-bold"
					>
						{suggestedVideoFolder}
					</div>
				</div>
			{/if}

			<div class="flex items-center gap-3 w-full justify-center pt-2">
				<button
					on:click={() => dispatch('relink')}
					class="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-sm font-black rounded-xl shadow-lg transition active:scale-95 flex items-center gap-2"
				>
					<FolderOpen size={18} /> Seleccionar Video en mi equipo
				</button>
				<button
					on:click={() => dispatch('closeMissingVideo')}
					class="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-bold rounded-xl transition"
				>
					Omitir por ahora
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL: PROGRESO DE RENDERIZADO -->
{#if renderProgress.active || isUploadingForRender}
	<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
		<div
			class="bg-[#10131c] border border-white/20 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-4"
		>
			<div class="flex items-center justify-between border-b border-white/10 pb-3">
				<div class="flex items-center gap-3">
					<Film size={22} class="text-amber-400 animate-pulse" />
					<h3 class="text-sm font-bold tracking-wide uppercase font-mono">
						{isUploadingForRender
							? 'Preparando pistas y video...'
							: 'Exportando con FFmpeg (Alta Definición)'}
					</h3>
				</div>
				<button
					on:click={() => dispatch('cancelRender')}
					class="px-3 py-1.5 bg-neutral-800 hover:bg-rose-600/90 border border-neutral-700 text-xs font-bold rounded-lg transition flex items-center gap-1 text-neutral-300 hover:text-white"
				>
					<X size={14} /> Cancelar
				</button>
			</div>

			{#if !isUploadingForRender}
				<div class="flex flex-col gap-1.5">
					<div class="h-2 bg-neutral-800 rounded-full overflow-hidden">
						<div
							class="h-full bg-amber-400 transition-all duration-300"
							style="width: {renderProgress.percent}%"
						></div>
					</div>
					<div class="flex items-center justify-between text-xs font-mono text-neutral-400">
						<span>{renderProgress.percent}% completado</span>
						<span>{renderProgress.fps} FPS</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- MODAL: ERROR DE RENDERIZADO -->
{#if renderErrorData}
	<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
		<div
			class="bg-[#10131c] border border-rose-500/50 rounded-2xl w-full max-w-lg p-6 text-white shadow-2xl flex flex-col gap-4"
		>
			<div class="flex items-center justify-between border-b border-white/10 pb-3">
				<div class="flex items-center gap-2.5">
					<AlertCircle size={22} class="text-rose-400" />
					<h3 class="text-sm font-bold tracking-wide uppercase font-mono text-rose-300">
						{renderErrorData.title || 'Error en la exportación'}
					</h3>
				</div>
				<button on:click={() => dispatch('closeError')} class="text-neutral-400 hover:text-white">
					<X size={18} />
				</button>
			</div>

			<p class="text-xs text-neutral-200 leading-relaxed">
				{renderErrorData.description}
			</p>

			{#if renderErrorData.solution}
				<div
					class="bg-black/50 border border-rose-500/30 rounded-xl p-3 text-xs flex flex-col gap-1"
				>
					<span class="text-amber-400 font-bold flex items-center gap-1">
						<Info size={13} /> Solución recomendada:
					</span>
					<p class="text-neutral-300 leading-normal">{renderErrorData.solution}</p>
				</div>
			{/if}

			<button
				on:click={() => dispatch('closeError')}
				class="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-xl transition mt-2"
			>
				Entendido
			</button>
		</div>
	</div>
{/if}

<!-- MODAL: DESCARGA COMPLETADA -->
{#if renderProgress.downloadUrl}
	<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
		<div
			class="relative bg-[#10131c] border border-amber-500/50 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-4 text-center items-center"
		>
			<button
				on:click={() => dispatch('closeDownload')}
				class="absolute top-4 right-4 text-neutral-400 hover:text-white"
			>
				<X size={20} />
			</button>
			<Sparkles size={32} class="text-amber-400" />
			<h3 class="text-base font-bold uppercase font-mono">¡Video Terminado con Éxito!</h3>
			<p class="text-xs text-neutral-300">
				El archivo quedó listo con el marcador Retina, la cinta continua sin cortes y el audio
				sincronizado.
			</p>

			<div class="flex items-center gap-3 w-full justify-center pt-2">
				<a
					href={renderProgress.downloadUrl}
					download="partida_final_con_marcador.mp4"
					class="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl shadow-lg transition active:scale-95"
				>
					Descargar Video MP4
				</a>
				<button
					on:click={() => dispatch('closeDownload')}
					class="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-white/10 transition"
				>
					Seguir Editando
				</button>
			</div>
		</div>
	</div>
{/if}
