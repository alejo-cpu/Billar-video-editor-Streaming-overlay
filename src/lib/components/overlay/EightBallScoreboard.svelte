<script>
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { matchStore } from '../../stores/matchStore.js';
	import NumberRoll from './NumberRoll.svelte';

	$: p1 = $matchStore.p1;
	$: p2 = $matchStore.p2;
	$: showAvatars = $matchStore.showAvatars;
	$: turns = $matchStore.turns;
	$: modality = $matchStore.modality || 'BOLA 8';
	$: race = $matchStore.race || 'RACE TO 3';
	$: timer = $matchStore.timer;
	$: hudScale = $matchStore.uiScale?.hud || 1.0;

	$: isP1Active = turns.enabled && turns.active === 'p1';
	$: isP2Active = turns.enabled && turns.active === 'p2';

	// Umbrales de longitud de nombres (Intactos)
	$: maxNameLength = Math.max((p1.name || '').trim().length, (p2.name || '').trim().length);
	$: isShortMode = maxNameLength <= 6;
	$: isLongMode = maxNameLength >= 21;

	// Anchos de Bola 8 (Intactos)
	$: hudWidthClass = showAvatars
		? isShortMode
			? 'w-[790px]'
			: isLongMode
				? 'w-[900px]'
				: 'w-[820px]'
		: isShortMode
			? 'w-[680px]'
			: isLongMode
				? 'w-[800px]'
				: 'w-[730px]';

	$: timerWidthClass = showAvatars
		? isShortMode
			? 'w-[590px]'
			: isLongMode
				? 'w-[700px]'
				: 'w-[620px]'
		: isShortMode
			? 'w-[480px]'
			: isLongMode
				? 'w-[600px]'
				: 'w-[530px]';

	// Reloj de tiro
	$: timerRatio = timer.maxSeconds > 0 ? Math.max(0, timer.seconds / timer.maxSeconds) : 0;
	$: isTimerEmergency = timer.enabled && timer.running && timerRatio <= 0.15 && timerRatio > 0;
	$: isTimerLow = timer.enabled && timer.running && !isTimerEmergency && timerRatio <= 0.3 && timerRatio > 0;

	const BALL_COLORS = {
		1: '#eab308',
		2: '#2563eb',
		3: '#dc2626',
		4: '#7c3aed',
		5: '#ea580c',
		6: '#16a34a',
		7: '#881337',
		9: '#eab308',
		10: '#2563eb',
		11: '#dc2626',
		12: '#7c3aed',
		13: '#ea580c',
		14: '#16a34a',
		15: '#881337'
	};

	function getPlayerBallList(group) {
		if (group === 'stripes') return [9, 10, 11, 12, 13, 14, 15];
		if (group === 'solids') return [1, 2, 3, 4, 5, 6, 7];
		return [];
	}

	function getCascadeDelay(playerKey, index) {
		if (playerKey === 'p1') {
			return (6 - index) * 55;
		}
		return index * 55;
	}
</script>

<header
	class="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center select-none font-sans transition-all duration-[850ms] ease-out"
	style="transform: translateX(-50%) scale({hudScale}); transform-origin: top center;"
>
	<div
		class="{hudWidthClass} border-t border-x border-white/20 px-6 py-2.5 text-white transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_8px_20px_rgba(0,0,0,0.85)]"
		style="clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 16px 100%); background: linear-gradient(180deg, #10131a 0%, #08090d 100%);"
	>
		<div class="grid grid-cols-[1fr_auto_1fr] items-center w-full">
			<!-- ==================== JUGADOR 1 ==================== -->
			<div class="flex items-center justify-end w-full min-w-0 pl-3 pr-3 gap-3 h-[54px] overflow-visible">
				<div class="flex-1 min-w-0 h-full flex flex-col items-center justify-center relative overflow-visible">
					<!-- Nombre elevado -->
					<div
						class="w-full flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
						style="transform: translateY({p1.group === 'open' ? '0px' : '-17px'});"
					>
						<span
							class="text-sm font-extrabold tracking-wider uppercase truncate text-center w-full px-1 transition-all duration-300
              {!showAvatars && turns.enabled
								? isP1Active
									? 'text-[#fbc02d] drop-shadow-[0_0_10px_rgba(251,191,36,0.65)] scale-[1.04]'
									: 'text-neutral-400 opacity-70 scale-100'
								: 'text-white'}"
							title={p1.name}
						>
							{p1.name}
						</span>
					</div>

					<!-- Fila de bolas: animacion de ola original con retraso escalonado -->
					{#if p1.group !== 'open'}
						<div
							out:scale={{ duration: 260, start: 0.88, opacity: 0, easing: cubicOut }}
							class="flex items-center justify-center {isLongMode ? 'gap-2' : 'gap-1.5'} w-full absolute bottom-0.5 overflow-visible"
						>
							{#key p1.group}
								{#each getPlayerBallList(p1.group) as ballNum, i (ballNum)}
									{@const isAlive = (p1.ballsRemaining || []).includes(ballNum)}
									<div
										class="w-[26px] h-[26px] rounded-full border border-white/10 bg-black/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] flex items-center justify-center relative shrink-0 overflow-visible"
									>
										{#if isAlive}
											<div
												out:scale={{ duration: 180, start: 1.18, opacity: 0, easing: cubicOut }}
												class="ball-wave-item absolute inset-0 rounded-full flex items-center justify-center shadow-[0_3px_6px_rgba(0,0,0,0.9)] overflow-hidden"
												style="
                          animation-delay: {getCascadeDelay('p1', i)}ms;
                          background: {ballNum <= 7 ? BALL_COLORS[ballNum] : '#ffffff'};
                        "
											>
												{#if ballNum > 7}
													<div
														class="absolute inset-x-0 h-3"
														style="background: {BALL_COLORS[ballNum]};"
													></div>
												{/if}

												<div
													class="w-3 h-3 rounded-full bg-white flex items-center justify-center z-10 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
												>
													<span class="text-[8.5px] font-mono font-black text-black leading-none">
														{ballNum}
													</span>
												</div>

												<!-- Reflejo 3D con contraste original restaurado -->
												<div
													class="absolute inset-0 rounded-full z-20 pointer-events-none"
													style="background: radial-gradient(circle at 35% 25%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.55) 100%);"
												></div>
											</div>
										{/if}
									</div>
								{/each}
							{/key}
						</div>
					{/if}
				</div>

				<!-- Avatar Jugador 1: animación de ancho a 850ms -->
				<div
					class="transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center shrink-0 overflow-visible
          {showAvatars ? 'w-11 opacity-100 scale-100' : 'w-0 opacity-0 scale-50 pointer-events-none overflow-hidden'}"
				>
					<div class="relative w-10 h-10 flex items-center justify-center shrink-0">
						<img
							alt={p1.name}
							class="w-10 h-10 rounded-full object-cover bg-neutral-900 transition-all duration-300 shrink-0
              {isP1Active
								? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
								: 'ring-1 ring-white/20'}"
							src={p1.avatar}
						/>
					</div>
				</div>
			</div>

			<!-- ==================== CENTRO ==================== -->
			<div class="flex items-center justify-center shrink-0 px-4 border-x border-white/15 my-auto">
				<div class="w-[110px] flex flex-col items-center justify-center py-0.5">
					<div
						class="text-[9px] font-black text-[#e5a01d] tracking-[0.18em] font-mono leading-tight uppercase text-center truncate max-w-full"
					>
						{modality}
					</div>
					<div
						class="text-[7.5px] font-bold text-[#e5a01d] tracking-[0.14em] font-mono leading-tight uppercase mt-0.5 text-center truncate max-w-full"
					>
						{race}
					</div>

					<div class="flex items-center gap-1.5 font-mono my-0.5 leading-none">
						<NumberRoll value={p1.games} customClass="text-2xl font-black text-[#fbc02d]" />
						<span class="text-lg font-bold text-neutral-500 leading-none pb-0.5">:</span>
						<NumberRoll value={p2.games} customClass="text-2xl font-black text-[#fbc02d]" />
					</div>

					<div
						class="text-[7.5px] font-bold text-neutral-400 tracking-[0.16em] font-mono leading-tight uppercase"
					>
						GAMES
					</div>
				</div>
			</div>

			<!-- ==================== JUGADOR 2 ==================== -->
			<div class="flex items-center justify-start w-full min-w-0 pl-3 pr-3 gap-3 h-[54px] overflow-visible">
				<!-- Avatar Jugador 2: animación de ancho a 850ms -->
				<div
					class="transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center justify-center shrink-0 overflow-visible
          {showAvatars ? 'w-11 opacity-100 scale-100' : 'w-0 opacity-0 scale-50 pointer-events-none overflow-hidden'}"
				>
					<div class="relative w-10 h-10 flex items-center justify-center shrink-0">
						<img
							alt={p2.name}
							class="w-10 h-10 rounded-full object-cover bg-neutral-900 transition-all duration-300 shrink-0
              {isP2Active
								? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
								: 'ring-1 ring-white/20'}"
							src={p2.avatar}
						/>
					</div>
				</div>

				<div class="flex-1 min-w-0 h-full flex flex-col items-center justify-center relative overflow-visible">
					<!-- Nombre elevado hacia el espacio superior -->
					<div
						class="w-full flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
						style="transform: translateY({p2.group === 'open' ? '0px' : '-17px'});"
					>
						<span
							class="text-sm font-extrabold tracking-wider uppercase truncate text-center w-full px-1 transition-all duration-300
              {!showAvatars && turns.enabled
								? isP2Active
									? 'text-[#fbc02d] drop-shadow-[0_0_10px_rgba(251,191,36,0.65)] scale-[1.04]'
									: 'text-neutral-400 opacity-70 scale-100'
								: 'text-white'}"
							title={p2.name}
						>
							{p2.name}
						</span>
					</div>

					<!-- Fila de bolas: animacion de ola original con retraso escalonado -->
					{#if p2.group !== 'open'}
						<div
							out:scale={{ duration: 260, start: 0.88, opacity: 0, easing: cubicOut }}
							class="flex items-center justify-center {isLongMode ? 'gap-2' : 'gap-1.5'} w-full absolute bottom-0.5 overflow-visible"
						>
							{#key p2.group}
								{#each getPlayerBallList(p2.group) as ballNum, i (ballNum)}
									{@const isAlive = (p2.ballsRemaining || []).includes(ballNum)}
									<div
										class="w-[26px] h-[26px] rounded-full border border-white/10 bg-black/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] flex items-center justify-center relative shrink-0 overflow-visible"
									>
										{#if isAlive}
											<div
												out:scale={{ duration: 180, start: 1.18, opacity: 0, easing: cubicOut }}
												class="ball-wave-item absolute inset-0 rounded-full flex items-center justify-center shadow-[0_3px_6px_rgba(0,0,0,0.9)] overflow-hidden"
												style="
                          animation-delay: {getCascadeDelay('p2', i)}ms;
                          background: {ballNum <= 7 ? BALL_COLORS[ballNum] : '#ffffff'};
                        "
											>
												{#if ballNum > 7}
													<div
														class="absolute inset-x-0 h-3"
														style="background: {BALL_COLORS[ballNum]};"
													></div>
												{/if}

												<div
													class="w-3 h-3 rounded-full bg-white flex items-center justify-center z-10 shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
												>
													<span class="text-[8.5px] font-mono font-black text-black leading-none">
														{ballNum}
													</span>
												</div>

												<!-- Reflejo 3D con contraste original restaurado -->
												<div
													class="absolute inset-0 rounded-full z-20 pointer-events-none"
													style="background: radial-gradient(circle at 35% 25%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.55) 100%);"
												></div>
											</div>
										{/if}
									</div>
								{/each}
							{/key}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- RELOJ DE TIRO SIN MICRO-SALTOS (850ms) -->
	<div
		class="{timerWidthClass} transition-all duration-[850ms] ease-in-out z-40 mt-1.5 flex items-center justify-between gap-3
    {timer.enabled ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}"
	>
		<div
			class="h-[7.5px] bg-black/90 w-full rounded-full overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
		>
			<div
				class="h-full rounded-full
          {isTimerEmergency
					? 'bg-red-600 shadow-[0_0_14px_rgba(220,38,38,1)] alert-pulse'
					: isTimerLow
						? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.9)]'
						: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'}"
				style="
          transition: width 200ms linear, background-color 500ms ease, box-shadow 500ms ease;
          width: {timerRatio <= 0 ? '0%' : (timerRatio * 100) + '%'};
          {timerRatio <= 0 ? 'opacity: 0;' : 'opacity: 1;'}
        "
			></div>
		</div>

		<span
			class="text-xs font-mono font-bold min-w-[28px] text-right transition-colors duration-200
      {isTimerEmergency
				? 'text-red-500 alert-pulse'
				: isTimerLow
					? 'text-orange-400'
					: 'text-amber-400'}"
		>
			{Math.ceil(timer.seconds)}s
		</span>
	</div>
</header>

<style>
	@keyframes ballWaveIn {
		0% {
			opacity: 0;
			transform: translateY(14px) scale(0.6);
		}
		65% {
			opacity: 1;
			transform: translateY(-4px) scale(1.08);
		}
		100% {
			opacity: 1;
			transform: translateY(0px) scale(1);
		}
	}

	.ball-wave-item {
		animation: ballWaveIn 0.44s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
		will-change: transform, opacity;
	}

	@keyframes alertPulseFast {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	.alert-pulse {
		animation: alertPulseFast 0.5s ease-in-out infinite;
	}
</style>