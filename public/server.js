import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const STATE_FILE = 'state.json';
const RENDERS_DIR = path.resolve('public/renders');
const UPLOADS_DIR = path.resolve('public/temp_uploads');

if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d26"/><circle cx="50" cy="38" r="19" fill="%234b5563"/><path d="M18,92 C18,68 32,62 50,62 C68,62 82,68 82,92 Z" fill="%234b5563"/></svg>`;

const defaultState = {
  p1: { name: 'JUGADOR 1', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
  p2: { name: 'JUGADOR 2', balls: 0, games: 0, pocket: '', avatar: DEFAULT_AVATAR },
  showAvatars: true,
  turns: { enabled: true, active: 'p1' },
  modality: 'ONE POCKET',
  race: 'RACE TO 3',
  timer: { enabled: true, seconds: 30.0, maxSeconds: 30, running: false, customInput: 30 },
  uiScale: { hud: 1.0, ticker: 1.0 },
  ticker: {
    visible: true,
    items: [
      { id: 1, type: 'sponsor', text: 'HDP BILLAR', logoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1Yaq_cjnSVkJC6znloVQB8rr-RtT7TzoTWiWRxQwQs3a025Nj6qxaozs1q_BiOqQkZPh-lKhIZt1G3Phnbss1OVe0fVOph9yvzCF9LU69opfKFIzldqS49gz9oi_ma2BGfVnZE8uoeAvxALg9IXcYy4lCZa1dmODzDU_uwcMpG61_CtLe5yz6LfplFeF2DCHibu400ubLMc75xyuQeU2tI6nN-CmxN-oRTyn4tU-2ygc-Um64MBTB1gIEzEUM8wgK1w', active: true },
      { id: 2, type: 'aviso', text: 'GRAN FINAL ONE POCKET', logoUrl: '', active: true },
      { id: 3, type: 'sponsor', text: 'DIAMOND TABLES', logoUrl: '', active: true }
    ]
  }
};

let currentState = defaultState;
if (fs.existsSync(STATE_FILE)) {
  try {
    currentState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    currentState = defaultState;
  }
}

let diskSaveTimer = null;
function scheduleDiskSave() {
  if (diskSaveTimer) clearTimeout(diskSaveTimer);
  diskSaveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(currentState, null, 2), () => {});
  }, 500);
}

/* ==================== MOTOR FFMPEG ==================== */
function runFFmpegRender(payload, wsClient) {
  const { videoFileName, videoWidth, videoHeight, bgMusicFileName, events, duration, bgSettings, hudSnapshots, tickerSnapshot } = payload;
  const inputVideoPath = path.join(UPLOADS_DIR, videoFileName);
  const outputFileName = `partida_exportada_${Date.now()}.mp4`;
  const outputPath = path.join(RENDERS_DIR, outputFileName);
  const safeDuration = Math.max(1, Math.round(duration || 10));
  const vWidth = Math.max(2, parseInt(videoWidth) || 1920);

  const tempFilesToDelete = [];

  const ffmpegArgs = ['-y', '-i', inputVideoPath];
  let inputIdx = 1;

  let filterComplex = [];
  filterComplex.push(`[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2[v_base]`);
  let currentVideoOutput = 'v_base';

  /* 1. ESTAMPADO DE MARCADOR EN ALTA DEFINICIÓN (BISELADO EN CANVAS SOBRE MARGEN LIMPIO) */
  if (hudSnapshots && hudSnapshots.length > 0) {
    hudSnapshots.forEach((snap, idx) => {
      const base64Data = snap.dataUrl.replace(/^data:image\/png;base64,/, '');
      const snapPath = path.join(UPLOADS_DIR, `hud_${Date.now()}_${idx}.png`);
      fs.writeFileSync(snapPath, base64Data, 'base64');
      tempFilesToDelete.push(snapPath);
      
      ffmpegArgs.push('-loop', '1', '-t', `${safeDuration}`, '-i', snapPath);
      const snapIdx = inputIdx++;

      const scaledOut = `v_hud_sc_${idx}`;
      const nextOut = `v_hud_${idx}`;
      filterComplex.push(`[${snapIdx}:v]scale=trunc(iw/4)*2:-2[${scaledOut}]`);
      filterComplex.push(`[${currentVideoOutput}][${scaledOut}]overlay=x=(W-w)/2:y=14:enable='between(t,${Math.max(0, snap.start).toFixed(2)},${Math.min(safeDuration, snap.end).toFixed(2)})'[${nextOut}]`);
      currentVideoOutput = nextOut;
    });
  }

  /* 2. CINTA: BARRA SÓLIDA OSCURA EN LA BASE Y SCROLL CONTINUO DE MARCAS */
  if (tickerSnapshot && tickerSnapshot.dataUrl) {
    const base64Data = tickerSnapshot.dataUrl.replace(/^data:image\/png;base64,/, '');
    const tickPath = path.join(UPLOADS_DIR, `tick_track_${Date.now()}.png`);
    fs.writeFileSync(tickPath, base64Data, 'base64');
    tempFilesToDelete.push(tickPath);

    ffmpegArgs.push('-loop', '1', '-t', `${safeDuration}`, '-i', tickPath);
    const tickInputIdx = inputIdx++;
    const segW = Math.max(300, Math.round(tickerSnapshot.segmentWidth || 1200));

    // Dibujar barra sólida oscura de 56px de alto en la base para tapar cualquier icono
    filterComplex.push(`[${currentVideoOutput}]drawbox=x=0:y=ih-56:w=iw:h=56:color=black@0.95:t=fill[v_bar_bg]`);
    // Desplazamiento horizontal continuo en bucle
    filterComplex.push(`[${tickInputIdx}:v]scale=-1:56[tick_track]`);
    filterComplex.push(`[v_bar_bg][tick_track]overlay=x='-mod(t*75\\,${segW})':y=H-56[v_tick]`);
    currentVideoOutput = 'v_tick';
  }

  /* 3. REACCIONES CON SECUENCIA DE FRAMES ANIMADOS REALES */
  const effectEvents = (events || []).filter(e => e.actionType === 'effect' && e.payload?.effect !== 'confetti');
  effectEvents.forEach((ev, idx) => {
    const animFolder = path.resolve(`public/stickers/anim/${ev.payload.effect}`);
    if (fs.existsSync(animFolder) && fs.existsSync(`${animFolder}/dump_0000.png`)) {
      ffmpegArgs.push('-stream_loop', '-1', '-start_number', '0', '-framerate', '20', '-t', '1.85', '-i', `${animFolder}/dump_%04d.png`);
      const sIdx = inputIdx++;

      const prepOut = `v_sfx_prep_${idx}`;
      const nextOut = `v_eff_${idx}`;
      const isP1 = ev.payload.playerKey === 'p1';
      const t0 = ev.time;

      if (isP1) {
        filterComplex.push(`[${sIdx}:v]scale=120:120,hflip[${prepOut}]`);
        filterComplex.push(`[${currentVideoOutput}][${prepOut}]overlay=x='if(lt(t-${t0}\\,0.35)\\, -w+(32+w)*(t-${t0})/0.35\\, if(gt(t-${t0}\\,1.50)\\, 32-(32+w)*(t-${t0}-1.50)/0.35\\, 32))':y=H-h-90:enable='between(t,${t0.toFixed(2)},${(t0 + 1.85).toFixed(2)})'[${nextOut}]`);
      } else {
        filterComplex.push(`[${sIdx}:v]scale=120:120[${prepOut}]`);
        filterComplex.push(`[${currentVideoOutput}][${prepOut}]overlay=x='if(lt(t-${t0}\\,0.35)\\, W-(32+w)*(t-${t0})/0.35\\, if(gt(t-${t0}\\,1.50)\\, (W-w-32)+(32+w)*(t-${t0}-1.50)/0.35\\, W-w-32))':y=H-h-90:enable='between(t,${t0.toFixed(2)},${(t0 + 1.85).toFixed(2)})'[${nextOut}]`);
      }
      currentVideoOutput = nextOut;
    }
  });

  /* 4. AUDIO */
  ffmpegArgs.push('-t', `${safeDuration}`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
  const nullAudioIdx = inputIdx++;
  let audioInputs = [`[${nullAudioIdx}:a]`];

  if (bgMusicFileName) {
    const bgMusicPath = path.join(UPLOADS_DIR, bgMusicFileName);
    if (fs.existsSync(bgMusicPath)) {
      if (bgSettings?.loop) {
        ffmpegArgs.push('-stream_loop', '-1');
      }
      ffmpegArgs.push('-i', bgMusicPath);
      let bgFilter = `[${inputIdx}:a]volume=${bgSettings?.volume || 0.3}`;
      if (bgSettings?.fadeIn) bgFilter += `,afade=t=in:ss=0:d=3`;
      if (bgSettings?.fadeOut && safeDuration > 5) bgFilter += `,afade=t=out:st=${safeDuration - 3}:d=3`;
      bgFilter += `[bg_music]`;
      filterComplex.push(bgFilter);
      audioInputs.push('[bg_music]');
      inputIdx++;
    }
  }

  const soundEvents = (events || []).filter(e => {
    return (e.soundEnabled && e.actionType === 'effect') || 
           (e.actionType === 'adjustBalls') || 
           (e.actionType === 'adjustGames' && e.payload?.delta > 0);
  });

  soundEvents.forEach((ev, idx) => {
    let sfxFile = null;
    let maxDur = 2.0;
    let fadeStart = 1.4;

    if (ev.actionType === 'effect') {
      sfxFile = `public/sounds/${ev.payload.effect}.mp3`;
      if (ev.payload.effect === 'fire') {
        maxDur = 1.8;
        fadeStart = 1.2;
      } else if (ev.payload.effect === 'clap') {
        maxDur = 2.6;
        fadeStart = 1.8;
      }
    } else if (ev.actionType === 'adjustBalls') {
      sfxFile = ev.payload.delta > 0 ? `public/sounds/+1 Point.mp3` : `public/sounds/-1 Point.mp3`;
      maxDur = 0.5;
      fadeStart = 0.4;
    } else if (ev.actionType === 'adjustGames') {
      sfxFile = `public/sounds/+1 Games.mp3`;
      maxDur = 1.5;
      fadeStart = 1.2;
    }

    if (sfxFile) {
      const sfxPath = path.resolve(sfxFile);
      if (fs.existsSync(sfxPath)) {
        ffmpegArgs.push('-i', sfxPath);
        const delayMs = Math.round(ev.time * 1000);
        const fadeDur = (maxDur - fadeStart).toFixed(2);
        filterComplex.push(`[${inputIdx}:a]atrim=0:${maxDur},afade=t=out:st=${fadeStart}:d=${fadeDur},adelay=${delayMs}|${delayMs},volume=0.35[sfx_${idx}]`);
        audioInputs.push(`[sfx_${idx}]`);
        inputIdx++;
      }
    }
  });

  if (audioInputs.length > 1) {
    filterComplex.push(`${audioInputs.join('')}amix=inputs=${audioInputs.length}:duration=first:dropout_transition=2[aout]`);
  } else {
    filterComplex.push(`${audioInputs[0]}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`);
  }

  ffmpegArgs.push(
    '-filter_complex', filterComplex.join(';'),
    '-map', `[${currentVideoOutput}]`,
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-crf', '21',
    '-threads', '0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath
  );

  console.log('🚀 COMANDO FFMPEG:\nffmpeg', ffmpegArgs.join(' '));

  let stderrLog = '';
  const proc = spawn('ffmpeg', ffmpegArgs);

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrLog += text;

    const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch && safeDuration > 0) {
      const hours = parseFloat(timeMatch[1]);
      const mins = parseFloat(timeMatch[2]);
      const secs = parseFloat(timeMatch[3]);
      const current = hours * 3600 + mins * 60 + secs;
      const percent = Math.min(99, Math.round((current / safeDuration) * 100));

      const fpsMatch = text.match(/fps=\s*(\d+)/);
      const fps = fpsMatch ? parseInt(fpsMatch[1]) : 60;

      wsClient.send(JSON.stringify({
        type: 'RENDER_PROGRESS',
        payload: { active: true, percent, fps }
      }));
    }
  });

  proc.on('close', (code) => {
    tempFilesToDelete.forEach((fPath) => {
      try {
        if (fs.existsSync(fPath)) {
          fs.unlinkSync(fPath);
        }
      } catch (e) {}
    });

    if (code === 0) {
      console.log('✅ Renderizado completado 100%:', outputFileName);
      wsClient.send(JSON.stringify({
        type: 'RENDER_PROGRESS',
        payload: { active: false, percent: 100, downloadUrl: `/renders/${outputFileName}` }
      }));
    } else {
      console.error('❌ Error FFmpeg código de salida:', code);
      const lastLines = stderrLog.split('\n').slice(-10).join('\n');
      wsClient.send(JSON.stringify({
        type: 'RENDER_ERROR',
        payload: `FFmpeg código ${code}:\n${lastLines}`
      }));
    }
  });
}

/* ==================== SERVIDOR ==================== */
async function start() {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/upload-media')) {
      const fileNameHeader = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : 'video.mp4';
      const cleanName = fileNameHeader.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `up_${Date.now()}_${cleanName}`;
      const dest = path.join(UPLOADS_DIR, filename);
      const writeStream = fs.createWriteStream(dest);

      req.pipe(writeStream);
      writeStream.on('finish', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ filename }));
      });
      writeStream.on('error', () => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Error guardando archivo' }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });

  function broadcastState(sender = null) {
    const msg = JSON.stringify({ type: 'SYNC_STATE', payload: currentState });
    wss.clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  setInterval(() => {
    if (currentState?.timer?.enabled && currentState.timer.running) {
      if (currentState.timer.seconds > 0) {
        currentState.timer.seconds = Math.max(0, +(currentState.timer.seconds - 0.25).toFixed(2));
        if (currentState.timer.seconds <= 0) {
          if (currentState.turns?.enabled) {
            currentState.turns.active = currentState.turns.active === 'p1' ? 'p2' : 'p1';
          }
          currentState.timer.seconds = currentState.timer.maxSeconds;
          currentState.timer.running = true;
          broadcastState();
        } else {
          const tickMsg = JSON.stringify({ type: 'TIMER_TICK', seconds: currentState.timer.seconds });
          wss.clients.forEach((c) => {
            if (c.readyState === WebSocket.OPEN) c.send(tickMsg);
          });
        }
      }
    }
  }, 250);

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: currentState }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'SYNC_STATE') {
          currentState = data.payload;
          broadcastState(ws);
          scheduleDiskSave();
        } else if (data.type === 'TRIGGER_EFFECT') {
          const msg = JSON.stringify(data);
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(msg);
          });
        } else if (data.type === 'START_RENDER') {
          runFFmpegRender(data.payload, ws);
        }
      } catch (e) {
        console.error('Error procesando mensaje:', e);
      }
    });
  });

  server.listen(3001, () => {
    console.log('📡 Servidor activo en ws://localhost:3001');
  });

  const vite = await createViteServer({
    server: { port: 5173 }
  });
  await vite.listen();
  vite.printUrls();
}

start();
