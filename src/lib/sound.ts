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
  delay?: number;
}

/** Rajada de ruído branco com filtros e decay exponencial. */
function noiseBurst({ dur, gain, highpass, lowpass, delay = 0 }: NoiseOpts): void {
  const ac = getCtx();
  const start = ac.currentTime + delay;

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
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  node.connect(g);
  g.connect(ac.destination);

  src.start(start);
  src.stop(start + dur);
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
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);

  node.connect(g);
  g.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur);
}

export interface SoundDef {
  id: string;
  name: string;
  group: string;
  play: () => void;
}

const S = (id: string, name: string, group: string, play: () => void): SoundDef => ({
  id,
  name,
  group,
  play,
});

/* eslint-disable prettier/prettier */
/** Catálogo para audição na aba Sons. */
export const SOUNDS: SoundDef[] = [
  // ===== Ruído / percussão =====
  S('hihat-suave', 'Hi-hat suave (atual)', 'Ruído', () => noiseBurst({ dur: 0.05, gain: 0.12, highpass: 3000, lowpass: 8000 })),
  S('hihat-fechado', 'Hi-hat fechado', 'Ruído', () => noiseBurst({ dur: 0.025, gain: 0.15, highpass: 6000 })),
  S('hihat-seco', 'Hi-hat seco', 'Ruído', () => noiseBurst({ dur: 0.035, gain: 0.13, highpass: 4000, lowpass: 10000 })),
  S('chispa', 'Chispa', 'Ruído', () => noiseBurst({ dur: 0.015, gain: 0.2, highpass: 8000 })),
  S('areia', 'Areia', 'Ruído', () => noiseBurst({ dur: 0.08, gain: 0.18, highpass: 500, lowpass: 3000 })),
  S('sopro', 'Sopro', 'Ruído', () => noiseBurst({ dur: 0.12, gain: 0.08, highpass: 1000, lowpass: 4000 })),
  S('tick-abafado', 'Tick abafado', 'Ruído', () => noiseBurst({ dur: 0.04, gain: 0.3, lowpass: 1500 })),
  S('tecla', 'Tecla de máquina', 'Ruído', () => noiseBurst({ dur: 0.02, gain: 0.35, highpass: 1000, lowpass: 4000 })),
  S('papel', 'Papel', 'Ruído', () => noiseBurst({ dur: 0.03, gain: 0.2, highpass: 1500, lowpass: 5000 })),
  S('estatico', 'Estático', 'Ruído', () => noiseBurst({ dur: 0.06, gain: 0.1, highpass: 2000, lowpass: 6000 })),

  // ===== Clicks tonais =====
  S('click-classico', 'Click clássico', 'Clicks', () => tone({ type: 'square', freq: 2000, dur: 0.015, gain: 0.12 })),
  S('click-medio', 'Click médio', 'Clicks', () => tone({ type: 'square', freq: 1400, lowpass: 3000, dur: 0.015, gain: 0.15 })),
  S('click-abafado', 'Click abafado', 'Clicks', () => tone({ type: 'square', freq: 900, lowpass: 1800, dur: 0.015, gain: 0.2 })),
  S('click-surdo', 'Click surdo', 'Clicks', () => tone({ type: 'triangle', freq: 600, lowpass: 1200, dur: 0.02, gain: 0.3 })),
  S('click-oco', 'Click oco', 'Clicks', () => tone({ type: 'square', freq: 400, lowpass: 900, dur: 0.025, gain: 0.35 })),
  S('click-fino', 'Click fino', 'Clicks', () => tone({ type: 'square', freq: 3000, lowpass: 6000, dur: 0.01, gain: 0.08 })),
  S('click-fino-grave', 'Click fino grave', 'Clicks', () => tone({ type: 'square', freq: 1600, lowpass: 3200, dur: 0.01, gain: 0.14 })),
  S('click-vidro', 'Click de vidro', 'Clicks', () => tone({ type: 'sine', freq: 2400, dur: 0.02, gain: 0.15 })),
  S('tec-tec', 'Tec-tec (duplo)', 'Clicks', () => {
    tone({ type: 'square', freq: 1200, lowpass: 2500, dur: 0.012, gain: 0.15 });
    tone({ type: 'square', freq: 1200, lowpass: 2500, dur: 0.012, gain: 0.12, delay: 0.06 });
  }),

  // ===== Pops / gotas =====
  S('pop-bolha', 'Pop de bolha', 'Pops', () => tone({ type: 'sine', freq: 500, freqEnd: 150, dur: 0.09, gain: 0.3 })),
  S('pop-grave', 'Pop grave', 'Pops', () => tone({ type: 'sine', freq: 300, freqEnd: 80, dur: 0.1, gain: 0.35 })),
  S('pop-seco', 'Pop seco', 'Pops', () => tone({ type: 'sine', freq: 700, freqEnd: 250, dur: 0.05, gain: 0.3 })),
  S('gota', 'Gota', 'Pops', () => tone({ type: 'sine', freq: 1200, freqEnd: 400, dur: 0.07, gain: 0.2 })),
  S('gota-aguda', 'Gota aguda', 'Pops', () => tone({ type: 'sine', freq: 2000, freqEnd: 800, dur: 0.05, gain: 0.15 })),
  S('boing', 'Boing curto', 'Pops', () => tone({ type: 'triangle', freq: 400, freqEnd: 90, dur: 0.12, gain: 0.25 })),
  S('subida', 'Subida', 'Pops', () => tone({ type: 'sine', freq: 440, freqEnd: 880, dur: 0.05, gain: 0.2 })),
  S('salto', 'Salto', 'Pops', () => tone({ type: 'sine', freq: 200, freqEnd: 600, dur: 0.06, gain: 0.25 })),

  // ===== Blips / beeps =====
  S('blip', 'Blip', 'Blips', () => tone({ type: 'sine', freq: 880, dur: 0.05, gain: 0.2 })),
  S('blip-grave', 'Blip grave', 'Blips', () => tone({ type: 'sine', freq: 440, dur: 0.05, gain: 0.25 })),
  S('blip-agudo', 'Blip agudo', 'Blips', () => tone({ type: 'sine', freq: 1320, dur: 0.04, gain: 0.15 })),
  S('blip-retro', 'Blip retrô', 'Blips', () => tone({ type: 'square', freq: 660, lowpass: 4000, dur: 0.04, gain: 0.12 })),
  S('blip-duplo', 'Blip duplo', 'Blips', () => {
    tone({ type: 'sine', freq: 880, dur: 0.03, gain: 0.18 });
    tone({ type: 'sine', freq: 1100, dur: 0.03, gain: 0.15, delay: 0.05 });
  }),
  S('beep-curto', 'Beep curto', 'Blips', () => tone({ type: 'triangle', freq: 990, dur: 0.035, gain: 0.2 })),
  S('pip', 'Pip', 'Blips', () => tone({ type: 'sine', freq: 1760, dur: 0.02, gain: 0.12 })),

  // ===== Cordas / plucks =====
  S('corda-curta', 'Corda curta', 'Cordas', () => tone({ type: 'triangle', freq: 660, dur: 0.12, gain: 0.2 })),
  S('corda-grave', 'Corda grave', 'Cordas', () => tone({ type: 'triangle', freq: 330, dur: 0.15, gain: 0.25 })),
  S('corda-aguda', 'Corda aguda', 'Cordas', () => tone({ type: 'triangle', freq: 990, dur: 0.1, gain: 0.15 })),
  S('harpa', 'Harpa', 'Cordas', () => tone({ type: 'sine', freq: 1320, dur: 0.16, gain: 0.12 })),
  S('baixo', 'Baixo', 'Cordas', () => tone({ type: 'sawtooth', freq: 220, lowpass: 800, dur: 0.1, gain: 0.2 })),
  S('marimba', 'Marimba', 'Cordas', () => tone({ type: 'sine', freq: 520, dur: 0.09, gain: 0.3 })),

  // ===== Graves / batidas =====
  S('toc-mesa', 'Toc de mesa', 'Graves', () => tone({ type: 'sine', freq: 150, freqEnd: 60, dur: 0.06, gain: 0.4 })),
  S('tambor', 'Tambor', 'Graves', () => tone({ type: 'sine', freq: 120, freqEnd: 50, dur: 0.15, gain: 0.5 })),
  S('madeira-grave', 'Madeira grave', 'Graves', () => tone({ type: 'triangle', freq: 260, freqEnd: 200, lowpass: 600, dur: 0.05, gain: 0.35 })),
  S('batida', 'Batida', 'Graves', () => tone({ type: 'square', freq: 100, lowpass: 300, dur: 0.08, gain: 0.5 })),
  S('coracao', 'Coração', 'Graves', () => tone({ type: 'sine', freq: 80, freqEnd: 40, dur: 0.12, gain: 0.6 })),

  // ===== Sinos / pings =====
  S('sininho', 'Sininho', 'Sinos', () => tone({ type: 'sine', freq: 1760, dur: 0.18, gain: 0.12 })),
  S('sino-grave', 'Sino grave', 'Sinos', () => tone({ type: 'sine', freq: 880, dur: 0.25, gain: 0.15 })),
  S('ping', 'Ping', 'Sinos', () => tone({ type: 'sine', freq: 2640, dur: 0.12, gain: 0.08 })),
  S('cristal', 'Cristal', 'Sinos', () => tone({ type: 'sine', freq: 3520, dur: 0.1, gain: 0.06 })),
  S('ding-dong', 'Ding-dong', 'Sinos', () => {
    tone({ type: 'sine', freq: 1320, dur: 0.15, gain: 0.12 });
    tone({ type: 'sine', freq: 990, dur: 0.2, gain: 0.12, delay: 0.12 });
  }),
];
/* eslint-enable prettier/prettier */

/** Som global de clique dos botões (o escolhido da vez). */
export function playClick(): void {
  try {
    SOUNDS[0].play();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
