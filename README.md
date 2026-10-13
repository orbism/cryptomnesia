# Cryptomnesia

A choose-your-own-adventure horror story in 42 dithered pixel pages. Every page can be minted as an ERC-1155 edition (0.003 ETH), and the art lives fully on-chain on Ethereum: no IPFS, no server.

## How the story is built

Terms are Sam Kabo Ashwell's ([Standard Patterns in Choice-Based Games](https://heterogenoustasks.wordpress.com/2015/01/26/standard-patterns-in-choice-based-games/)).

- **Sorting Hat.** Three questions, dealt from a pack, decide which of five dispositions you are. Each opens on its own page.
- **Branching.** From there the walks fan out to 12 endings. An ending sends you back to the questions.
- **Loop and Grow.** Five roads lead back to a start page. The site counts your visits: a page you return to greets you differently and offers other ways on, and the thought line at the bottom starts to remember.

Progress is kept in the browser, not the URL, so nobody can link into the middle.

## How the art is made

Nothing is drawn by hand or stored as images. `src/engine.js` is a small procedural renderer: each scene is a function that shades every pixel into ink and two accents, then dithers it in scanlines and ordered dots. `src/pages.js` holds the pages, palettes and story graph.

`npm run pack` compresses the engine and pages into the contract's data (about 57 KB). The contract's `uri()` returns a web page that unpacks it and draws the token in the viewer's browser.

The site's frames (`src/Ornate.jsx`) and music (`src/sound.js`) are generated the same way: drawn and synthesised live, no assets.

## Run it

```
npm install
npm run dev             # local chain (needs Foundry) + contract + site
npm run dev:site        # site only, minting closed
npm run pack            # rebuild the on-chain art from src/
npm run test:contracts
npm run deploy          # asks for chain and keys; writes .env.local
```

Settings are in `.env.example`.

## Layout

- `src/` — the site (Vite + React, wagmi/viem) and the engine
- `contracts/` — the Solidity contract, tests and packed art
- `scripts/` — dev, pack, deploy
- `moodboard.html` — design board for every scene

Created and deployed by [orb](https://x.com/artoforb).
