/** Feedback sonoro sintetizado via Web Audio — sem assets externos. */

let ctx: AudioContext | null = null;

/** O AudioContext só pode nascer/tocar após um gesto do usuário; como o som
    dispara em cliques, a criação preguiçosa aqui sempre acontece num gesto. */
function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface NoiseOpts {
  dur: number;
  gain: number;
  highpass?: number;
  lowpass?: number;
}

/** Rajada de ruído branco com filtros e decay exponencial. */
function noiseBurst({ dur, gain, highpass, lowpass }: NoiseOpts): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;

  let node: AudioNode = src;
  if (highpass !== undefined) {
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = highpass;
    node.connect(f);
    node = f;
  }
  if (lowpass !== undefined) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    node.connect(f);
    node = f;
  }

  const g = ac.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  node.connect(g);
  g.connect(ac.destination);

  src.start(now);
  src.stop(now + dur);
}

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  /** Se definido, a frequência desliza até este valor ao longo do som. */
  freqEnd?: number;
  dur: number;
  gain: number;
}

/** Tom simples com envelope de decay (e glide de pitch opcional). */
function tone({ type, freq, freqEnd, dur, gain }: ToneOpts): void {
  const ac = getCtx();
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
  }

  const g = ac.createGain();
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur);
}

export interface SoundDef {
  id: string;
  name: string;
  play: () => void;
}

/** Catálogo para audição na aba Sons. */
export const SOUNDS: SoundDef[] = [
  {
    id: 'hihat-suave',
    name: 'Hi-hat suave (atual)',
    play: () => noiseBurst({ dur: 0.05, gain: 0.12, highpass: 3000, lowpass: 8000 }),
  },
  {
    id: 'hihat-fechado',
    name: 'Hi-hat fechado',
    play: () => noiseBurst({ dur: 0.025, gain: 0.15, highpass: 6000 }),
  },
  {
    id: 'tick-abafado',
    name: 'Tick abafado',
    play: () => noiseBurst({ dur: 0.04, gain: 0.3, lowpass: 1500 }),
  },
  {
    id: 'tecla',
    name: 'Tecla de máquina',
    play: () => noiseBurst({ dur: 0.02, gain: 0.35, highpass: 1000, lowpass: 4000 }),
  },
  {
    id: 'estalo',
    name: 'Estalo de madeira',
    play: () => tone({ type: 'sine', freq: 1000, freqEnd: 700, dur: 0.06, gain: 0.25 }),
  },
  {
    id: 'blip',
    name: 'Blip',
    play: () => tone({ type: 'sine', freq: 880, dur: 0.05, gain: 0.2 }),
  },
  {
    id: 'pop',
    name: 'Pop de bolha',
    play: () => tone({ type: 'sine', freq: 500, freqEnd: 150, dur: 0.09, gain: 0.3 }),
  },
  {
    id: 'pluck',
    name: 'Corda curta',
    play: () => tone({ type: 'triangle', freq: 660, dur: 0.12, gain: 0.2 }),
  },
  {
    id: 'sino',
    name: 'Sininho',
    play: () => tone({ type: 'sine', freq: 1760, dur: 0.18, gain: 0.12 }),
  },
  {
    id: 'click-classico',
    name: 'Click clássico',
    play: () => tone({ type: 'square', freq: 2000, dur: 0.015, gain: 0.12 }),
  },
];

/** Som global de clique dos botões (o escolhido da vez). */
export function playClick(): void {
  try {
    SOUNDS[0].play();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
