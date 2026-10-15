import { useState } from 'react';
import { music, wanted } from './sound.js';
import { chain, contract } from './wallet.js';

const scan = contract && chain.blockExplorers ? `${chain.blockExplorers.default.url}/address/${contract}` : null;   // nothing to look at on a local chain
const sea = import.meta.env.VITE_OPENSEA || null;
export const ICONS = {
  x: <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  sea: <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12.6 5.5v8.2M12.6 6.2l4 7.5h-4M11 8.6l-3.3 5.1H11M6.5 15.6h11c-.3 1.6-1.6 2.6-3.3 2.6H9.8c-1.7 0-3-1-3.3-2.6z" /></g>,
  scan: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.2 14.5A8.2 8.2 0 1 1 8 19.2" /><path d="M8 11v4M12 8.5V15M16 6.5V14" /></g>,
  loud: <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.5a8 8 0 0 1 0 11" /></g>,
  down: <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  hush: <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" /><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" /></g>,
};
export const Icon = ({ icon, size = 17 }) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{ICONS[icon]}</svg>;
// a mark that goes somewhere, or, until there is somewhere for it to go, a dim one that does not
const Mark = ({ icon, href, label }) => {
  const svg = <Icon icon={icon} />;
  return href ? <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>{svg}</a> : <span className="soon" aria-label={`${label}: not yet`} title={`${label}: not yet`}>{svg}</span>;
};

// the bar along the bottom: where else this lives, the music's switch, and (children) whatever the page being read adds
export default function Footer({ children }) {
  const [loud, setLoud] = useState(wanted);
  return (
    <footer>
      <Mark icon="x" href="https://x.com/artoforb" label="@artoforb on X" />
      <Mark icon="sea" href={sea} label="The collection on OpenSea" />
      <Mark icon="scan" href={scan} label="The contract on Etherscan" />
      <button type="button" aria-pressed={loud} aria-label={loud ? 'music: on' : 'music: off'} title={loud ? 'music: on' : 'music: off'} onClick={() => { music(!loud); setLoud(!loud); }}><Icon icon={loud ? 'loud' : 'hush'} /></button>
      {children}
    </footer>
  );
}
