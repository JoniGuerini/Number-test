# Number Test

Laboratório de mecânicas de jogo idle: formatação de números gigantes com
[break_eternity.js](https://github.com/Patashu/break_eternity.js), produção em
cadeia, balanceamento medido por dados e sincronia determinística entre
dispositivos.

O visual (fontes Fraunces + JetBrains Mono, tokens de cor, botões) é portado do
design system do projeto **Coders** — com as fontes auto-hospedadas via
Fontsource (sem CDN externo).

## As abas

- **Contador** — o playground original de formatação: um número que cresce
  0.1/s, botão de dobrar a produção (com auto-repeat ao segurar) e a escada de
  sufixos K/M/B/T... até `No`, seguida de sufixos de letras infinitos
  (`aa`...`zz`, `aaa`...) com truncamento estilo odômetro.
- **Geradores** — cadeia de produção contínua: o gerador N produz 0.1/s do
  nível N−1 por unidade, até chegar ao número base, que compra novos geradores
  (custo `10^(i + 0.004·i²)`, dobrando por compra). Desbloqueio progressivo,
  modo automático para testes de balanceamento e barra de progresso de custo.
- **Ciclos** — mesma cadeia, mas em rajadas: o gerador N entrega o lote inteiro
  ao completar um ciclo de `5s × N` (média equivalente à dos Geradores; a
  disparidade de progressão entre as duas mecânicas é característica estudada —
  ver `scripts/compare-engines.mjs`).
- **Atividade** — log dos desbloqueios dos Ciclos com resumo (total, tempo de
  jogo, intervalo médio) e cada tempo explicado, com o ritmo colorido
  (mais lento em vermelho, mais rápido em verde).
- **Config** — volume do som dos botões (click sintetizado via Web Audio, com
  par pressionar/soltar) e o zerar individual de cada modo.

## Arquitetura de simulação

- **Timestep fixo determinístico**: os jogos avançam em passos de 0.25s
  ancorados no timestamp de início do save. O estado é função pura do número de
  passos — duas máquinas com saves iniciados juntos ficam bit a bit idênticas,
  com a aba aberta, oculta ou fechada.
- **Catch-up pelo relógio de parede**: fechar/recarregar não perde tempo; o
  jogo simula os passos pendentes ao voltar (progresso offline incluso).
- **Extrapolação visual**: a lógica roda a 4 passos/s, mas o display anda a
  cada frame interpolando com a produção corrente.
- **Virtualização das listas**: cards fora da janela de scroll (e de abas
  ocultas) viram fantasmas de mesma altura — listas com centenas de geradores
  mantêm o frame rate no teto do monitor.

## Telemetria e utilidades

- Pills de FPS, frame time (média/máx), ambiente (localhost/produção), bateria
  (quando existe) e versão do app, com aviso de **nova versão pendente** via
  `version.json` publicado a cada build.
- Export CSV por aba (valores brutos + formatados) para análise de
  balanceamento.
- Saves em `localStorage` (isolados por origem), com autosave 1x/s e no
  fechamento da página. Wake lock mantém a tela acordada durante o jogo.

## Rodando

```bash
npm install
npm run dev
```

Scripts de estudo (Node): `node scripts/simulate-balance.mjs` (tuning da curva
de custos) e `node scripts/compare-engines.mjs` (contínuo vs. rajadas).

## Stack

- Vite 5 + React 18 + TypeScript
- break_eternity.js para os números
- CSS Modules + tokens globais (`src/styles/`)
- Sem backend: tudo estático

## Deploy (Vercel)

O projeto é detectado automaticamente como Vite pela Vercel (build
`npm run build`, output `dist`). Cada push na `main` gera deploy — o carimbo de
build injetado via `define` alimenta a pill de versão e a detecção de
atualização pendente.
