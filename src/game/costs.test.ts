import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { fmtWhole } from '../lib/format';
import { generatorBaseCost, generatorCostExponent } from './costs';
import {
  buyMaxGen,
  costOf,
  maxPurchaseQuote,
  newLine,
} from './engine';
import { ENABLED_LINES, lineDefOf } from './lines';
import { emptyUpgrades, maxUpgradeQuote, purchaseCost, tryBuyMaxUpgrade, tryBuyUpgrade } from './upgrades';
import {
  emptyMandateExchange,
  exchangeCost,
  maxExchangeQuote,
  tryExchangeMaxMandate,
} from './mandateExchange';

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

describe('compra máxima de melhorias', () => {
  it('soma a série geométrica ×2 até caber no saldo', () => {
    // Nível 0 custa 1000; 1000×(2^n−1) ≤ 7000 → n=3 (1000+2000+4000=7000).
    const quote = maxUpgradeQuote(new Decimal(7000), new Decimal(1000));
    expect(quote.count).toBe(3);
    expect(quote.totalCost.toString()).toBe('7000');
    expect(
      maxUpgradeQuote(new Decimal(6999), new Decimal(1000)).count
    ).toBe(2);
  });

  it('compra atomicamente nas cinco linhas (global) e no gerador', () => {
    const lines: Partial<Record<string, ReturnType<typeof newLine>>> = {};
    for (const def of ENABLED_LINES) {
      const line = newLine();
      line.started = true;
      line.base = new Decimal(7000);
      line.gens[0].bought = 1;
      line.gens[0].amount = new Decimal(1);
      lines[def.id] = line;
    }

    const global = tryBuyMaxUpgrade(
      lines,
      emptyUpgrades(),
      'global',
      'production'
    );
    expect(global?.quote.count).toBe(3);
    expect(global?.upgrades.global.production).toBe(3);
    for (const def of ENABLED_LINES) {
      expect(global?.lines[def.id]?.base.toString()).toBe('0');
    }

    const gen = tryBuyMaxUpgrade(
      { comida: { ...lines.comida!, base: new Decimal(7000) } },
      emptyUpgrades(),
      { lineId: 'comida', index: 0 },
      'cycle'
    );
    // gerador 1: base 200 × (2^n−1) ≤ 7000 → n=5 (200+400+800+1600+3200=6200)
    expect(gen?.quote.count).toBe(5);
    expect(gen?.upgrades.gen['comida:0:cycle']).toBe(5);
    expect(gen?.lines.comida?.base.toString()).toBe('800');
  });
});

describe('teto da chance bônus', () => {
  it('recusa compra além de 100% (global) e corta o lote no restante', () => {
    const lines: Partial<Record<string, ReturnType<typeof newLine>>> = {};
    for (const def of ENABLED_LINES) {
      const line = newLine();
      line.started = true;
      line.base = new Decimal('1e40');
      line.gens[0].bought = 1;
      line.gens[0].amount = new Decimal(1);
      lines[def.id] = line;
    }

    const atCap = {
      ...emptyUpgrades(),
      global: { ...emptyUpgrades().global, bonus: 100 },
    };
    expect(tryBuyUpgrade(lines, atCap, 'global', 'bonus')).toBeNull();
    expect(
      tryBuyUpgrade(lines, atCap, { lineId: 'comida', index: 0 }, 'bonus')
    ).toBeNull();

    const nearCap = {
      ...emptyUpgrades(),
      global: { ...emptyUpgrades().global, bonus: 97 },
    };
    const lot = tryBuyMaxUpgrade(lines, nearCap, 'global', 'bonus');
    expect(lot?.quote.count).toBe(3);
    expect(lot?.upgrades.global.bonus).toBe(100);
  });
});

describe('custo de troca em Decimal', () => {
  it('nível alto não vira Infinity de number', () => {
    const cost = exchangeCost('comida', 192);
    expect(cost.eq(0)).toBe(false);
    expect(cost.eq(Infinity)).toBe(false);
    // 500 × 100^192 = 5 × 10^386
    expect(cost.log10().floor().toNumber()).toBe(386);
    expect(fmtWhole(cost)).not.toBe('Infinity');
  });
});

describe('troca máxima de mandato', () => {
  it('soma 500 ×100^n até caber no saldo', () => {
    // 500 + 50_000 = 50_500; a próxima (5M) não cabe em 55_500.
    const quote = maxExchangeQuote(new Decimal(55_500), new Decimal(500));
    expect(quote.count).toBe(2);
    expect(quote.totalCost.toString()).toBe('50500');
  });

  it('troca atomicamente e registra cada compra no mesmo passo', () => {
    const line = newLine();
    line.started = true;
    line.base = new Decimal(55_500);
    const result = tryExchangeMaxMandate(
      { comida: line },
      emptyMandateExchange(),
      'comida',
      12
    );
    expect(result?.quote.count).toBe(2);
    expect(result?.exchange.levels.comida).toBe(2);
    expect(result?.exchange.purchases).toEqual([
      { step: 12, lineId: 'comida' },
      { step: 12, lineId: 'comida' },
    ]);
    expect(result?.lines.comida?.base.toString()).toBe('5000');
  });
});
