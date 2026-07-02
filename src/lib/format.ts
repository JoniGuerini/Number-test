import Decimal from 'break_eternity.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];

/** Sufixo de letras infinito: 0='aa'...'az', 26='ba'...675='zz',
    676='aaa'...'zzz', depois 'aaaa' e assim por diante. */
function letterSuffix(index: number): string {
  let len = 2;
  let count = 26 ** len;
  let i = index;
  while (i >= count) {
    i -= count;
    len++;
    count = 26 ** len;
  }
  let s = '';
  for (let k = 0; k < len; k++) {
    s = String.fromCharCode(97 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

/** Formata número grande com sufixo curto (1.2K... 5.6No) e, a partir de onde
    seria o decilhão (10^33), sufixos de letras sem fim (1.2aa... zz, aaa...).
    Aceita Decimal ou number. */
export function fmt(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.sign < 0) return '-' + fmt(d.neg());
  if (d.eq(0)) return '0';

  if (d.lt(1000)) {
    const num = d.toNumber();
    return Number.isInteger(num) || num >= 100 ? Math.floor(num).toString() : num.toFixed(1);
  }

  const exp = d.log10().toNumber();
  // Além do alcance de expoente legível, delega pro toString do Decimal ("ee42"...)
  if (!Number.isFinite(exp) || exp >= 1e15) return d.toString();

  const tier = Math.floor(exp / 3);
  const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
  const body = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier] : letterSuffix(tier - SUFFIXES.length);
  return body + suffix;
}

export function fmtMoney(n: Decimal | number): string {
  return '$ ' + fmt(n);
}

/** Taxa por segundo, sempre com 1 casa quando pequena */
export function fmtRate(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.lt(1000)) {
    const num = d.toNumber();
    if (!Number.isInteger(num)) return num.toFixed(1);
  }
  return fmt(d);
}

/** Duração em segundos → "2m 05s" / "45s" / "1h 12m" */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
}
