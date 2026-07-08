/** Config data-driven das linhas de produção do Reino. Para adicionar uma
    linha nova no futuro basta ligar `enabled`, definir o teto de geradores, a
    economia (ciclo/produção) e acrescentar as chaves i18n correspondentes
    (reino.line.*, reino.base.*, reino.gen.<id>.N).

    Balanceamento por linha (mesma filosofia nos ciclos e nos preços: quanto
    mais funda a linha, mais lenta e mais cara):
      linha        ciclo g1   ×ciclo   prod g1   custo g2   slope/curve
      Comida       2s         ×3       0.3       40         1.55 / 0.05
      Mineração    4s         ×4       0.4       ~80        1.85 / 0.055
      Exploração   8s         ×5       0.5       ~162       2.15 / 0.06
      Militar      16s        ×6       0.6       ~327       2.45 / 0.065
      Remédios     32s        ×7       0.7       ~661       2.75 / 0.07
    (ciclo-base e custo de entrada DOBRAM por linha; crescimento do ciclo sobe
    +1, produção-base sobe +0.1 e a escada de preços fica mais íngreme. O
    encarecimento por compra repetida é +10% fixo em tudo — BUY_GROWTH no
    engine. O 1º gerador de toda linha custa 1, então as cinco arrancam.) */

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
  { id: 'comida', enabled: true, genCount: 20, mandateCost: 1, eco: { cycleBaseS: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1, costSlope: 1.55, costCurve: 0.05 } },
  { id: 'mineracao', enabled: true, genCount: 20, mandateCost: 2, eco: { cycleBaseS: 4, cycleGrowth: 4, prodBase: 0.4, prodStep: 0.1, costSlope: 1.85, costCurve: 0.055 } },
  { id: 'exploracao', enabled: true, genCount: 20, mandateCost: 3, eco: { cycleBaseS: 8, cycleGrowth: 5, prodBase: 0.5, prodStep: 0.1, costSlope: 2.15, costCurve: 0.06 } },
  { id: 'militar', enabled: true, genCount: 20, mandateCost: 4, eco: { cycleBaseS: 16, cycleGrowth: 6, prodBase: 0.6, prodStep: 0.1, costSlope: 2.45, costCurve: 0.065 } },
  { id: 'remedios', enabled: true, genCount: 20, mandateCost: 5, eco: { cycleBaseS: 32, cycleGrowth: 7, prodBase: 0.7, prodStep: 0.1, costSlope: 2.75, costCurve: 0.07 } },
];

export const ENABLED_LINES: LineDef[] = LINES.filter((l) => l.enabled);

export const lineDefOf = (id: LineId): LineDef => LINES.find((l) => l.id === id)!;
