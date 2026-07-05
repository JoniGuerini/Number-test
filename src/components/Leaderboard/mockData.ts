/** Dados fictícios da Classificação (mock 100%). Reaproveita o elenco do
    chat (mesmos jogadores, clãs e números de perfil) e completa o top 100
    com nomes gerados de forma determinística — nada vem de servidor.

    A pontuação do ranking é a "prosperidade" do reino; posições conhecidas
    vêm de PROFILES (chat) e o resto é interpolado entre essas âncoras. */

import { ENABLED_LINES } from '../Reino/lines';
import {
  INITIAL_FRIENDS,
  PLAYERS,
  PROFILES,
  SELF_RANK,
  type RankId,
} from '../Chat/mockData';

export type LbScope = 'global' | 'amigos' | 'cla';
export const SCOPES: LbScope[] = ['global', 'amigos', 'cla'];

/** Linha usada para nomear o gerador mais alto (e o teto X/12). */
export const LB_LINE = ENABLED_LINES[0]?.id ?? 'comida';
export const LB_GEN_CAP = ENABLED_LINES[0]?.genCount ?? 12;

export const SEASON = 5;
/** Tempo restante da temporada (string pronta — mock). */
export const SEASON_ENDS = '12d 04h';
export const TOTAL_PLAYERS = 8_432;

export const YOU_POS = 121;
export const YOUR_CLAN = 'Vale Dourado';
/** Temporada em que "você" começou a jogar (mock — perfil). */
export const YOU_SEASON_JOINED = 3;

export interface LbEntry {
  pos: number;
  name: string;
  rank: RankId;
  clan: string | null;
  /** Nº do gerador mais alto desbloqueado (nome vem do i18n reino.gen.*). */
  gens: number;
  /** Trigo/s já formatado (mock). */
  wheat: string;
  /** Pontuação do ranking (prosperidade). */
  prosperity: number;
  /** Variação de posição desde ontem (+ subiu, − caiu, 0 estável). */
  delta: number;
  you?: boolean;
}

/** Variação diária dos jogadores conhecidos (mock, arbitrária). */
const ANCHOR_DELTA: Record<string, number> = {
  Yseult: 0,
  Kaelen: 0,
  Bramble: 1,
  Mirena: -2,
  Petra: 3,
  Thane: -1,
  Isolde: 5,
  Aldric: -4,
  Rowan: 2,
};

// ===== Geração determinística (mesma sequência a cada load) =====
let seed = 20260705;
const rnd = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

const PREFIX = [
  'Al', 'Bran', 'Cael', 'Dun', 'Ed', 'Fal', 'Gwen', 'Hal', 'Iv', 'Jor',
  'Kel', 'Leo', 'Mal', 'Ned', 'Os', 'Per', 'Quil', 'Rod', 'Sig', 'Tam',
  'Ulf', 'Vance', 'Wil', 'Yor',
];
const SUFFIX = [
  'bert', 'dan', 'dric', 'fred', 'gar', 'holt', 'mar', 'mond', 'ric',
  'ton', 'vas', 'wick', 'win', 'wyn',
];

const usedNames = new Set(PLAYERS.map((p) => p.name));
function genName(): string {
  for (;;) {
    const name = pick(PREFIX) + pick(SUFFIX);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
}

const CLANS = [
  'Ordem do Trigo',
  'Vale Dourado',
  'Guarda do Celeiro',
  'Foice de Prata',
  'Filhos da Colheita',
  'Sol do Feudo',
];

/** Faixas de rank/progresso por posição (para os nomes gerados). */
const rankFor = (pos: number): RankId =>
  pos <= 3 ? 'mestre'
  : pos <= 12 ? 'diamante'
  : pos <= 30 ? 'platina'
  : pos <= 70 ? 'ouro'
  : pos <= 95 ? 'prata'
  : 'bronze';

const gensFor = (pos: number): number =>
  pos <= 2 ? 12
  : pos <= 12 ? 11
  : pos <= 30 ? 10
  : pos <= 50 ? 9
  : pos <= 70 ? 8
  : pos <= 90 ? 7
  : 6;

/** Trigo/s coerente com a prosperidade (razão cai com a posição). */
const wheatFor = (prosperity: number, pos: number): string => {
  const ratio = Math.max(0.45 - pos * 0.003, 0.08);
  const w = prosperity * ratio;
  if (w >= 1e6) return `${(w / 1e6).toFixed(1)}M`;
  if (w >= 1e3) return `${Math.round(w / 1e3)}K`;
  return `${Math.round(w)}`;
};

// ===== Top 100 global =====
type AnchorInfo = Omit<LbEntry, 'pos'>;

const anchorByPos = new Map<number, AnchorInfo>();
for (const p of PLAYERS) {
  const prof = PROFILES[p.name];
  if (!prof || prof.rankPos > 100) continue;
  anchorByPos.set(prof.rankPos, {
    name: p.name,
    rank: p.rank,
    clan: prof.clan,
    gens: prof.gens,
    wheat: prof.wheat,
    prosperity: prof.prosperity,
    delta: ANCHOR_DELTA[p.name] ?? 0,
  });
}

// Pontos de interpolação: âncoras + um piso na posição 100.
const points: [number, number][] = [...anchorByPos.entries()]
  .map(([pos, a]) => [pos, a.prosperity] as [number, number])
  .sort((a, b) => a[0] - b[0]);
points.push([100, 930_000]);

function lerpProsperity(pos: number): number {
  let i = 0;
  while (i < points.length - 2 && points[i + 1][0] < pos) i++;
  const [p0, v0] = points[i];
  const [p1, v1] = points[i + 1];
  if (pos <= p0) return v0;
  if (pos >= p1) return v1;
  return v0 + ((v1 - v0) * (pos - p0)) / (p1 - p0);
}

export const GLOBAL: LbEntry[] = [];
{
  let prev = Infinity;
  for (let pos = 1; pos <= 100; pos++) {
    const anchor = anchorByPos.get(pos);
    if (anchor) {
      GLOBAL.push({ pos, ...anchor });
      prev = anchor.prosperity;
      continue;
    }
    const jitter = 1 - rnd() * 0.04;
    let v = Math.round((lerpProsperity(pos) * jitter) / 100) * 100;
    v = Math.min(v, prev - 700);
    prev = v;
    GLOBAL.push({
      pos,
      name: genName(),
      rank: rankFor(pos),
      clan: rnd() < 0.72 ? pick(CLANS) : null,
      gens: gensFor(pos),
      wheat: wheatFor(v, pos),
      prosperity: v,
      delta: Math.round(rnd() * 6 - 3),
    });
  }
}

/** Você (mock): fora do top 100, em ascensão. Nome resolvido via i18n. */
export const YOU_ENTRY: LbEntry = {
  pos: YOU_POS,
  name: '',
  rank: SELF_RANK,
  clan: YOUR_CLAN,
  gens: 8,
  wheat: '150K',
  prosperity: 838_500,
  delta: 4,
  you: true,
};

/** Amigos (mesmos do chat) + você, ordenados pela posição global. */
export const FRIENDS: LbEntry[] = [
  ...GLOBAL.filter((e) => INITIAL_FRIENDS.includes(e.name)),
  YOU_ENTRY,
].sort((a, b) => a.pos - b.pos);

/** Corvin está fora do top 100 mas é do seu clã (aparece só nessa aba). */
const CORVIN_ENTRY: LbEntry = {
  pos: PROFILES.Corvin.rankPos,
  name: 'Corvin',
  rank: 'prata',
  clan: PROFILES.Corvin.clan,
  gens: PROFILES.Corvin.gens,
  wheat: PROFILES.Corvin.wheat,
  prosperity: PROFILES.Corvin.prosperity,
  delta: 6,
};

/** Membros do seu clã no ranking (conhecidos + gerados) + você. */
export const CLAN: LbEntry[] = [
  ...GLOBAL.filter((e) => e.clan === YOUR_CLAN),
  YOU_ENTRY,
  CORVIN_ENTRY,
].sort((a, b) => a.pos - b.pos);
