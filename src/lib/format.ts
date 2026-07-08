import Decimal from 'break_eternity.js';

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];

/** Trunca (não arredonda) para n casas — estilo odômetro: "0.5" só aparece
    quando o valor realmente vale 0.5. O epsilon evita que resíduo de ponto
    flutuante (0.4999...9) derrube o dígito que deveria estar completo. */
function truncTo(num: number, decimals: number): string {
  const f = 10 ** decimals;
  return (Math.floor(num * f + 1e-9) / f).toFixed(decimals);
}

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
    return Number.isInteger(num) || num >= 100
      ? Math.floor(num + 1e-9).toString()
      : truncTo(num, 1);
  }

  const exp = d.log10().toNumber();
  // Além do alcance de expoente legível, delega pro toString do Decimal ("ee42"...)
  if (!Number.isFinite(exp) || exp >= 1e15) return d.toString();

  const tier = Math.floor(exp / 3);
  const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
  const body = scaled >= 100 ? truncTo(scaled, 0) : truncTo(scaled, 1);
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier] : letterSuffix(tier - SUFFIXES.length);
  return body + suffix;
}

/** Inteiros compactos (500, 50K, 5M…) — sem casas decimais. Trocas de mandato. */
export function fmtWhole(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.sign < 0) return '-' + fmtWhole(d.neg());
  if (d.eq(0)) return '0';
  if (d.lt(1000)) return Math.floor(d.toNumber() + 1e-9).toString();

  const exp = d.log10().toNumber();
  if (!Number.isFinite(exp) || exp >= 1e15) return d.toString();

  const tier = Math.floor(exp / 3);
  const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
  const body = Math.floor(scaled + 1e-9).toString();
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier] : letterSuffix(tier - SUFFIXES.length);
  return body + suffix;
}

/** Preço de compra: mantém 2 casas decimais enquanto o valor é pequeno
    (< 1000), pra que o encarecimento em % por compra apareça no botão; acima
    disso delega pro formatador curto com sufixo (K, M…), onde os centavos
    seriam irrelevantes. */
export function fmtCost(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.lt(1000)) return truncTo(d.toNumber(), 2);
  return fmt(d);
}

/** Taxa por segundo, sempre com 1 casa quando pequena */
export function fmtRate(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.lt(1000)) {
    const num = d.toNumber();
    if (!Number.isInteger(num)) return truncTo(num, 1);
  }
  return fmt(d);
}

/** Odômetro "ao vivo" do recurso base: mais casas no corpo (13.145M) para o
    número girar visivelmente a cada entrega mesmo em magnitudes altas — com o
    fmt curto (13.1M) os incrementos pequenos não mexiam em dígito nenhum. */
export function fmtLive(n: Decimal | number): string {
  const d = n instanceof Decimal ? n : new Decimal(n);
  if (d.sign < 0) return '-' + fmtLive(d.neg());
  if (d.lt(1000)) return truncTo(d.toNumber(), 1);

  const exp = d.log10().toNumber();
  if (!Number.isFinite(exp) || exp >= 1e15) return d.toString();

  const tier = Math.floor(exp / 3);
  const scaled = d.div(Decimal.pow(10, tier * 3)).toNumber();
  const body = truncTo(scaled, scaled >= 100 ? 1 : scaled >= 10 ? 2 : 3);
  const suffix =
    tier < SUFFIXES.length ? SUFFIXES[tier] : letterSuffix(tier - SUFFIXES.length);
  return body + suffix;
}

/** Duração curta com até 2 casas quando fracionária ("0.51s", "0.6s", "12s")
    — ciclos acelerados por melhorias ficam sub-segundo e com 1 casa só,
    0.51s → 0.49s viravam ambos "0.5s" (a melhoria parecia não fazer nada).
    Casas finais em zero somem (0.60 → "0.6s", 2.00 → "2s"). Acima de 60s
    delega ao fmtTime. */
export function fmtSecondsShort(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) {
    const r = Math.round(s * 100) / 100;
    if (Number.isInteger(r)) return `${r.toFixed(0)}s`;
    const oneDecimal = Math.round(r * 10) / 10;
    return oneDecimal === r ? `${r.toFixed(1)}s` : `${r.toFixed(2)}s`;
  }
  return fmtTime(s);
}

/** Contagem regressiva do ciclo no card do gerador: SEMPRE 2 casas fixas
    ("0.50s", "11.07s") — o número gira a 60fps e, sem casas fixas, a largura
    pulava quando o zero final era cortado. Trunca (semântica de cronômetro:
    "0.00s" só no zero real). Acima de 60s delega ao fmtTime. */
export function fmtCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${truncTo(s, 2)}s`;
  return fmtTime(s);
}

/** Tempo decorrido em segundos → "45s" / "2m 05s" / "1h 12m" / "3d 07h" /
    "2y 41d" (e "1.0My" para durações absurdas, caso das estimativas fundas
    da simulação). Arredonda pra BAIXO (semântica de cronômetro): "5s" só
    aparece quando 5s reais já passaram. */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  if (d < 365) return `${d}d ${(h % 24).toString().padStart(2, '0')}h`;
  const y = Math.floor(d / 365);
  if (y >= 1000) return `${fmt(y)}y`;
  return `${y}y ${d % 365}d`;
}
