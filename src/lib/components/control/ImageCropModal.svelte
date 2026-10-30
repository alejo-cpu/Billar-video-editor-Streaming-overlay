<script>
	import { createEventDispatcher } from 'svelte';
	import { X, ZoomIn, ZoomOut, Upload, Link, Check, RotateCcw } from 'lucide-svelte';

	export let initialImage = '';
	const dispatch = createEventDispatcher();

	const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

	let mode = 'file';
	let imageUrl = initialImage;
	let customUrl = '';
	let zoom = 1;
	let panX = 0;
	let panY = 0;
	let isDragging = false;
	let startX = 0;
	let startY = 0;

	let canvas;
	let imgElement;

	function handleFileSelect(e) {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				imageUrl = event.target.result;
				zoom = 1;
				panX = 0;
				panY = 0;
			};
			reader.readAsDataURL(file);
		}
	}

	function handleUrlApply() {
		if (customUrl.trim()) {
			imageUrl = customUrl.trim();
			zoom = 1;
			panX = 0;
			panY = 0;
		}
	}

	function onMouseDown(e) {
		isDragging = true;
		startX = e.clientX - panX;
		startY = e.clientY - panY;
	}

	function onMouseMove(e) {
		if (!isDragging) return;
		panX = Math.max(-100, Math.min(100, e.clientX - startX));
		panY = Math.max(-100, Math.min(100, e.clientY - startY));
	}

	function onMouseUp() {
		isDragging = false;
	}

	function onTouchStart(e) {
		if (e.touches && e.touches.length === 1) {
			isDragging = true;
			startX = e.touches[0].clientX - panX;
			startY = e.touches[0].clientY - panY;
		}
	}

	function onTouchMove(e) {
		if (!isDragging || !e.touches || e.touches.length !== 1) return;
		panX = Math.max(-100, Math.min(100, e.touches[0].clientX - startX));
		panY = Math.max(-100, Math.min(100, e.touches[0].clientY - startY));
	}

	function onTouchEnd() {
		isDragging = false;
	}

	function resetToDefault() {
		dispatch('save', DEFAULT_AVATAR);
	}

	function saveCrop() {
		try {
			const ctx = canvas.getContext('2d');
			canvas.width = 300;
			canvas.height = 300;

			ctx.clearRect(0, 0, 300, 300);
			ctx.save();
			ctx.beginPath();
			ctx.arc(150, 150, 150, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();

			if (imgElement && imgElement.complete) {
				const aspect = imgElement.naturalWidth / imgElement.naturalHeight;
				let drawW = 300 * zoom;
				let drawH = (300 / aspect) * zoom;
				let drawX = 150 - drawW / 2 + panX * 1.8;
				let drawY = 150 - drawH / 2 + panY * 1.8;

				ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);
			}
			ctx.restore();

			const croppedDataUrl = canvas.toDataURL('image/png');
			dispatch('save', croppedDataUrl);
		} catch (err) {
			dispatch('save', imageUrl);
		}
	}
</script>

<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
	<div
		class="bg-[#12151e] border border-white/20 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl flex flex-col gap-5"
	>
		<div class="flex items-center justify-between border-b border-white/10 pb-3">
			<h3 class="text-base font-bold tracking-wide">Editar Foto del Jugador</h3>
			<button
				on:click={() => dispatch('close')}
				class="text-neutral-400 hover:text-white transition"
			>
				<X size={20} />
			</button>
		</div>

		<div class="flex items-center gap-2 bg-[#090b10] p-1 rounded-lg">
			<button
				on:click={() => (mode = 'file')}
				class="flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition {mode ===
				'file'
					? 'bg-amber-500 text-black'
					: 'text-neutral-400 hover:text-white'}"
			>
				<Upload size={14} /> Subir archivo
			</button>
			<button
				on:click={() => (mode = 'url')}
				class="flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition {mode ===
				'url'
					? 'bg-amber-500 text-black'
					: 'text-neutral-400 hover:text-white'}"
			>
				<Link size={14} /> Pegar URL
			</button>
		</div>

		{#if mode === 'file'}
			<input
				type="file"
				accept="image/*"
				on:change={handleFileSelect}
				class="text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer"
			/>
		{:else}
			<div class="flex gap-2">
				<input
					type="text"
					bind:value={customUrl}
					placeholder="https://ejemplo.com/foto.png"
					class="flex-1 bg-[#090b10] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
				/>
				<button
					on:click={handleUrlApply}
					class="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg transition"
					>Cargar</button
				>
			</div>
		{/if}

		<div class="flex flex-col items-center justify-center my-2">
			<p class="text-[11px] text-neutral-400 mb-2">Arrastra con el ratón o dedo para reubicar</p>
			<div
				class="w-44 h-44 rounded-full border-2 border-amber-400 overflow-hidden relative bg-black cursor-grab active:cursor-grabbing select-none shadow-[0_0_15px_rgba(245,158,11,0.3)] touch-none"
				on:mousedown={onMouseDown}
				on:mousemove={onMouseMove}
				on:mouseup={onMouseUp}
				on:touchstart={onTouchStart}
				on:touchmove={onTouchMove}
				on:touchend={onTouchEnd}
			>
				<img
					bind:this={imgElement}
					src={imageUrl}
					crossorigin="anonymous"
					alt="Crop preview"
					class="absolute max-w-none pointer-events-none transition-transform duration-75"
					style="
            transform: translate(calc(-50% + {panX}px), calc(-50% + {panY}px)) scale({zoom});
            top: 50%;
            left: 50%;
            width: 176px;
          "
				/>
			</div>
		</div>

		<div class="flex items-center gap-3 px-2">
			<ZoomOut size={16} class="text-neutral-400" />
			<input
				type="range"
				min="0.8"
				max="2.5"
				step="0.05"
				bind:value={zoom}
				class="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
			/>
			<ZoomIn size={16} class="text-neutral-400" />
			<span class="text-xs font-mono text-neutral-400 w-10 text-right"
				>{Math.round(zoom * 100)}%</span
			>
		</div>

		<canvas bind:this={canvas} class="hidden"></canvas>

		<div class="flex items-center justify-between pt-3 border-t border-white/10 gap-2">
			<button
				type="button"
				on:click={resetToDefault}
				class="px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-rose-400 transition flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg"
				title="Quitar foto personalizada y usar avatar neutro"
			>
				<RotateCcw size={12} /> Quitar foto
			</button>

			<div class="flex items-center gap-2">
				<button
					on:click={() => dispatch('close')}
					class="px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-white transition"
					>Cancelar</button
				>
				<button
					on:click={saveCrop}
					class="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-lg flex items-center gap-1.5 transition shadow-lg active:scale-95"
				>
					<Check size={15} /> Guardar foto
				</button>
			</div>
		</div>
	</div>
</div>
