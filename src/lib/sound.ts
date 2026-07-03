/** Feedback sonoro sintetizado via Web Audio — sem assets externos. */

let ctx: AudioContext | null = null;

/** O AudioContext só pode nascer/tocar após um gesto do usuário; como o som
    dispara em cliques, a criação preguiçosa aqui sempre acontece num gesto. */
function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const CONFIG_KEY = 'number-test:config';

interface SoundConfig {
  volume?: number;
  soundOn?: boolean;
}

function readConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SoundConfig) : {};
  } catch {
    return {};
  }
}

/** Volume mestre dos sons de botão (0..1). */
let currentVolume: number = readConfig().volume ?? 1;
/** Master on/off switch, independent of the volume level. */
let soundOn: boolean = readConfig().soundOn ?? true;

export function getSoundVolume(): number {
  return currentVolume;
}

export function setSoundVolume(volume: number): void {
  currentVolume = Math.min(Math.max(volume, 0), 1);
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...readConfig(), volume: currentVolume })
    );
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

export function isSoundOn(): boolean {
  return soundOn;
}

export function setSoundOn(on: boolean): void {
  soundOn = on;
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...readConfig(), soundOn: on })
    );
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

/** "Toc": click de ruído seco de 8ms — o som oficial do app. */
function noiseClick(): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const len = Math.ceil(ac.sampleRate * 0.008);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(Math.max(0.125 * currentVolume, 0.0001), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
  src.connect(g);
  g.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.01);
}

/** Som ao PRESSIONAR um botão. */
export function playPress(): void {
  if (!soundOn || currentVolume <= 0) return;
  try {
    noiseClick();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}

/** Som ao SOLTAR o botão. */
export function playRelease(): void {
  if (!soundOn || currentVolume <= 0) return;
  try {
    noiseClick();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
