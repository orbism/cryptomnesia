import { useEffect, useRef, useState } from 'react';
import { PAGES } from './lib.js';
import { Wallet } from './Mint.jsx';
import { chain, contract } from './wallet.js';

const ends = Object.values(PAGES).filter((p) => p.end).length;
const scan = contract && chain.blockExplorers ? `${chain.blockExplorers.default.url}/address/${contract}` : null;   // nothing to look at on a local chain
const sea = import.meta.env.VITE_OPENSEA || null;
const ICONS = {
  x: <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  sea: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12.6 5.5v8.2M12.6 6.2l4 7.5h-4M11 8.6l-3.3 5.1H11M6.5 15.6h11c-.3 1.6-1.6 2.6-3.3 2.6H9.8c-1.7 0-3-1-3.3-2.6z" /></g>,
  scan: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.2 14.5A8.2 8.2 0 1 1 8 19.2" /><path d="M8 11v4M12 8.5V15M16 6.5V14" /></g>,
};
// a mark that goes somewhere, or, until there is somewhere for it to go, a dim one that does not
const Mark = ({ icon, href, label }) => {
  const svg = <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">{ICONS[icon]}</svg>;
  return href ? <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>{svg}</a> : <span className="soon" aria-label={`${label}: not yet`} title={`${label}: not yet`}>{svg}</span>;
};

export default function Header() {
  const [open, setOpen] = useState(false), box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const shut = (e) => { if (e.key === 'Escape' || (e.type === 'pointerdown' && !box.current.contains(e.target))) setOpen(false); };
    addEventListener('keydown', shut); addEventListener('pointerdown', shut);
    return () => { removeEventListener('keydown', shut); removeEventListener('pointerdown', shut); };
  }, [open]);
  return (
    <header>
      <h1>Cryptomnesia</h1>
      <nav ref={box}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>remind me</button>
        <Mark icon="x" href="https://x.com/artoforb" label="@artoforb on X" />
        <Mark icon="sea" href={sea} label="The collection on OpenSea" />
        <Mark icon="scan" href={scan} label="The contract on Etherscan" />
        {open && (
          <div className="about">
            <p>Cryptomnesia is a choose-your-own-adventure style horror story. Every choice turns a page and every page is a moving picture. Any page you reach can be minted as an ERC-1155, so you can hold on to the memory forever... or let it go later. There are {ends} endings and none of them is the good one, though you may feel you have read a few of them before.</p>
            <p className="entry"><b>cryp·to·mne·sia</b> <i>noun</i><br />\ ˌkrip-tō-ˈnē-zhə \<br />: the return of a forgotten memory without its being recognised as one, so that it is taken for a new and original thought</p>
            <p><b>Fully On Chain, all of it.</b> The program that draws every page is stored once, in the contract itself. Ask the contract for a token and it answers with a small web page that unpacks that program and draws the picture in your browser. No IPFS, no server, no links out.</p>
          </div>
        )}
      </nav>
      <Wallet />
    </header>
  );
}
