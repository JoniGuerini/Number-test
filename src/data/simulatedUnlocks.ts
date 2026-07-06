/** GERADO por `node scripts/simulate-reino.mjs deep` — não editar à mão.

    Tempos de desbloqueio (uptime, em segundos) do modo automático
    estrito, por linha, simulados passo a passo num horizonte de
    1500 anos — alimenta a aba Simulada da Atividade. Geradores
    que não saem nesse horizonte ficam de fora (sem extrapolação).
    O motor é determinístico, então isto vale para qualquer save no
    automático. Regenere sempre que o balanceamento mudar. */

import type { LineId } from '../components/Reino/lines';

export const SIM_HORIZON_YEARS = 1500;

export const SIMULATED_UNLOCKS: Record<LineId, number[]> = {
  comida: [0, 86, 396, 1078, 2386, 4758, 8986, 16420, 29348, 51822, 90668, 156996, 270372, 463972, 787652, 1346232, 2297100, 3907990, 6627404, 11189856],
  mineracao: [0, 220, 1240, 4216, 11168, 26152, 58244, 123444, 255036, 517512, 1038876, 2076076, 4156840, 8187832, 15967996, 30819088, 59086584, 112598120, 214632272, 404165036],
  exploracao: [0, 512, 4048, 16464, 50736, 136256, 344384, 827440, 1957496, 4471648, 10167520, 22623120, 49906016, 109952248, 237717544, 513415304, 1086695648, 2284397952, 4780001416, 9881362992],
  militar: [0, 1424, 13952, 64432, 230176, 711056, 1986720, 5384512, 14189120, 36030768, 90736096, 224797840, 547178688, 1323362480, 3166971104, 7403663872, 17234076704, 39723680288],
  remedios: [0, 4000, 46880, 251264, 1008800, 3495392, 10984288, 32620736, 94179488, 265469216, 726748256, 1969197664, 5283640608, 13861191104, 36116134752],
};
