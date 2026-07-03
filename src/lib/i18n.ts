/** Internacionalização: dicionários pt/en, idioma persistido em localStorage
    e hook reativo no mesmo padrão das prefs (useSyncExternalStore).

    Uso: const { t } = useI18n(); t('nav.contador'); t('saves.reset', { game: '...' }) */

import { useSyncExternalStore } from 'react';

export type Locale = 'pt' | 'en';

const LOCALE_KEY = 'number-test:locale';

/** Nomes dos idiomas em si mesmos (autônimos) — não se traduzem. */
export const LOCALES: { id: Locale; name: string }[] = [
  { id: 'pt', name: 'Português (Brasil)' },
  { id: 'en', name: 'English' },
];

/* ============================================================
   Dicionário base (pt) — a fonte de verdade das chaves
   ============================================================ */
const pt = {
  // Navegação principal (rodapé) — também nomeia os modos pelo app todo
  'nav.contador': 'Contador',
  'nav.geradores': 'Geradores',
  'nav.ciclos': 'Ciclos',
  'nav.atividade': 'Atividade',
  'nav.notas': 'Notas',
  'nav.config': 'Config',

  // Compartilhado entre os modos de jogo
  'common.exportCsv': 'Exportar CSV',
  'common.start': 'Iniciar',
  'common.startLabel': 'início',
  'common.time': 'tempo',
  'common.produced': 'produzido',
  'common.toStart': 'Ir para o começo',
  'common.toEnd': 'Ir para o fim',

  // Contador
  'counter.double': 'Dobrar produção',
  'counter.pause': 'Pausar',

  // Tela de escolha de modo (Geradores/Ciclos)
  'mode.title': 'Modo de jogo',
  'mode.manual': 'Manual',
  'mode.auto': 'Automático',
  'mode.hintAuto':
    'O jogo compra sozinho 1 unidade de cada gerador assim que alcançar o custo.',
  'mode.hintManual': 'Você faz todas as compras manualmente.',

  // Geradores / Ciclos
  'gen.autoToggle': 'Automático: {state}',
  'gen.baseNumber': 'número base',
  'gen.owns': 'possui',
  'gen.produces': 'produz {target}',
  'cyc.cycleEvery': 'ciclo {time}',
  'cyc.perCycleSuffix': '/ ciclo',

  // Atividade (log de desbloqueios)
  'activity.empty': 'Nenhum desbloqueio registrado no modo {game} ainda.',
  'activity.cta': 'Começar a jogar {game}',
  'activity.unlocked': 'geradores desbloqueados',
  'activity.playTime': 'tempo de jogo',
  'activity.avgInterval': 'média do “tempo desde o anterior”',
  'activity.sinceLast': 'desde o último',
  'activity.generator': 'Gerador {n}',
  'activity.unlockedWith': 'desbloqueado com',
  'activity.ofPlay': '{time} de jogo',
  'activity.sincePrev': 'tempo desde o anterior',
  'activity.gameStart': 'início do jogo',
  'activity.pace': 'ritmo vs. desbloqueio anterior',
  'activity.samePace': 'mesmo ritmo',
  'activity.slower': 'mais lento',
  'activity.faster': 'mais rápido',

  // Cardzinhos de telemetria do topo
  'fps.production': 'produção',
  'fps.max': 'máx',
  'fps.newVersion': 'Nova versão pendente',

  // Config: tabs
  'tab.saves': 'Salvos',
  'tab.temas': 'Temas',
  'tab.som': 'Som',
  'tab.video': 'Vídeo',
  'tab.idioma': 'Idioma',

  // Config: Saves
  'saves.title': 'Jogos salvos',
  'saves.hint': 'Seus jogos salvos.',
  'saves.active': 'ativo',
  'saves.load': 'Carregar jogo salvo',
  'saves.reset': 'Zerar {game}',
  'saves.rename': 'Renomear',
  'saves.create': 'Criar novo jogo salvo +',
  'saves.confirmCreate': 'Criar',
  'saves.cancel': 'Cancelar',
  'saves.deleteAria': 'Excluir {name}',
  'saves.nameAria': 'Nome do {name}',
  'saves.newNameAria': 'Nome do novo jogo salvo',
  'saves.defaultName': 'Jogo salvo {n}',

  // Config: Temas
  'themes.title': 'Temas',
  'themes.hint': 'Biblioteca de temas.',
  'themes.active': 'tema ativo',
  'themes.available': 'disponíveis',
  'theme.neutro': 'Dark neutro',
  'theme.midnight': 'Azul meia-noite',
  'theme.creme': 'Creme terracota',
  'theme.verde': 'Verde musgo',

  // Config: Som
  'sound.title': 'Som',
  'sound.hint': 'Som do click dos botões.',
  'sound.enabled': 'Som',
  'sound.volumeAria': 'Volume do som dos botões',

  // Config: Vídeo
  'video.title': 'Telemetria',
  'video.hint': 'Escolha o que aparece no topo da tela.',
  'video.all': 'Todos os cards',
  'video.individual': 'cards individuais',
  'video.fps': 'FPS',
  'video.frameTime': 'Frame time',
  'video.battery': 'Bateria',

  // Config: Idioma
  'lang.title': 'Idioma',
  'lang.hint': 'Selecione o idioma.',
};

export type TKey = keyof typeof pt;

/* ============================================================
   English
   ============================================================ */
const en: Record<TKey, string> = {
  'nav.contador': 'Counter',
  'nav.geradores': 'Generators',
  'nav.ciclos': 'Cycles',
  'nav.atividade': 'Activity',
  'nav.notas': 'Notes',
  'nav.config': 'Settings',

  'common.exportCsv': 'Export CSV',
  'common.start': 'Start',
  'common.startLabel': 'started',
  'common.time': 'time',
  'common.produced': 'produced',
  'common.toStart': 'Go to the top',
  'common.toEnd': 'Go to the end',

  'counter.double': 'Double production',
  'counter.pause': 'Pause',

  'mode.title': 'Game mode',
  'mode.manual': 'Manual',
  'mode.auto': 'Automatic',
  'mode.hintAuto':
    'The game buys 1 unit of each generator on its own as soon as the cost is reached.',
  'mode.hintManual': 'You make every purchase yourself.',

  'gen.autoToggle': 'Auto: {state}',
  'gen.baseNumber': 'base number',
  'gen.owns': 'owns',
  'gen.produces': 'produces {target}',
  'cyc.cycleEvery': 'cycle {time}',
  'cyc.perCycleSuffix': '/ cycle',

  'activity.empty': 'No unlocks recorded in {game} mode yet.',
  'activity.cta': 'Start playing {game}',
  'activity.unlocked': 'generators unlocked',
  'activity.playTime': 'play time',
  'activity.avgInterval': 'average of “time since previous”',
  'activity.sinceLast': 'since the last one',
  'activity.generator': 'Generator {n}',
  'activity.unlockedWith': 'unlocked at',
  'activity.ofPlay': '{time} of play',
  'activity.sincePrev': 'time since previous',
  'activity.gameStart': 'game start',
  'activity.pace': 'pace vs. previous unlock',
  'activity.samePace': 'same pace',
  'activity.slower': 'slower',
  'activity.faster': 'faster',

  'fps.production': 'production',
  'fps.max': 'max',
  'fps.newVersion': 'New version pending',

  'tab.saves': 'Saves',
  'tab.temas': 'Themes',
  'tab.som': 'Sound',
  'tab.video': 'Video',
  'tab.idioma': 'Language',

  'saves.title': 'Saves',
  'saves.hint': 'Your saved games.',
  'saves.active': 'active',
  'saves.load': 'Load save',
  'saves.reset': 'Reset {game}',
  'saves.rename': 'Rename',
  'saves.create': 'Create new save +',
  'saves.confirmCreate': 'Create',
  'saves.cancel': 'Cancel',
  'saves.deleteAria': 'Delete {name}',
  'saves.nameAria': 'Name of {name}',
  'saves.newNameAria': 'New save name',
  'saves.defaultName': 'Save {n}',

  'themes.title': 'Themes',
  'themes.hint': 'Theme library.',
  'themes.active': 'active theme',
  'themes.available': 'available',
  'theme.neutro': 'Neutral dark',
  'theme.midnight': 'Midnight blue',
  'theme.creme': 'Terracotta cream',
  'theme.verde': 'Moss green',

  'sound.title': 'Sound',
  'sound.hint': 'Button click sound.',
  'sound.enabled': 'Sound',
  'sound.volumeAria': 'Button sound volume',

  'video.title': 'Telemetry',
  'video.hint': 'Choose what appears at the top of the screen.',
  'video.all': 'All cards',
  'video.individual': 'individual cards',
  'video.fps': 'FPS',
  'video.frameTime': 'Frame time',
  'video.battery': 'Battery',

  'lang.title': 'Language',
  'lang.hint': 'Select the language.',
};

const DICTS: Record<Locale, Record<TKey, string>> = { pt, en };

/* ============================================================
   Store (mesmo padrão de prefs.ts)
   ============================================================ */

/** Best match for the OS/browser language (first visit only). */
function detectLocale(): Locale {
  const langs = navigator.languages ?? [navigator.language];
  for (const lang of langs) {
    if (lang?.toLowerCase().startsWith('pt')) return 'pt';
    if (lang?.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'pt' || stored === 'en') return stored;
  } catch {
    // No localStorage — fall through to detection
  }
  // No explicit choice yet: follow the OS/browser language
  return detectLocale();
}

let locale: Locale = readStored();
const listeners = new Set<() => void>();

function applyLocale(l: Locale): void {
  document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
}

applyLocale(locale);

export function getLocale(): Locale {
  return locale;
}

export function setLocale(l: Locale): void {
  locale = l;
  try {
    localStorage.setItem(LOCALE_KEY, l);
  } catch {
    // Sem localStorage — vale só pra sessão
  }
  applyLocale(l);
  listeners.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Locale de datas (toLocaleString) correspondente ao idioma da UI. */
export function getDateLocale(): string {
  return locale === 'pt' ? 'pt-BR' : 'en-US';
}

/** Tradução pura (sem reatividade) — para uso fora de componentes. */
export function translate(
  key: TKey,
  params?: Record<string, string | number>
): string {
  let s = DICTS[locale][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

/** Hook reativo: componentes re-renderizam quando o idioma muda. */
export function useI18n() {
  const current = useSyncExternalStore(subscribeLocale, getLocale);
  const t = (key: TKey, params?: Record<string, string | number>): string => {
    let s = DICTS[current][key];
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };
  return { t, locale: current };
}
