/** Português (Brasil) — the source of truth for translation keys.
    Every other locale file must implement `Dict` (all keys, checked at
    compile time). */

export const pt = {
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
  'video.hint': 'Opções que aparecem no topo da tela.',
  'video.all': 'Todos os cards',
  'video.individual': 'cards individuais',
  'video.fps': 'FPS',
  'video.frameTime': 'Frame time',
  'video.battery': 'Bateria',

  // Config: Idioma
  'lang.title': 'Idioma',
  'lang.hint': 'Selecione o idioma.',

  // Botão de tela cheia (topo)
  'fullscreen.enter': 'Tela cheia',
  'fullscreen.exit': 'Sair da tela cheia',
};

export type TKey = keyof typeof pt;

/** Shape every locale file must implement. */
export type Dict = Record<TKey, string>;
