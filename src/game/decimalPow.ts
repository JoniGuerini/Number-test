/** Potência inteira por multiplicação. `number ** n` vira Infinity cedo;
    `Decimal.pow` usa ln/exp e deixa resíduo. */

import Decimal from 'break_eternity.js';

export const decimalPowInt = (base: Decimal, exp: number): Decimal => {
  let result = new Decimal(1);
  let b = new Decimal(base);
  let e = Math.max(0, Math.floor(exp));
  while (e > 0) {
    if (e % 2 === 1) result = result.mul(b);
    b = b.mul(b);
    e = Math.floor(e / 2);
  }
  return result;
};

export const isFiniteDecimal = (d: Decimal): boolean => {
  const s = d.toString();
  return s !== 'Infinity' && s !== '-Infinity' && s !== 'NaN';
};

/** Aceita save antigo (number) ou string; Infinity/NaN viram 0. */
export const finiteDecimal = (v: string | number | undefined): Decimal => {
  const d = new Decimal(v ?? 0);
  return isFiniteDecimal(d) && d.sign >= 0 ? d : new Decimal(0);
};
