import { useEffect, useRef, useState } from 'react';
import { PAGES } from './lib.js';
import { Wallet } from './Mint.jsx';

const ends = Object.values(PAGES).filter((p) => p.end).length;

export default function Header({ shelf, onShelf, onHome }) {
  const [open, setOpen] = useState(false), [menu, setMenu] = useState(false), box = useRef(null);   // menu = the two words let down from the three bars, on a narrow screen
  useEffect(() => {
    if (!open && !menu) return;
    const shut = (e) => { if (e.key === 'Escape' || (e.type === 'pointerdown' && !box.current.contains(e.target))) { setOpen(false); setMenu(false); } };
    addEventListener('keydown', shut); addEventListener('pointerdown', shut);
    return () => { removeEventListener('keydown', shut); removeEventListener('pointerdown', shut); };
  }, [open, menu]);
  return (
    <header>
      <h1><button type="button" onClick={onHome}>Cryptomnesia</button></h1>
      <nav ref={box}>
        <button type="button" className="burger" aria-label="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button>
        <span className={menu ? 'links open' : 'links'}>
          <button type="button" className={open ? 'on' : ''} aria-expanded={open} onClick={() => { setOpen(!open); setMenu(false); }}>remind me</button>
          <span aria-hidden="true">•</span>
          <button type="button" className={shelf ? 'on' : ''} aria-pressed={shelf} onClick={() => { onShelf(); setMenu(false); }}>editions</button>
        </span>
        {open && (
          <div className="about">
            <p>Cryptomnesia is a choose-your-own-adventure style horror story. Every choice turns a page and every page is a moving picture. Any page you reach can be minted as an ERC-1155, so you can hold on to the memory forever... or let it go later. There are {ends} endings and none of them is the good one, though you may feel you have read a few of them before.</p>
            <p className="entry"><b>cryp·to·mne·sia</b> <i>noun</i><br />\ ˌkrip-tō-ˈnē-zhə \<br />: the return of a forgotten memory without its being recognised as one, so that it is taken for a new and original thought</p>
            <p><b>Fully On Chain, all of it.</b> The program that draws every page is stored once, in the contract itself. Ask the contract for a token and it answers with a small web page that unpacks that program and draws the picture in your browser. No IPFS, no server, no links out.</p>
            <p>Created and deployed by <a href="https://x.com/artoforb" target="_blank" rel="noreferrer">orb</a>, who does not remember doing either.</p>
          </div>
        )}
      </nav>
      <Wallet />
    </header>
  );
}
