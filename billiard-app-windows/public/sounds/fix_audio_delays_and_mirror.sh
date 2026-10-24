#!/usr/bin/env bash
set -e

echo "🎨 Espejando emojis izquierdos y sincronizando retardos y volúmenes de audio..."

cat << 'SVELTE' > src/lib/components/overlay/EffectsLayer.svelte
<script>
  import confetti from 'canvas-confetti';
  import { liveEffect } from '../../stores/matchStore.js';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let alertsP1 = [];
  let alertsP2 = [];

  const LOCAL_STICKERS = {
    wink: '/stickers/wink.webp',
    sunglasses: '/stickers/sunglasses.webp',
    fire: '/stickers/fire.webp',
    crown: '/stickers/crown.webp',
    clap: '/stickers/clap.webp',
    ball8: '/stickers/ball8.webp',
    mindblown: '/stickers/mindblown.webp',
    target: '/stickers/target.webp'
  };

  const SOUND_FILES = {
    wink: '/sounds/wink.mp3',
    fire: '/sounds/fire.mp3',
    sunglasses: '/sounds/sunglasses.mp3',
    target: '/sounds/target.mp3',
    confetti: '/sounds/confetti.mp3',
    clap: '/sounds/clap.mp3',
    ball8: '/sounds/ball8.mp3',
    crown: '/sounds/crown.mp3'
  };

  // CONFIGURACIÓN EXACTA DE VOLÚMENES Y RETARDOS DE SINCRONIZACIÓN
  const AUDIO_CONFIG = {
    wink: { delay: 300, volume: 0.35 },                   // Entra 300ms tarde para calzar con el guiño
    target: { delay: 100, volume: 0.35 },                 // Entra 100ms tarde para calzar con el impacto
    clap: { delay: 0, volume: 0.20, fadeAfter: 2600 },    // Volumen más suave (0.20)
    crown: { delay: 0, volume: 0.20 },                   // Volumen más bajo (0.20)
    fire: { delay: 0, volume: 0.30, fadeAfter: 1800 },
    sunglasses: { delay: 0, volume: 0.35 },
    confetti: { delay: 0, volume: 0.35 },
    ball8: { delay: 0, volume: 0.35 }
  };

  function playSound(effect) {
    const cfg = AUDIO_CONFIG[effect] || { delay: 0, volume: 0.35 };
    const src = SOUND_FILES[effect];
    if (!src) return;

    // Retardo milimétrico para sincronizar sonido con el movimiento del sticker
    setTimeout(() => {
      try {
        const audio = new Audio(src);
        audio.volume = cfg.volume;
        audio.play().catch(() => {});

        // Fade suave para aplausos y fuego
        if (cfg.fadeAfter) {
          setTimeout(() => {
            const fadeTimer = setInterval(() => {
              if (audio.volume > 0.03) {
                audio.volume = Math.max(0, audio.volume - 0.03);
              } else {
                audio.pause();
                clearInterval(fadeTimer);
              }
            }, 50);
          }, cfg.fadeAfter);
        }
      } catch (e) {}
    }, cfg.delay);
  }

  $: if ($liveEffect) {
    handleTrigger($liveEffect);
  }

  function handleTrigger(data) {
    if (!data) return;

    playSound(data.effect);

    if (data.effect === 'confetti') {
      const isP1 = data.playerKey === 'p1';
      confetti({
        particleCount: 100,
        angle: isP1 ? 52 : 128,
        spread: 75,
        startVelocity: 55,
        gravity: 1.25,
        origin: { x: isP1 ? -0.04 : 1.04, y: 0.92 },
        colors: ['#f59e0b', '#fbbf24', '#ffffff', '#10b981', '#3b82f6'],
        ticks: 95,
        decay: 0.92
      });
      return;
    }

    const pKey = data.playerKey || 'p1';
    const alertId = Date.now() + Math.random();
    const alertItem = {
      id: alertId,
      imgUrl: `${LOCAL_STICKERS[data.effect] || LOCAL_STICKERS.wink}?v=${alertId}`
    };

    if (pKey === 'p1') {
      alertsP1 = [alertItem];
    } else {
      alertsP2 = [alertItem];
    }

    setTimeout(() => {
      if (pKey === 'p1') {
        alertsP1 = alertsP1.filter(a => a.id !== alertId);
      } else {
        alertsP2 = alertsP2.filter(a => a.id !== alertId);
      }
    }, 1850);
  }
</script>

<div class="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
  
  <!-- JUGADOR 1 (Izquierda: ESPEJADO CON scale-x-[-1] para mirar hacia adentro de la mesa) -->
  <div class="fixed bottom-20 left-8 flex flex-col items-start pointer-events-none">
    {#each alertsP1 as alert (alert.id)}
      <div
        transition:fly={{ x: -140, duration: 400, easing: cubicOut }}
        class="w-28 h-28 flex items-center justify-center filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] scale-x-[-1]"
      >
        <img
          src={alert.imgUrl}
          alt=""
          class="w-full h-full object-contain pointer-events-none"
        />
      </div>
    {/each}
  </div>

  <!-- JUGADOR 2 (Derecha: Normal, mirando hacia adentro) -->
  <div class="fixed bottom-20 right-8 flex flex-col items-end pointer-events-none">
    {#each alertsP2 as alert (alert.id)}
      <div
        transition:fly={{ x: 140, duration: 400, easing: cubicOut }}
        class="w-28 h-28 flex items-center justify-center filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]"
      >
        <img
          src={alert.imgUrl}
          alt=""
          class="w-full h-full object-contain pointer-events-none"
        />
      </div>
    {/each}
  </div>

</div>
SVELTE

rm -f fix_audio_delays_and_mirror.sh
echo "✨ Sincronización milimétrica, volúmenes suaves y espejo izquierdo completados!"
