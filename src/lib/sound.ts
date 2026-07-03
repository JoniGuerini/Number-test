/** Feedback sonoro sintetizado via Web Audio — sem assets externos. */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** O AudioContext só pode nascer/tocar após um gesto do usuário; como o som
    dispara em cliques, a criação preguiçosa aqui sempre acontece num gesto. */
function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Hi-hat curto: rajada de ruído branco → passa-altas → decay exponencial. */
export function playClick(): void {
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    const DUR_S = 0.05;

    if (!noiseBuffer) {
      noiseBuffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * DUR_S), ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }

    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;

    const highpass = ac.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + DUR_S);

    src.connect(highpass).connect(gain).connect(ac.destination);
    src.start(now);
    src.stop(now + DUR_S);
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
