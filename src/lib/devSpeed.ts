/** Acelerador do jogo (ferramenta de DESENVOLVIMENTO — não existirá no
    lançamento). Cicla o relógio do Reino por 1× → 10× → 100× → 1000× → 5000×:
    acelerado, o loop arrasta o startedAt das linhas para trás ((n−1)s por
    segundo real), então o tempo de jogo anda n× mais rápido SEM encurtar os
    ciclos dos geradores (eles mantêm a duração em tempo de jogo) e sem tocar
    no motor — a contagem de passos continua derivada só da âncora,
    preservando o determinismo e o catch-up offline.

    5000× é o teto de propósito: o catch-up processa ~5 mil segundos de jogo
    por segundo real (MAX_STEPS_PER_FRAME × 5 linhas); acima disso o dial só
    acumularia dívida de simulação impagável na âncora — que é persistida no
    save junto com ela.

    Só memória: recarregar a página volta para 1×, de propósito (evita
    esquecer o save acelerado). */

export type GameSpeed = 1 | 10 | 100 | 1000 | 5000;

const CYCLE: GameSpeed[] = [1, 10, 100, 1000, 5000];

let speed: GameSpeed = 1;
const listeners = new Set<() => void>();

export const getGameSpeed = (): GameSpeed => speed;

export function toggleGameSpeed(): void {
  speed = CYCLE[(CYCLE.indexOf(speed) + 1) % CYCLE.length];
  listeners.forEach((fn) => fn());
}

export function subscribeGameSpeed(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
