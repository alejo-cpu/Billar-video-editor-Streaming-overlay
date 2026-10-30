import { writable } from 'svelte/store';

const STORAGE_KEY = 'billiards_match_data_v9';
const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

const defaultState = {
	p1: { name: 'JUGADOR 1', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
	p2: { name: 'JUGADOR 2', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
	showAvatars: true,
	turns: { enabled: true, active: 'p1' },
	modality: 'ONE POCKET',
	race: 'RACE TO 3',
	timer: { enabled: true, seconds: 30.0, maxSeconds: 30, running: false, customInput: 30 },
	uiScale: {
		hud: 1.0,
		ticker: 1.0
	},
	ticker: {
		visible: true,
		items: [
			{ id: 1, type: 'sponsor', text: 'HDP BILLAR', logoUrl: '', active: true },
			{ id: 2, type: 'aviso', text: 'GRAN FINAL ONE POCKET', logoUrl: '', active: true }
		]
	}
};

export const liveEffect = writable(null);

function createMatchStore() {
	const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
	const initial = saved ? JSON.parse(saved) : defaultState;
	const { subscribe, set, update } = writable(initial);

	let ws;
	function connectWS() {
		const host =
			typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
		ws = new WebSocket(`ws://${host}:3001`);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'SYNC_STATE') {
					set(data.payload);
					localStorage.setItem(STORAGE_KEY, JSON.stringify(data.payload));
				} else if (data.type === 'TIMER_TICK') {
					update((s) => {
						s.timer.seconds = data.seconds;
						return s;
					});
				} else if (data.type === 'TRIGGER_EFFECT') {
					liveEffect.set(data.payload);
				}
			} catch (e) {}
		};

		ws.onclose = () => {
			setTimeout(connectWS, 1500);
		};
	}

	if (typeof window !== 'undefined') {
		connectWS();
	}

	function broadcast(state) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: state }));
		}
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	}

	return {
		subscribe,
		updateState: (fn) => {
			update((state) => {
				const next = fn(state);
				broadcast(next);
				return next;
			});
		},
		setHudScale: (val) => {
			update((state) => {
				if (!state.uiScale) state.uiScale = { hud: 1.0, ticker: 1.0 };
				state.uiScale.hud = parseFloat(val);
				broadcast(state);
				return state;
			});
		},
		setTickerScale: (val) => {
			update((state) => {
				if (!state.uiScale) state.uiScale = { hud: 1.0, ticker: 1.0 };
				state.uiScale.ticker = parseFloat(val);
				broadcast(state);
				return state;
			});
		},
		setModality: (mod) => {
			update((state) => {
				state.modality = mod.toUpperCase();
				broadcast(state);
				return state;
			});
		},
		setRace: (race) => {
			update((state) => {
				state.race = race.toUpperCase();
				broadcast(state);
				return state;
			});
		},
		sendEffect: (effectName, playerKey) => {
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(
					JSON.stringify({
						type: 'TRIGGER_EFFECT',
						payload: { effect: effectName, playerKey, id: Date.now() }
					})
				);
			}
		},
		toggleAvatars: () => {
			update((state) => {
				state.showAvatars = !state.showAvatars;
				broadcast(state);
				return state;
			});
		},
		setPocket: (playerKey, pocket) => {
			update((state) => {
				if (!pocket) {
					state.p1.pocket = '';
					state.p2.pocket = '';
				} else {
					state[playerKey].pocket = pocket;
					const otherKey = playerKey === 'p1' ? 'p2' : 'p1';
					state[otherKey].pocket = pocket === 'L' ? 'R' : 'L';
				}
				broadcast(state);
				return state;
			});
		},
		toggleTurns: () => {
			update((state) => {
				state.turns.enabled = !state.turns.enabled;
				broadcast(state);
				return state;
			});
		},
		switchTurn: () => {
			update((state) => {
				state.turns.active = state.turns.active === 'p1' ? 'p2' : 'p1';
				broadcast(state);
				return state;
			});
		},
		setTurn: (playerKey) => {
			update((state) => {
				state.turns.active = playerKey;
				broadcast(state);
				return state;
			});
		},
		adjustBalls: (playerKey, delta) => {
			update((state) => {
				state[playerKey].balls = state[playerKey].balls + delta;
				broadcast(state);
				return state;
			});
		},
		resetBalls: () => {
			update((state) => {
				state.p1.balls = 0;
				state.p2.balls = 0;
				broadcast(state);
				return state;
			});
		},
		finishRack: (winnerKey) => {
			let backup = null;
			update((state) => {
				backup = {
					p1: { ...state.p1 },
					p2: { ...state.p2 }
				};
				state[winnerKey].games += 1;
				state.p1.balls = 0;
				state.p2.balls = 0;
				broadcast(state);
				return state;
			});
			return backup;
		},
		restoreRackBackup: (backup) => {
			if (!backup) return;
			update((state) => {
				state.p1 = { ...state.p1, ...backup.p1 };
				state.p2 = { ...state.p2, ...backup.p2 };
				broadcast(state);
				return state;
			});
		},
		adjustGames: (playerKey, delta) => {
			update((state) => {
				const val = state[playerKey].games + delta;
				state[playerKey].games = val < 0 ? 0 : val;
				broadcast(state);
				return state;
			});
		},
		swapPockets: () => {
			update((state) => {
				const temp = state.p1.pocket;
				state.p1.pocket = state.p2.pocket;
				state.p2.pocket = temp;
				broadcast(state);
				return state;
			});
		},
		setPlayerName: (playerKey, name) => {
			update((state) => {
				state[playerKey].name = name.toUpperCase();
				broadcast(state);
				return state;
			});
		},
		setPlayerAvatar: (playerKey, avatarData) => {
			update((state) => {
				state[playerKey].avatar = avatarData;
				broadcast(state);
				return state;
			});
		},
		toggleTimer: () => {
			update((state) => {
				state.timer.enabled = !state.timer.enabled;
				if (!state.timer.enabled) state.timer.running = false;
				broadcast(state);
				return state;
			});
		},
		setTimerRunning: (isRunning) => {
			update((state) => {
				state.timer.running = isRunning;
				broadcast(state);
				return state;
			});
		},
		resetTimer: (secs) => {
			update((state) => {
				const target = secs || state.timer.maxSeconds || 30;
				state.timer.seconds = target;
				state.timer.maxSeconds = target;
				state.timer.running = false;
				broadcast(state);
				return state;
			});
		},
		setCustomTimer: (secs) => {
			update((state) => {
				const s = Math.max(5, parseInt(secs, 10) || 30);
				state.timer.customInput = s;
				state.timer.maxSeconds = s;
				state.timer.seconds = s;
				state.timer.running = false;
				broadcast(state);
				return state;
			});
		},
		toggleTickerVisible: () => {
			update((state) => {
				state.ticker.visible = !state.ticker.visible;
				broadcast(state);
				return state;
			});
		},
		applyTickerItemsImmediately: (items) => {
			update((state) => {
				state.ticker.items = [...items];
				broadcast(state);
				return state;
			});
		}
	};
}

export const matchStore = createMatchStore();
