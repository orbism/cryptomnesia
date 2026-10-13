// the engine and page data are plain scripts shared with the design board; they hang themselves on globalThis
import './engine.js';
import './pages.js';

export const DF = globalThis.DF;
export const { PAGES, QUIZ, ENTRIES, RECALL, PW, PH, pal } = globalThis.DFDATA;
// token ids follow page order, starting at 1
export const tokenId = (page) => Object.keys(PAGES).indexOf(page) + 1;
