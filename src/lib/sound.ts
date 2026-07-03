/** Feedback sonoro sintetizado via Web Audio — sem assets externos. */

let ctx: AudioContext | null = null;

/** O AudioContext só pode nascer/tocar após um gesto do usuário; como o som
    dispara em cliques, a criação preguiçosa aqui sempre acontece num gesto. */
function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  /** Se definido, a frequência desliza até este valor ao longo do som. */
  freqEnd?: number;
  /** Passa-baixas para abafar os harmônicos agudos. */
  lowpass?: number;
  dur: number;
  gain: number;
  /** Atraso do início (para sons duplos). */
  delay?: number;
}

/** Tom simples com envelope de decay (e glide de pitch opcional). */
function tone({ type, freq, freqEnd, lowpass, dur, gain, delay = 0 }: ToneOpts): void {
  const ac = getCtx();
  const start = ac.currentTime + delay;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
  }

  let node: AudioNode = osc;
  if (lowpass !== undefined) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    node.connect(f);
    node = f;
  }

  const g = ac.createGain();
  // O ramp exponencial exige valor inicial > 0
  const level = Math.max(gain * currentVolume, 0.0001);
  g.gain.setValueAtTime(level, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);

  node.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur);
}

/* ===== Temas de som dos botões (par pressionar/soltar) ===== */

export interface SoundTheme {
  id: string;
  name: string;
  press: () => void;
  release: () => void;
}

export const SOUND_THEMES: SoundTheme[] = [
  {
    id: 'click-fino-grave',
    name: 'Click fino grave',
    press: () => tone({ type: 'square', freq: 1600, lowpass: 3200, dur: 0.01, gain: 0.14 }),
    release: () => tone({ type: 'square', freq: 2100, lowpass: 4200, dur: 0.01, gain: 0.09 }),
  },
  {
    id: 'pip',
    name: 'Pip',
    press: () => tone({ type: 'sine', freq: 1760, dur: 0.02, gain: 0.12 }),
    release: () => tone({ type: 'sine', freq: 2200, dur: 0.015, gain: 0.07 }),
  },
];

const CONFIG_KEY = 'number-test:config';

interface SoundConfig {
  soundTheme?: string;
  volume?: number;
}

function readConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SoundConfig) : {};
  } catch {
    return {};
  }
}

function writeConfig(patch: SoundConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...readConfig(), ...patch }));
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

let currentThemeId: string = readConfig().soundTheme ?? SOUND_THEMES[0].id;
/** Volume mestre dos sons de botão (0..1). */
let currentVolume: number = readConfig().volume ?? 1;

export function getSoundThemeId(): string {
  return currentThemeId;
}

export function setSoundTheme(id: string): void {
  currentThemeId = id;
  writeConfig({ soundTheme: id });
}

export function getSoundVolume(): number {
  return currentVolume;
}

export function setSoundVolume(volume: number): void {
  currentVolume = Math.min(Math.max(volume, 0), 1);
  writeConfig({ volume: currentVolume });
}

const currentTheme = (): SoundTheme =>
  SOUND_THEMES.find((t) => t.id === currentThemeId) ?? SOUND_THEMES[0];

/** Som ao PRESSIONAR um botão (tema escolhido nas Configurações). */
export function playPress(): void {
  if (currentVolume <= 0) return;
  try {
    currentTheme().press();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}

/** Som ao SOLTAR o botão (variação do tema escolhido). */
export function playRelease(): void {
  if (currentVolume <= 0) return;
  try {
    currentTheme().release();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
