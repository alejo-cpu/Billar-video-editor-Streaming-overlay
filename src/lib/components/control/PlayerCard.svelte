<script>
  import { matchStore } from '../../stores/matchStore.js';
  import { Pencil, Plus, Minus, UserCheck, ChevronDown, ChevronUp, Sparkles } from 'lucide-svelte';
  import ImageCropModal from './ImageCropModal.svelte';

  export let playerKey = 'p1';
  export let title = 'Jugador 1';

  $: player = $matchStore[playerKey];
  $: showAvatars = $matchStore.showAvatars;
  $: turns = $matchStore.turns;
  $: isTurn = turns.enabled && turns.active === playerKey;

  let isEditingName = false;
  let tempName = '';
  let showCropModal = false;
  let showEffectsMenu = false;

  function startNameEdit() {
    tempName = player.name;
    isEditingName = true;
  }

  function saveName() {
    if (tempName.trim()) {
      matchStore.setPlayerName(playerKey, tempName.trim());
    }
    isEditingName = false;
  }

  function handleSaveAvatar(e) {
    matchStore.setPlayerAvatar(playerKey, e.detail);
    showCropModal = false;
  }

  function trigger(effectName) {
    matchStore.sendEffect(effectName, playerKey);
  }
</script>

<div class="bg-[#10131c] border transition-all duration-300 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl relative overflow-hidden flex-1
  {isTurn ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-white/10'}"
>
  <!-- Cabecera -->
  <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
    <div class="flex items-center gap-2">
      <span class="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">{title}</span>
      {#if isTurn}
        <span class="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-black">
          <UserCheck size={11} /> EN TURNO
        </span>
      {/if}
    </div>

    <!-- Tronera L / R -->
    <div class="flex items-center gap-2">
      {#if turns.enabled && !isTurn}
        <button
          on:click={() => matchStore.setTurn(playerKey)}
          class="text-[10px] font-bold px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition active:scale-95"
        >
          Dar Turno
        </button>
      {/if}

      <select
        value={player.pocket}
        on:change={(e) => matchStore.setPocket(playerKey, e.target.value)}
        class="bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold rounded px-2 py-1 text-amber-400 outline-none cursor-pointer"
      >
        <option value="">Tronera: --</option>
        <option value="L">Tronera: L</option>
        <option value="R">Tronera: R</option>
      </select>
    </div>
  </div>

  <!-- Foto y Nombre -->
  <div class="flex flex-col items-center justify-center gap-2">
    {#if showAvatars}
      <button
        on:click={() => showCropModal = true}
        class="relative group rounded-full overflow-hidden w-20 h-20 sm:w-24 sm:h-24 ring-4 transition
          {isTurn ? 'ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'ring-neutral-700 shadow-md'}"
      >
        <img src={player.avatar} alt={player.name} class="w-full h-full object-cover" />
        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-bold text-white transition gap-1">
          <Pencil size={16} />
          <span>Cambiar</span>
        </div>
      </button>
    {/if}

    {#if isEditingName}
      <div class="flex items-center gap-2 mt-1">
        <input
          type="text"
          bind:value={tempName}
          on:keydown={(e) => e.key === 'Enter' && saveName()}
          class="bg-neutral-900 border border-amber-500 rounded px-2 py-1 text-sm font-bold text-white text-center uppercase outline-none"
        />
        <button on:click={saveName} class="px-2 py-1 bg-amber-500 text-black text-xs font-bold rounded">OK</button>
      </div>
    {:else}
      <button on:click={startNameEdit} class="flex items-center gap-2 group mt-1">
        <span class="text-lg sm:text-xl font-black tracking-wider text-white uppercase group-hover:text-amber-400 transition">{player.name}</span>
        <Pencil size={15} class="text-neutral-500 group-hover:text-amber-400 transition" />
      </button>
    {/if}
  </div>

  <!-- Contadores -->
  <div class="grid grid-cols-2 gap-3 sm:gap-4 bg-[#0a0c12] p-2.5 sm:p-3 rounded-xl border border-white/5">
    
    <!-- Bolas -->
    <div class="flex flex-col items-center gap-2">
      <span class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">BOLAS (0 - 8)</span>
      <span class="text-3xl font-black font-mono {isTurn ? 'text-amber-400' : 'text-white'}">{player.balls}</span>
      <div class="flex items-center gap-2 w-full">
        <button
          on:click={() => matchStore.adjustBalls(playerKey, -1)}
          class="flex-1 py-2.5 sm:py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl sm:rounded-lg flex items-center justify-center transition active:scale-90"
        >
          <Minus size={18} />
        </button>
        <button
          on:click={() => matchStore.adjustBalls(playerKey, 1)}
          class="flex-1 py-2.5 sm:py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl sm:rounded-lg flex items-center justify-center transition active:scale-90 shadow-md"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>

    <!-- Games -->
    <div class="flex flex-col items-center gap-2">
      <span class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">GAMES</span>
      <span class="text-3xl font-black font-mono text-neutral-200">{player.games}</span>
      <div class="flex items-center gap-2 w-full">
        <button
          on:click={() => matchStore.adjustGames(playerKey, -1)}
          class="flex-1 py-2.5 sm:py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl sm:rounded-lg flex items-center justify-center transition active:scale-90"
        >
          <Minus size={18} />
        </button>
        <button
          on:click={() => matchStore.adjustGames(playerKey, 1)}
          class="flex-1 py-2.5 sm:py-2 bg-neutral-700 hover:bg-neutral-600 text-white font-black rounded-xl sm:rounded-lg flex items-center justify-center transition active:scale-90 shadow-md"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>

  </div>

  <!-- SECCIÓN DESPLEGABLE CON REACCIONES EN VIVO -->
  <div class="border-t border-white/5 pt-2">
    <button
      on:click={() => showEffectsMenu = !showEffectsMenu}
      class="w-full py-2 sm:py-1.5 px-3 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 rounded-xl flex items-center justify-between text-xs font-bold text-neutral-300 transition"
    >
      <span class="flex items-center gap-2">
        <Sparkles size={14} class="text-amber-400" />
        <span>Reacciones en Vivo</span>
      </span>
      {#if showEffectsMenu}
        <ChevronUp size={16} />
      {:else}
        <ChevronDown size={16} />
      {/if}
    </button>

    {#if showEffectsMenu}
      <div class="grid grid-cols-4 gap-2 mt-2.5 p-2 bg-[#08090d] rounded-xl border border-white/5">
        
        <button
          on:click={() => trigger('confetti')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 hover:border-amber-400 text-2xl transition active:scale-90 shadow-sm"
          title="Confeti"
        >
          🎉
        </button>

        <button
          on:click={() => trigger('crown')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400 text-2xl transition active:scale-90 shadow-sm"
          title="Corona en el avatar"
        >
          👑
        </button>

        <button
          on:click={() => trigger('wink')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-yellow-400 text-2xl transition active:scale-90 shadow-sm"
          title="Guiño"
        >
          😉
        </button>

        <button
          on:click={() => trigger('sunglasses')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-400 text-2xl transition active:scale-90 shadow-sm"
          title="Fachero"
        >
          😎
        </button>

        <button
          on:click={() => trigger('fire')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-orange-500 text-2xl transition active:scale-90 shadow-sm"
          title="En Fuego"
        >
          🔥
        </button>

        <button
          on:click={() => trigger('clap')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-400 text-2xl transition active:scale-90 shadow-sm"
          title="Aplausos"
        >
          👏
        </button>

        <button
          on:click={() => trigger('ball8')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-purple-400 text-2xl transition active:scale-90 shadow-sm"
          title="Bola 8"
        >
          🎱
        </button>

        <button
          on:click={() => trigger('target')}
          class="h-12 flex items-center justify-center rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-teal-400 text-2xl transition active:scale-90 shadow-sm"
          title="Diana"
        >
          🎯
        </button>

      </div>
    {/if}
  </div>

  {#if showCropModal}
    <ImageCropModal initialImage={player.avatar} on:close={() => showCropModal = false} on:save={handleSaveAvatar} />
  {/if}
</div>
