<script>
  import { fly } from 'svelte/transition';
  export let value;
  export let customClass = "text-base font-black text-[#fbc02d]";
</script>

<!-- CSS Grid con celda fija (1 / 1): evita que dos números existan en fila y empujen la caja a la derecha -->
<div class="relative overflow-hidden inline-grid place-items-center min-w-[1.2rem] h-5">
  {#key value}
    <span
      in:fly={{ y: -12, duration: 200 }}
      out:fly={{ y: 12, duration: 200 }}
      class="font-mono leading-none col-start-1 row-start-1 flex items-center justify-center text-center {customClass}"
    >
      {value}
    </span>
  {/key}
</div>
