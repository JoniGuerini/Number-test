/** Config data-driven das linhas de produção do Reino. Para adicionar uma
    linha nova no futuro basta ligar `enabled`, definir o teto de geradores, a
    economia (ciclo/produção) e acrescentar as chaves i18n correspondentes
    (reino.line.*, reino.base.*, reino.gen.<id>.N).

    Balanceamento por linha (custo é compartilhado — curva da Comida):
      linha        ciclo g1   ×ciclo   produção g1   +produção
      Comida       2s         ×3       0.3           +0.1
      Mineração    4s         ×4       0.4           +0.1
      Exploração   8s         ×5       0.5           +0.1
      Militar      16s        ×6       0.6           +0.1
      Remédios     32s        ×7       0.7           +0.1
    (ciclo-base dobra, crescimento sobe +1 e produção-base sobe +0.1 por linha.) */

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
  /** Economia própria da cadeia (ritmo de ciclo e entrega). */
  eco: LineEconomy;
}

export const LINES: LineDef[] = [
  { id: 'comida', enabled: true, genCount: 20, eco: { cycleBaseS: 2, cycleGrowth: 3, prodBase: 0.3, prodStep: 0.1 } },
  { id: 'mineracao', enabled: true, genCount: 20, eco: { cycleBaseS: 4, cycleGrowth: 4, prodBase: 0.4, prodStep: 0.1 } },
  { id: 'exploracao', enabled: true, genCount: 20, eco: { cycleBaseS: 8, cycleGrowth: 5, prodBase: 0.5, prodStep: 0.1 } },
  { id: 'militar', enabled: true, genCount: 20, eco: { cycleBaseS: 16, cycleGrowth: 6, prodBase: 0.6, prodStep: 0.1 } },
  { id: 'remedios', enabled: true, genCount: 20, eco: { cycleBaseS: 32, cycleGrowth: 7, prodBase: 0.7, prodStep: 0.1 } },
];

export const ENABLED_LINES: LineDef[] = LINES.filter((l) => l.enabled);

export const lineDefOf = (id: LineId): LineDef => LINES.find((l) => l.id === id)!;
