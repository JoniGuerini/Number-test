import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { generatorBaseCost, generatorCostExponent } from './costs';
import {
  buyMaxGen,
  costOf,
  maxPurchaseQuote,
  newLine,
} from './engine';
import { ENABLED_LINES, lineDefOf } from './lines';
import { emptyUpgrades, purchaseCost } from './upgrades';

const EXPECTED_EXPONENTS = [
  0, 1, 2, 3, 6, 9, 12, 15, 18, 21,
  24, 27, 30, 33, 36, 39, 42, 45, 48, 51,
];

describe('escada universal de custos dos geradores', () => {
  it('segue 1, 10, 100, 1K e depois salta um grupo de milhar por tier', () => {
    expect(
      EXPECTED_EXPONENTS.map((_, index) => generatorCostExponent(index))
    ).toEqual(EXPECTED_EXPONENTS);

    EXPECTED_EXPONENTS.forEach((exponent, index) => {
      expect(generatorBaseCost(index).toString()).toBe(
        Decimal.pow(10, exponent).toString()
      );
    });
  });

  it('é idêntica nas cinco linhas e mantém +10% por recompra', () => {
    for (const def of ENABLED_LINES) {
      EXPECTED_EXPONENTS.forEach((exponent, index) => {
        expect(costOf(index, 0, def.eco).toString()).toBe(
          Decimal.pow(10, exponent).toString()
        );
      });
      expect(costOf(4, 1, def.eco).toString()).toBe('1100000');
    }
  });

  it('mantém a melhoria individual atrelada ao custo-base ×200', () => {
    EXPECTED_EXPONENTS.forEach((exponent, index) => {
      const expected = generatorBaseCost(index).mul(200);
      expect(
        purchaseCost({ lineId: 'comida', index }, 0).toString()
      ).toBe(expected.toString());
      expect(
        purchaseCost({ lineId: 'remedios', index }, 0).toString()
      ).toBe(expected.toString());
      expect(exponent).toBe(generatorCostExponent(index));
    });
  });
});

describe('compra máxima', () => {
  it('encontra o maior lote cujo gasto total cabe no saldo', () => {
    const quote = maxPurchaseQuote(
      new Decimal(100),
      new Decimal(11),
      100
    );
    expect(quote.count).toBe(6);
    expect(quote.totalCost.lte(100)).toBe(true);
    expect(
      new Decimal(11)
        .mul(Decimal.pow(1.1, 7).sub(1))
        .div(0.1)
        .gt(100)
    ).toBe(true);
  });

  it('compra atomicamente e respeita também o Mandato disponível', () => {
    const def = lineDefOf('comida');
    const line = newLine();
    line.started = true;
    line.steps = 12; // 3 Mandatos ganhos
    line.base = new Decimal(100);
    line.gens[0].bought = 1;
    line.gens[0].amount = new Decimal(1);

    const result = buyMaxGen(
      line,
      0,
      def.genCount,
      def.eco,
      def.id,
      emptyUpgrades(),
      { spent: 0 },
      []
    );

    expect(result.quote.count).toBe(3);
    expect(result.line.gens[0].bought).toBe(4);
    expect(result.line.gens[0].amount.toString()).toBe('4');
    expect(result.line.base.toString()).toBe(
      new Decimal(100).sub(result.quote.totalCost).toString()
    );
    expect(result.mandate.spent).toBe(3);
  });
});
