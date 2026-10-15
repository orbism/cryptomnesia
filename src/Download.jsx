import { useState } from 'react';
import { Icon } from './Footer.jsx';
import { gif } from './gif.js';

// the page as a looping GIF. it takes a moment to draw, and says so. label = the words beside the arrow (none, and the arrow is all there is); tail puts the arrow after them
export default function Download({ page, colors, name, className = 'save', label = 'download', size = 15, tail }) {
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.stopPropagation();
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));                                // let the word change before the drawing holds everything up
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await gif(page, colors)); a.download = `${name}.gif`; a.click(); URL.revokeObjectURL(a.href);
    setBusy(false);
  };
  return <button type="button" className={className} disabled={busy} aria-label="download as a GIF" title={busy ? 'drawing…' : 'download as a GIF'} onClick={save}>{tail || <Icon icon="down" size={size} />}{label && (busy ? 'drawing…' : label)}{tail && <Icon icon="down" size={size} />}</button>;
}
