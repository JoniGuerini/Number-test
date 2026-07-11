/** Config data-driven das linhas de produção do Reino. Para adicionar uma
    linha nova no futuro basta ligar `enabled`, definir o teto de geradores, a
    economia (ciclo/produção) e acrescentar as chaves i18n correspondentes
    (reino.line.*, reino.base.*, reino.gen.<id>.N).

    Balanceamento por linha: quanto mais funda a linha, mais lento o ciclo.
    A escada de preços é universal nas cinco linhas:
    G1–G4 = 1, 10, 100, 1K; depois avança um grupo de milhar por gerador
    (1M, 1B, 1T, 1Qa...). O encarecimento por compra repetida continua em
    +10% fixo — BUY_GROWTH no engine. */

import type { LineEconomy } from './engine';

export type LineId =
  | 'comida'
  | 'mineracao'
  | 'exploracao'
  | 'militar'
  | 'remedios';

export interface LineDef {
  id: LineId;
  /** false = aba-placeholder ("em breve"), sem cadeia ainda. */
  enabled: boolean;
  /** Teto de geradores nomeados da cadeia. */
  genCount: number;
  /** Mandato exigido por compra de gerador nesta linha (universal). */
  mandateCost: number;
  /** Economia própria da cadeia (ritmo de ciclo e entrega). */
  eco: LineEconomy;
}

export const LINES: LineDef[] = [
  { id: 'comida', enabled: true, genCount: 20, mandateCost: 1, eco: { cycleBaseS: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1 } },
  { id: 'mineracao', enabled: true, genCount: 20, mandateCost: 2, eco: { cycleBaseS: 4, cycleGrowth: 4, prodBase: 0.4, prodStep: 0.1 } },
  { id: 'exploracao', enabled: true, genCount: 20, mandateCost: 3, eco: { cycleBaseS: 8, cycleGrowth: 5, prodBase: 0.5, prodStep: 0.1 } },
  { id: 'militar', enabled: true, genCount: 20, mandateCost: 4, eco: { cycleBaseS: 16, cycleGrowth: 6, prodBase: 0.6, prodStep: 0.1 } },
  { id: 'remedios', enabled: true, genCount: 20, mandateCost: 5, eco: { cycleBaseS: 32, cycleGrowth: 7, prodBase: 0.7, prodStep: 0.1 } },
];

export const ENABLED_LINES: LineDef[] = LINES.filter((l) => l.enabled);

export const lineDefOf = (id: LineId): LineDef => LINES.find((l) => l.id === id)!;
