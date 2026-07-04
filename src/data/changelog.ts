/** Notas de patch exibidas na aba Notas — a história do laboratório. */

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

/** Da mais recente para a mais antiga. */
export const CHANGELOG: PatchNote[] = [
  {
    version: 'v0.17.0',
    date: '03/07/2026',
    title: 'Ahora en español',
    notes: [
      'Third UI language: Español — full dictionary, auto-detection for Spanish systems, localized dates and default save names (Partida N).',
      'The 1.0 language trio is set: English, Português (Brasil) and Español.',
    ],
  },
  {
    version: 'v0.16.6',
    date: '03/07/2026',
    title: 'Jogos salvos',
    notes: [
      'The Portuguese UI now says "jogos salvos" instead of the English loanword "saves" — tab, titles, buttons and the default name of new saves (Jogo salvo N).',
    ],
  },
  {
    version: 'v0.16.5',
    date: '03/07/2026',
    title: 'Sound switch',
    notes: [
      'Sound tab gained an on/off switch alongside the volume slider — mute without losing your volume level.',
      'Simpler labels on the Video toggles (FPS, Frame time, Battery), grouped under an "individual cards" label.',
    ],
  },
  {
    version: 'v0.16.4',
    date: '03/07/2026',
    title: 'One switch to rule them all',
    notes: [
      'Video tab gained an "All cards" master switch at the top: turns every telemetry card on or off at once.',
    ],
  },
  {
    version: 'v0.16.3',
    date: '03/07/2026',
    title: 'Less chatter in Settings',
    notes: [
      'Settings descriptions trimmed to the essentials — shorter hints for Saves, Themes, Sound, Video and Language.',
      'The active save no longer shows a delete button (it was disabled anyway) — its card now takes the full row.',
    ],
  },
  {
    version: 'v0.16.2',
    date: '03/07/2026',
    title: 'The app speaks your language',
    notes: [
      'On first visit the UI language now follows the OS/browser language: Portuguese systems get pt-BR, everything else gets English.',
      'Picking a language in Settings still overrides the detection and is remembered on the device.',
    ],
  },
  {
    version: 'v0.16.1',
    date: '03/07/2026',
    title: 'English as the canonical language',
    notes: [
      'English is now the project\u2019s canonical language: README, page metadata, docs and — starting with this entry — the patch notes are written in English.',
      'Portuguese (Brasil) remains fully available as a UI language for players; the app still opens in pt-BR by default.',
      'Older patch notes stay in Portuguese, as the historical documents they are.',
    ],
  },
  {
    version: 'v0.16.0',
    date: '03/07/2026',
    title: 'O laboratório fala inglês',
    notes: [
      'Suporte a idiomas (i18n): toda a interface agora existe em Português e English, com dicionários próprios e chaves tipadas.',
      'Nova aba Idioma na Config para trocar a língua — a escolha fica salva no dispositivo e vale para o app inteiro.',
      'Datas e horários acompanham o idioma (dd/mm vs. mm/dd).',
      'As notas de patch permanecem no idioma original, como documentos históricos que são.',
    ],
  },
  {
    version: 'v0.15.0',
    date: '03/07/2026',
    title: 'Saves com nome próprio',
    notes: [
      'Criar um save agora abre um campo de nome já preenchido com o genérico (Save N) — é só apagar e batizar como quiser antes de confirmar.',
      'Todo save pode ser renomeado: o campo fica no painel expandido, junto das outras opções.',
      'Enter confirma, Esc cancela a criação.',
      'Refinos: o filete de foco do campo de nome não é mais cortado na esquerda, e o input de renomear ganhou um fundo mais claro dentro do painel escuro.',
      'Botões pressionados agora afundam 1px fixo em vez de encolher em porcentagem — botões largos não recuam mais de forma exagerada.',
      'O filete de foco do input agora é cor sólida de verdade: a sombra interna do baixo relevo escurecia o topo dele, dando impressão de gradiente.',
      'O ✕ de excluir e a setinha de expandir viraram ícones desenhados (SVG): como caracteres de texto, cada sistema usava uma fonte diferente e os tamanhos divergiam entre macOS e Windows.',
    ],
  },
  {
    version: 'v0.14.0',
    date: '03/07/2026',
    title: 'Saves com calma',
    notes: [
      'Clicar num save não troca mais na hora: abre um painel abaixo dele com as opções de carregar e de zerar cada modo.',
      'Os botões de zerar progresso saíram da seção solta e agora vivem dentro do save escolhido, lado a lado — dá até para zerar um modo de um save inativo.',
      'Os botões de carregar e de criar save usam o mesmo estilo dos botões de compra dos Geradores, com texto centralizado.',
      'Criar um novo save também ficou mais calmo: ele entra na lista sem assumir o lugar do atual; carregue quando quiser.',
    ],
  },
  {
    version: 'v0.13.x',
    date: '03/07/2026',
    title: 'Aba Temas e faixas exorcizadas',
    notes: [
      'Config ganhou a aba Temas: cada tema virou um card pintado com as próprias cores, com um mini-mockup de interface dentro.',
      'O tema ativo fica em destaque no topo; os disponíveis se organizam lado a lado, quebrando linha conforme a coleção cresce.',
      'Tabs da Config agora ocupam a largura toda, e o conteúdo das abas também — os cards de tema aproveitam o espaço no desktop.',
      'O tema ativo perdeu o anel de destaque: a posição no topo já conta a história.',
      'Cards de tema agora têm largura fixa — o ativo parou de esticar pela tela toda.',
      'O app lembra em qual página você estava: dar refresh não te devolve mais para os Ciclos.',
      'Corrigidas as faixas de pretos diferentes no Chrome/macOS: um micro-ruído imperceptível no fundo força todos os blocos de pintura pelo mesmo caminho de rasterização.',
    ],
  },
  {
    version: 'v0.12.0',
    date: '03/07/2026',
    title: 'Atividade para os dois modos',
    notes: [
      'A Atividade ganhou abas Ciclos e Geradores — o log de desbloqueios agora cobre os dois modos.',
      'O card do gerador nos Geradores perdeu a coluna de desbloqueio (a informação vive na Atividade) e o grid foi redistribuído.',
      'Modo sem desbloqueios mostra um convite com botão para começar a jogar dali mesmo.',
    ],
  },
  {
    version: 'v0.11.x',
    date: '03/07/2026',
    title: 'Verde musgo e amostras',
    notes: [
      'Quarto tema: base verde-musgo escura com amarelo queimado (mostarda) nos acentos.',
      'O seletor de temas ganhou amostras de cores (fundo, card, acento, texto) ao lado de cada nome.',
    ],
  },
  {
    version: 'v0.10.0',
    date: '03/07/2026',
    title: 'Creme terracota',
    notes: [
      'Terceiro tema, agora claro: fundos em areia/creme, tintas em marrons quentes, terracota queimada como acento e sombras recalibradas para superfície clara.',
    ],
  },
  {
    version: 'v0.9.0',
    date: '03/07/2026',
    title: 'Sistema de temas',
    notes: [
      'Paleta de cores escolhível na Config (aba Vídeo): Dark neutro ou Azul meia-noite, com aplicação instantânea e persistência no dispositivo.',
    ],
  },
  {
    version: 'v0.8.0',
    date: '03/07/2026',
    title: 'Dark neutro',
    notes: [
      'Teste de paleta: a base azulada deu lugar a pretos e cinzas puros — dark mode de verdade, mantendo a hierarquia de profundidade (fundo → cards → superfícies) e o latão como acento.',
    ],
  },
  {
    version: 'v0.7.2 – v0.7.3',
    date: '03/07/2026',
    title: 'Canaleta calibrada',
    notes: [
      'A parte vazia da barra de ciclo foi calibrada num meio-termo: visível sem roubar atenção do preenchimento.',
    ],
  },
  {
    version: 'v0.7.1',
    date: '03/07/2026',
    title: 'Setinhas honestas',
    notes: [
      'Corrige as setinhas de navegação que às vezes ficavam visíveis (e inertes) mesmo com a lista já no fim — o estado das bordas envelhecia quando a virtualização mudava a altura do conteúdo sem evento de scroll.',
    ],
  },
  {
    version: 'v0.7.0',
    date: '03/07/2026',
    title: 'Notas de patch',
    notes: [
      'Nova aba Notas com o histórico de versões do laboratório — esta página.',
    ],
  },
  {
    version: 'v0.6.x',
    date: '03/07/2026',
    title: 'Barra de ciclo interna',
    notes: [
      'A fitinha de 3px na borda dos cards dos Ciclos virou uma barra interna dedicada, com canaleta em baixo relevo e preenchimento em alto relevo.',
      'Cantos achatados no padrão dos cards e espessura calibrada em audições sucessivas.',
    ],
  },
  {
    version: 'v0.5.x',
    date: '03/07/2026',
    title: 'Config de gente grande',
    notes: [
      'Config virou painel único com tabs internas: Saves, Som e Vídeo.',
      'Aba Vídeo estreia os toggles de telemetria: cards de FPS, frame time e bateria podem ser desligados.',
      'Switches deslizantes com relevo físico (canaleta afundada, bolinha flutuando).',
      'Slider de volume repaginado: pegador em pill, trilho em baixo relevo, preenchimento em alto relevo e halo no hover.',
    ],
  },
  {
    version: 'v0.4.x',
    date: '03/07/2026',
    title: 'Saves múltiplos',
    notes: [
      'Sistema de slots de save: crie, troque e exclua saves sem perder progresso — cada slot guarda os três modos.',
      'Migração automática do save antigo para o "Save 1", com sincronia bit a bit preservada.',
      'Zerar por modo passou a morar junto dos saves.',
    ],
  },
  {
    version: 'v0.3.0',
    date: '03/07/2026',
    title: 'Virtualização',
    notes: [
      'Cards fora da janela de scroll (e de abas ocultas) viram fantasmas de mesma altura: com 80+ geradores, o frame rate subiu de ~135fps para o teto do monitor (180fps).',
      'Simulação, sincronia e saves intocados — só a renderização emagreceu.',
    ],
  },
  {
    version: 'v0.2.x',
    date: '03/07/2026',
    title: 'Identidade de versão',
    notes: [
      'Pill de versão no hub, alimentada pelo carimbo do build.',
      'Detector de deploy pendente: a pill vira o botão "Nova versão pendente" quando o servidor tem build mais novo (version.json consultado a cada 60s, sem backend).',
      'Contador ganhou o hub completo: início do save, tempo e Exportar CSV.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '02/07/2026',
    title: 'A fundação',
    notes: [
      'Contador de formatação com break_eternity.js: sufixos K…No, letras infinitas (aa…zz, aaa…) e truncamento estilo odômetro.',
      'Geradores em cadeia contínua com desbloqueio progressivo, modo automático e curva de custos tunada por simulação.',
      'Ciclos: produção em rajadas com ciclos progressivos (5s × N) — e a descoberta de que rajadas nunca alcançam o contínuo.',
      'Atividade: log de desbloqueios com tempos explicados e ritmo colorido.',
      'Sincronia bit a bit entre máquinas: timestep fixo determinístico ancorado no relógio, com catch-up offline.',
      'Telemetria (FPS, frame time, bateria, ambiente), export CSV para balanceamento e wake lock.',
      'Som de clique sintetizado (o "Toc", garimpado de um bug alheio) com par pressionar/soltar e volume.',
      'Visual portado do design system do Coders, responsivo até no iPhone, com deploy contínuo na Vercel.',
    ],
  },
];
