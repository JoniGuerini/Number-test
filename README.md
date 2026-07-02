# Number Test

Playground para testar formatação de números grandes com
[break_eternity.js](https://github.com/Patashu/break_eternity.js).

O visual (fontes Fraunces + JetBrains Mono, tokens de cor, botões e modal)
é portado do design system do projeto **Coders**.

## O que tem

- Um modal com um contador que começa em `0`.
- Botão **Start/Pause**: enquanto rodando, o número cresce **0.1 por segundo**
  (tick via `requestAnimationFrame`, com delta de tempo real).
- Botão **Reset** para zerar.
- Formatação via `src/lib/format.ts` (mesma função `fmt` do Coders:
  sufixos K/M/B/T... e notação científica além disso).

## Rodando

```bash
npm install
npm run dev
```

## Stack

- Vite 5 + React 18 + TypeScript
- break_eternity.js para os números
- CSS Modules + tokens globais (`src/styles/`)

## Deploy (Vercel)

O projeto é detectado automaticamente como Vite pela Vercel:

- Build command: `npm run build`
- Output directory: `dist`

Basta importar o repositório em [vercel.com/new](https://vercel.com/new) e fazer o deploy sem configuração extra.
