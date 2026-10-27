import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';

const STATE_FILE = 'state.json';
const RENDERS_DIR = path.resolve('public/renders');
const UPLOADS_DIR = path.resolve('public/temp_uploads');
const STICKERS_DIR = path.resolve('public/stickers');
const PROJECTS_DIR = path.resolve('projects');

if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// Limpieza automática preventiva de temporales huérfanos antiguos al arrancar
try {
  const now = Date.now();
  fs.readdirSync(UPLOADS_DIR).forEach(file => {
    const fPath = path.join(UPLOADS_DIR, file);
    const stats = fs.statSync(fPath);
    if (now - stats.mtimeMs > 1000 * 60 * 60 * 12) { // más de 12 horas
      if (stats.isDirectory()) fs.rmSync(fPath, { recursive: true, force: true });
      else fs.unlinkSync(fPath);
    }
  });
} catch (e) {}

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
      { id: 1, type: 'sponsor', text: 'HDP BILLAR', logoUrl: '', active: true },
      { id: 2, type: 'aviso', text: 'GRAN FINAL ONE POCKET', logoUrl: '', active: true }
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

let activeRenderProc = null;
let activeOutputPath = null;

function cancelActiveRender() {
  if (activeRenderProc) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${activeRenderProc.pid} /T /F`, { stdio: 'ignore' });
      } else {
        activeRenderProc.kill('SIGKILL');
      }
    } catch (e) {
      try { activeRenderProc.kill(); } catch (err) {}
    }
    activeRenderProc = null;
    if (activeOutputPath && fs.existsSync(activeOutputPath)) {
      try { fs.unlinkSync(activeOutputPath); } catch (e) {}
    }
    activeOutputPath = null;
  }
}

function getFFmpegBinary() {
  const isWin = process.platform === 'win32';

  if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    if (!isWin) {
      try { fs.chmodSync(ffmpegPath, 0o755); } catch (e) {}
    }
    return ffmpegPath;
  }

  if (isWin) {
    const localExe = path.resolve('ffmpeg.exe');
    if (fs.existsSync(localExe)) return localExe;

    const staticExe = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe');
    if (fs.existsSync(staticExe)) return staticExe;
  }

  try {
    const checkCmd = isWin ? 'where ffmpeg' : 'which ffmpeg';
    const systemFfmpeg = execSync(checkCmd, { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split(/\r?\n/)[0]
      .trim();

    if (systemFfmpeg && fs.existsSync(systemFfmpeg)) {
      return systemFfmpeg;
    }
  } catch (e) {}

  return isWin ? 'ffmpeg.exe' : 'ffmpeg';
}

function runFFmpegRender(payload, wsClient) {
  cancelActiveRender();

  const FFMPEG_BIN = getFFmpegBinary();

  const {
    videoFileName,
    events,
    duration,
    bgSettings,
    bgPlaylist,
    videoAudioSettings,
    hudSnapshots,
    tickerSnapshots
  } = payload;

  const inputVideoPath = path.join(UPLOADS_DIR, videoFileName);
  const outputFileName = `partida_exportada_${Date.now()}.mp4`;
  const outputPath = path.join(RENDERS_DIR, outputFileName);
  activeOutputPath = outputPath;
  const safeDuration = Math.max(1, Math.round(duration || 10));

  const tempFilesToDelete = [];
  const ffmpegArgs = ['-y', '-i', inputVideoPath];
  let inputIdx = 1;

  let filterComplex = [];
  filterComplex.push(`[0:v]scale=1920:1080,setsar=1[v_base]`);
  let currentVideoOutput = 'v_base';

  /* 1. HUD EN ALTA DEFINICIÓN */
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

      filterComplex.push(`[${snapIdx}:v]scale=trunc(iw/2):trunc(ih/2)[${scaledOut}]`);
      filterComplex.push(`[${currentVideoOutput}][${scaledOut}]overlay=x=(W-w)/2:y=12:eof_action=pass:enable='between(t,${Math.max(0, snap.start).toFixed(2)},${Math.min(safeDuration, snap.end).toFixed(2)})'[${nextOut}]`);
      currentVideoOutput = nextOut;
    });
  }

  /* 2. CINTA CONTINUA SIN HUECOS (USANDO LA VARIABLE NATIVA 'w' DE FFMPEG) */
  if (tickerSnapshots && tickerSnapshots.length > 0) {
    tickerSnapshots.forEach((tick, idx) => {
      if (!tick.dataUrl || !tick.visible) return;

      const base64Data = tick.dataUrl.replace(/^data:image\/png;base64,/, '');
      const tickPath = path.join(UPLOADS_DIR, `tick_${Date.now()}_${idx}.png`);
      fs.writeFileSync(tickPath, base64Data, 'base64');
      tempFilesToDelete.push(tickPath);

      ffmpegArgs.push('-loop', '1', '-t', `${safeDuration}`, '-i', tickPath);
      const tickInputIdx = inputIdx++;
      const tStart = Math.max(0, tick.start).toFixed(2);
      const tEnd = Math.min(safeDuration, tick.end).toFixed(2);

      const barBg = `v_bar_${idx}`;
      const tickScaleA = `v_tick_a_${idx}`;
      const tickScaleB = `v_tick_b_${idx}`;
      const tickMid = `v_tick_mid_${idx}`;
      const nextOut = `v_tick_${idx}`;

      // Barra translúcida al 92% coordinada con el editor
      filterComplex.push(`[${currentVideoOutput}]drawbox=x=0:y=ih-56:w=iw:h=56:color=black@0.92:t=fill:enable='between(t,${tStart},${tEnd})'[${barBg}]`);
      // Escala manteniendo proporción y duplica con split=2
      filterComplex.push(`[${tickInputIdx}:v]scale=-1:56,split=2[${tickScaleA}][${tickScaleB}]`);
      // Unión matemática perfecta con 'w': el segmento B empieza donde termina el A
      filterComplex.push(`[${barBg}][${tickScaleA}]overlay=x='-mod(t*75\\,w)':y=H-56:eof_action=pass:enable='between(t,${tStart},${tEnd})'[${tickMid}]`);
      filterComplex.push(`[${tickMid}][${tickScaleB}]overlay=x='w-mod(t*75\\,w)':y=H-56:eof_action=pass:enable='between(t,${tStart},${tEnd})'[${nextOut}]`);
      currentVideoOutput = nextOut;
    });
  }

  /* 3. REACCIONES Y CONFETI */
  const effectEvents = (events || []).filter(e => e.actionType === 'effect');

  effectEvents.forEach((ev, idx) => {
    const effectName = ev.payload.effect;
    const isP1 = ev.payload.playerKey === 'p1';
    const isConfetti = effectName === 'confetti';
    const t0 = parseFloat(ev.time);

    const sIdx = inputIdx++;
    const prepOut = `v_sfx_prep_${idx}`;
    const nextOut = `v_eff_${idx}`;

    if (isConfetti) {
      const confettiWebm = path.join(STICKERS_DIR, `confetti_${isP1 ? 'p1' : 'p2'}.webm`);
      if (fs.existsSync(confettiWebm)) {
        ffmpegArgs.push('-i', confettiWebm);
        filterComplex.push(`[${sIdx}:v]colorkey=0x000000:0.25:0.10,scale=1920:1080,setpts=PTS-STARTPTS+${t0.toFixed(2)}/TB[${prepOut}]`);
        filterComplex.push(`[${currentVideoOutput}][${prepOut}]overlay=x=0:y=0:eof_action=pass:enable='between(t,${t0.toFixed(2)},${(t0 + 2.2).toFixed(2)})'[${nextOut}]`);
        currentVideoOutput = nextOut;
        return;
      }
    }

    const animFolder = path.resolve(`public/stickers/anim/${effectName}`);
    const isAnimSequence = fs.existsSync(animFolder) && fs.existsSync(`${animFolder}/dump_0000.png`);
    const staticWebp = path.resolve(`public/stickers/${effectName}.webp`);

    if (isAnimSequence) {
      ffmpegArgs.push('-stream_loop', '2', '-framerate', '24', '-start_number', '0', '-i', `${animFolder}/dump_%04d.png`);
    } else if (fs.existsSync(staticWebp)) {
      ffmpegArgs.push('-loop', '1', '-t', '1.85', '-i', staticWebp);
    } else {
      return;
    }

    let filterChain = `[${sIdx}:v]scale=120:120,setpts=PTS-STARTPTS+${t0.toFixed(2)}/TB`;
    if (isP1) {
      filterChain += `,hflip`;
    }
    filterChain += `[${prepOut}]`;
    filterComplex.push(filterChain);

    if (isP1) {
      filterComplex.push(`[${currentVideoOutput}][${prepOut}]overlay=x='if(lt(t-${t0}\\,0.35)\\, -w+(32+w)*(t-${t0})/0.35\\, if(gt(t-${t0}\\,1.50)\\, 32-(32+w)*(t-${t0}-1.50)/0.35\\, 32))':y=H-h-90:eof_action=pass:enable='between(t,${t0.toFixed(2)},${(t0 + 1.85).toFixed(2)})'[${nextOut}]`);
    } else {
      filterComplex.push(`[${currentVideoOutput}][${prepOut}]overlay=x='if(lt(t-${t0}\\,0.35)\\, W-(32+w)*(t-${t0})/0.35\\, if(gt(t-${t0}\\,1.50)\\, (W-w-32)+(32+w)*(t-${t0}-1.50)/0.35\\, W-w-32))':y=H-h-90:eof_action=pass:enable='between(t,${t0.toFixed(2)},${(t0 + 1.85).toFixed(2)})'[${nextOut}]`);
    }

    currentVideoOutput = nextOut;
  });

  /* 4. AUDIO */
  let audioInputs = [];

  let hasVideoAudio = false;
  try {
    const probe = execSync(`"${FFMPEG_BIN}" -i "${inputVideoPath}"`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    hasVideoAudio = /Stream #.*Audio:/.test(probe);
  } catch (e) {
    const errStr = e.stderr?.toString() || e.stdout?.toString() || '';
    hasVideoAudio = /Stream #.*Audio:/.test(errStr);
  }

  const vAudioMuted = videoAudioSettings?.muted === true;
  const vAudioVolume = Math.max(0, Math.min(1.0, parseFloat(videoAudioSettings?.volume ?? 1)));

  if (hasVideoAudio && !vAudioMuted && vAudioVolume > 0) {
    filterComplex.push(`[0:a]volume=${vAudioVolume.toFixed(2)},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[v_orig_audio]`);
    audioInputs.push('[v_orig_audio]');
  }

  if (bgPlaylist && Array.isArray(bgPlaylist) && bgPlaylist.length > 0) {
    const validSongs = bgPlaylist.filter(song => {
      const fullPath = path.join(UPLOADS_DIR, song.filename);
      return fs.existsSync(fullPath);
    });

    if (validSongs.length > 0) {
      let totalPlaylistDuration = validSongs.reduce((acc, s) => acc + (parseFloat(s.duration) || 120), 0);
      let repeatCount = 1;
      if (bgSettings?.loop && totalPlaylistDuration > 0 && safeDuration > totalPlaylistDuration) {
        repeatCount = Math.ceil(safeDuration / totalPlaylistDuration) + 1;
      }

      let songConcatInputs = [];
      let songCounter = 0;

      for (let r = 0; r < repeatCount; r++) {
        for (let s = 0; s < validSongs.length; s++) {
          const songPath = path.join(UPLOADS_DIR, validSongs[s].filename);
          ffmpegArgs.push('-i', songPath);
          const currentSongInputIdx = inputIdx++;
          const normOut = `bg_norm_${songCounter++}`;
          filterComplex.push(`[${currentSongInputIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[${normOut}]`);
          songConcatInputs.push(`[${normOut}]`);
        }
      }

      const concatFilterOut = 'bg_concat_out';
      filterComplex.push(`${songConcatInputs.join('')}concat=n=${songConcatInputs.length}:v=0:a=1[${concatFilterOut}]`);

      let bgFilter = `[${concatFilterOut}]atrim=0:${safeDuration},volume=${bgSettings?.volume || 0.35}`;
      if (bgSettings?.fadeIn) bgFilter += `,afade=t=in:ss=0:d=3`;
      if (bgSettings?.fadeOut && safeDuration > 5) bgFilter += `,afade=t=out:st=${safeDuration - 3}:d=3`;
      bgFilter += `[bg_music]`;
      filterComplex.push(bgFilter);
      audioInputs.push('[bg_music]');
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

  if (audioInputs.length === 0) {
    ffmpegArgs.push('-t', `${safeDuration}`, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    const nullIdx = inputIdx++;
    filterComplex.push(`[${nullIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`);
  } else if (audioInputs.length === 1) {
    filterComplex.push(`${audioInputs[0]}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`);
  } else {
    filterComplex.push(`${audioInputs.join('')}amix=inputs=${audioInputs.length}:duration=first:dropout_transition=2[aout]`);
  }

  // SOLUCIÓN A WINDOWS E2BIG: Escribir filtros en archivo script temporal
  const scriptFileName = `filter_script_${Date.now()}.txt`;
  const scriptPath = path.join(UPLOADS_DIR, scriptFileName);
  fs.writeFileSync(scriptPath, filterComplex.join(';\n'), 'utf8');
  tempFilesToDelete.push(scriptPath);

  ffmpegArgs.push(
    '-filter_complex_script', scriptPath,
    '-map', `[${currentVideoOutput}]`,
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-tune', 'film',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', `${safeDuration}`,
    '-movflags', '+faststart',
    outputPath
  );

  console.log(`🚀 FFmpeg ejecutando con script de filtros (${filterComplex.length} operaciones):`);
  console.log(`${FFMPEG_BIN} ${ffmpegArgs.filter(a => a !== scriptPath).join(' ')} -filter_complex_script ${scriptFileName}`);

  let stderrLog = '';
  const proc = spawn(FFMPEG_BIN, ffmpegArgs);
  activeRenderProc = proc;

  proc.on('error', (err) => {
    activeRenderProc = null;
    activeOutputPath = null;
    console.error('❌ Error al iniciar FFmpeg:', err.message);
    wsClient.send(JSON.stringify({
      type: 'RENDER_ERROR',
      payload: `No se pudo iniciar FFmpeg (${err.code}): ${err.message}.`
    }));
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrLog += text;

    const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch && safeDuration > 0) {
      const hours = parseFloat(timeMatch[1]);
      const mins = parseFloat(timeMatch[2]);
      const secs = parseFloat(timeMatch[3]);
      const current = hours * 3600 + mins * 60 + secs;
      const percent = Math.min(100, Math.round((current / safeDuration) * 100));

      const fpsMatch = text.match(/fps=\s*(\d+)/);
      const fps = fpsMatch ? parseInt(fpsMatch[1]) : 60;

      wsClient.send(JSON.stringify({
        type: 'RENDER_PROGRESS',
        payload: { active: true, percent, fps }
      }));
    }
  });

  proc.on('close', (code, signal) => {
    activeRenderProc = null;
    activeOutputPath = null;

    setTimeout(() => {
      tempFilesToDelete.forEach((fPath) => {
        try {
          if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
        } catch (e) {}
      });
    }, 150);

    if (signal === 'SIGKILL' || signal === 'SIGTERM') {
      return;
    }

    if (code === 0) {
      wsClient.send(JSON.stringify({
        type: 'RENDER_PROGRESS',
        payload: { active: false, percent: 100, downloadUrl: `/renders/${outputFileName}` }
      }));
    } else {
      const lastLines = stderrLog.split('\n').slice(-15).join('\n');
      wsClient.send(JSON.stringify({
        type: 'RENDER_ERROR',
        payload: `Error FFmpeg (${code}):\n${lastLines}`
      }));
    }
  });
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function start() {
  let activeVitePort = 5173;
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // IP y red para conexión móvil
    if (req.method === 'GET' && req.url === '/api/network-info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ip: getLocalIp(), port: activeVitePort }));
      return;
    }

    // Comprobación y subida de confeti
    if (req.method === 'GET' && req.url === '/api/check-confetti-webm') {
      const readyP1 = fs.existsSync(path.join(STICKERS_DIR, 'confetti_p1.webm'));
      const readyP2 = fs.existsSync(path.join(STICKERS_DIR, 'confetti_p2.webm'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: readyP1 && readyP2 }));
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/upload-confetti-webm')) {
      const urlObj = new URL(req.url, 'http://localhost:3001');
      const player = urlObj.searchParams.get('player') || 'p1';
      const dest = path.join(STICKERS_DIR, `confetti_${player}.webm`);
      const writeStream = fs.createWriteStream(dest);
      req.pipe(writeStream);
      writeStream.on('finish', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    // Subida de archivos de video o música
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

    // GESTIÓN DE PROYECTOS: GUARDAR PROYECTO (.billiard / JSON)
    if (req.method === 'POST' && req.url === '/api/project/save') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const rawName = (payload.projectName || payload.videoName || 'partida').replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = rawName.endsWith('.billiard') ? rawName : `${rawName}.billiard`;
          const filePath = path.join(PROJECTS_DIR, fileName);

          fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, fileName }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GESTIÓN DE PROYECTOS: LISTAR PROYECTOS DISPONIBLES
    if (req.method === 'GET' && req.url === '/api/project/list') {
      try {
        const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.billiard') || f.endsWith('.json'));
        const list = files.map(f => {
          const stats = fs.statSync(path.join(PROJECTS_DIR, f));
          return { name: f, updatedAt: stats.mtimeMs, size: stats.size };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ projects: list }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // GESTIÓN DE PROYECTOS: CARGAR PROYECTO
    if (req.method === 'GET' && req.url.startsWith('/api/project/load')) {
      try {
        const urlObj = new URL(req.url, 'http://localhost:3001');
        const name = path.basename(urlObj.searchParams.get('name') || '');
        const filePath = path.join(PROJECTS_DIR, name);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(content);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proyecto no encontrado' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
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

  // RELOJ DE TIRO PRECISO CON Date.now() (CERO TIMER DRIFT)
  let lastTimerTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastTimerTick) / 1000;
    lastTimerTick = now;

    if (currentState?.timer?.enabled && currentState.timer.running) {
      if (currentState.timer.seconds > 0) {
        currentState.timer.seconds = Math.max(0, +(currentState.timer.seconds - elapsed).toFixed(2));
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
  }, 200);

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
        } else if (data.type === 'CANCEL_RENDER') {
          cancelActiveRender();
        }
      } catch (e) {
        console.error('Error procesando mensaje WebSocket:', e);
      }
    });
  });

  server.listen(3001, '0.0.0.0', () => {});

  const vite = await createViteServer({
    server: { 
      host: '0.0.0.0',
      port: 5173 
    }
  });
  await vite.listen();

    activeVitePort = vite.httpServer?.address()?.port || 5173;
  const localIp = getLocalIp();
  const pcUrl = `http://localhost:${activeVitePort}/?view=control`;
  const mobileUrl = `http://${localIp}:${activeVitePort}/?view=control`;
  const obsUrl = `http://localhost:${activeVitePort}/?view=overlay`;

  console.log('\n==========================================================');
  console.log('   🎱 SISTEMA DE BILLAR INICIADO CORRECTAMENTE');
  console.log('==========================================================');
  console.log(`💻 ENLACE EN TU PC (Control):  ${pcUrl}`);
  console.log(`📱 ENLACE PARA TU MÓVIL:       ${mobileUrl}`);
  console.log(`📺 OVERLAY PARA OBS:           ${obsUrl}`);
  console.log('==========================================================\n');

  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', pcUrl]);
    } else if (process.platform === 'darwin') {
      spawn('open', [pcUrl]);
    } else {
      spawn('xdg-open', [pcUrl]);
    }
  } catch (e) {}
}

start();
