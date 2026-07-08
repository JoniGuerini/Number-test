/** Catálogo de sub-recursos por linha de produção (10 por linha).

    Cada linha gera o recurso base (trigo, carvão, mapas…) e, via mecânica
    futura, também estes sub-recursos mais raros. Por ora só o catálogo e a UI
    — sem save nem motor. */

import type { LineId } from './lines';

/** Identificador estável do sub-recurso dentro da linha (slug). */
export type SubResourceSlug = string;

export const SUBRESOURCES_BY_LINE: Record<LineId, readonly SubResourceSlug[]> = {
  comida: [
    'farinha',
    'pao',
    'cerveja',
    'queijo',
    'sal',
    'mel',
    'vinho',
    'oleo',
    'especiarias',
    'banquete',
  ],
  mineracao: [
    'ferro',
    'cobre',
    'estanho',
    'bronze',
    'prata',
    'ouro',
    'aco',
    'gemas',
    'cristal',
    'pedra_estrela',
  ],
  exploracao: [
    'trilhas',
    'atalhos',
    'marco',
    'ruinas',
    'cavernas',
    'artefatos',
    'reliquias',
    'tesouros',
    'segredos',
    'incognita',
  ],
  militar: [
    'lanceiros',
    'arqueiros',
    'cavalaria',
    'escudeiros',
    'besteiros',
    'cavaleiros',
    'veteranos',
    'elite',
    'campeoes',
    'legiao',
  ],
  remedios: [
    'cataplasma',
    'tintura',
    'elixir',
    'antidoto',
    'balsamo',
    'unguento',
    'essencia',
    'panaceia',
    'quintessencia',
    'vida_longa',
  ],
};

export const subResourcesOf = (lineId: LineId): readonly SubResourceSlug[] =>
  SUBRESOURCES_BY_LINE[lineId];
