<script>
	import { matchStore } from '../../stores/matchStore.js';
	import { Plus, Trash2, Eye, EyeOff, RefreshCw, Image as ImageIcon } from 'lucide-svelte';

	$: ticker = $matchStore?.ticker || { visible: true, items: [] };

	let stagedItems = [];
	let isInitialized = false;

	$: if (!isInitialized && $matchStore?.ticker?.items) {
		stagedItems = JSON.parse(JSON.stringify($matchStore.ticker.items));
		isInitialized = true;
	}

	let newItemText = '';
	let newItemLogo = '';
	let newItemType = 'sponsor';
	let logoInputMode = 'file';

	function handleLogoFile(e) {
		const file = e.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (event) => {
				newItemLogo = event.target.result;
			};
			reader.readAsDataURL(file);
		}
	}

	function addItem() {
		if (newItemText.trim()) {
			stagedItems = [
				...stagedItems,
				{
					id: Date.now(),
					type: newItemType,
					text: newItemText.trim().toUpperCase(),
					logoUrl: newItemLogo.trim(),
					active: true
				}
			];
			newItemText = '';
			newItemLogo = '';
		}
	}

	function removeItem(id) {
		stagedItems = stagedItems.filter((i) => i.id !== id);
	}

	function toggleActive(id) {
		stagedItems = stagedItems.map((i) => (i.id === id ? { ...i, active: !i.active } : i));
	}

	function applyChanges() {
		matchStore.applyTickerItemsImmediately(stagedItems);
	}
</script>

<div
	class="bg-[#10131c] border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl"
>
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-3"
	>
		<div>
			<h3 class="text-xs sm:text-sm font-bold text-white tracking-wide uppercase font-mono">
				Gestor de Marcas y Avisos
			</h3>
			<p class="text-[10px] sm:text-[11px] text-neutral-400">
				Los cambios se aplican al pulsar "Aplicar Cambios"
			</p>
		</div>
		<div class="flex items-center gap-2 sm:gap-3">
			<button
				on:click={() => matchStore.toggleTickerVisible()}
				class="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition {ticker.visible
					? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
					: 'border-neutral-700 bg-neutral-900 text-neutral-400'}"
			>
				{#if ticker.visible}
					<Eye size={14} /> Visible
				{:else}
					<EyeOff size={14} /> Oculta
				{/if}
			</button>

			<button
				on:click={applyChanges}
				class="px-3 sm:px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-lg flex items-center gap-1.5 shadow-md transition active:scale-95"
			>
				<RefreshCw size={14} /> Aplicar
			</button>
		</div>
	</div>

	<div class="flex flex-col gap-2.5 bg-[#090b10] p-3 rounded-xl border border-white/5">
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
			<select
				bind:value={newItemType}
				class="bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2.5 py-2 outline-none font-bold cursor-pointer"
			>
				<option value="sponsor">Sponsor</option>
				<option value="aviso">Aviso</option>
				<option value="advertencia">Advertencia</option>
				<option value="mensaje">Mensaje</option>
			</select>

			<input
				type="text"
				bind:value={newItemText}
				on:keydown={(e) => e.key === 'Enter' && addItem()}
				placeholder="Texto de la marca o mensaje..."
				class="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white px-3 py-2 outline-none font-mono focus:border-amber-500"
			/>

			<button
				on:click={addItem}
				class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
			>
				<Plus size={15} /> Añadir
			</button>
		</div>

		<div class="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pt-1 border-t border-white/5">
			<span class="text-neutral-400 flex items-center gap-1 text-[11px]"
				><ImageIcon size={13} /> Logo:</span
			>

			<div class="flex items-center gap-1.5">
				<button
					type="button"
					on:click={() => (logoInputMode = 'file')}
					class="text-[10px] px-2 py-0.5 rounded {logoInputMode === 'file'
						? 'bg-neutral-700 text-white font-bold'
						: 'text-neutral-400'}"
				>
					Archivo
				</button>
				<button
					type="button"
					on:click={() => (logoInputMode = 'url')}
					class="text-[10px] px-2 py-0.5 rounded {logoInputMode === 'url'
						? 'bg-neutral-700 text-white font-bold'
						: 'text-neutral-400'}"
				>
					URL
				</button>
			</div>

			{#if logoInputMode === 'file'}
				<input
					type="file"
					accept="image/*"
					on:change={handleLogoFile}
					class="text-[11px] text-neutral-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-neutral-800 file:text-white cursor-pointer"
				/>
			{:else}
				<input
					type="text"
					bind:value={newItemLogo}
					placeholder="https://ejemplo.com/logo.png"
					class="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-xs text-white outline-none font-mono min-w-[140px]"
				/>
			{/if}

			{#if newItemLogo}
				<div class="flex items-center gap-1.5 bg-neutral-800 px-2 py-0.5 rounded">
					<img src={newItemLogo} alt="preview" class="h-4 w-6 object-contain" />
					<span class="text-[10px] text-emerald-400 font-bold">Cargado</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
		{#each stagedItems as item (item.id)}
			<div
				class="flex items-center justify-between p-2 rounded-lg border {item.active
					? 'bg-neutral-900/80 border-white/10'
					: 'bg-neutral-950/40 border-neutral-800 opacity-50'} transition"
			>
				<div class="flex items-center gap-2 overflow-hidden">
					{#if item.logoUrl}
						<img
							src={item.logoUrl}
							alt="logo"
							class="h-5 w-7 object-contain bg-black/50 rounded p-0.5 shrink-0"
						/>
					{/if}
					<span
						class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 {item.type ===
						'sponsor'
							? 'bg-amber-950 text-amber-400 border border-amber-500/40'
							: item.type === 'aviso'
								? 'bg-blue-950 text-blue-400 border border-blue-500/40'
								: 'bg-neutral-800 text-neutral-400'}"
					>
						{item.type}
					</span>
					<span
						class="text-xs font-mono font-bold text-white truncate max-w-[140px] sm:max-w-[160px]"
						>{item.text}</span
					>
				</div>
				<div class="flex items-center gap-1 shrink-0">
					<button
						on:click={() => toggleActive(item.id)}
						class="p-1 hover:text-white text-neutral-400 transition"
					>
						{#if item.active}<Eye size={15} />{:else}<EyeOff size={15} />{/if}
					</button>
					<button
						on:click={() => removeItem(item.id)}
						class="p-1 hover:text-rose-400 text-neutral-500 transition"
					>
						<Trash2 size={15} />
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>
