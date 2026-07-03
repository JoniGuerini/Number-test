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
    version: 'v0.11.0',
    date: '03/07/2026',
    title: 'Verde musgo',
    notes: [
      'Quarto tema: base verde-musgo escura com amarelo queimado (mostarda) nos acentos.',
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
