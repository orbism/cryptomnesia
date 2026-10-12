import { useEffect, useState } from 'react';

// a door-game menu: arrows or j/k move the cursor, enter takes it, digits jump straight to an option. onPick gets the whole item
export default function Choices({ items, onPick }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const key = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = items.length, d = Number(e.key);
      if (e.key === 'ArrowDown' || e.key === 'j') setAt((i) => (i + 1) % n);
      else if (e.key === 'ArrowUp' || e.key === 'k') setAt((i) => (i + n - 1) % n);
      else if (e.key === 'Enter') onPick(items[at]);
      else if (d >= 1 && d <= n) onPick(items[d - 1]);
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [items, at, onPick]);
  return (
    <ol className="choices">
      {items.map((item, i) => (
        <li key={item[0]} className={i === at ? 'on' : ''}>
          <button type="button" onMouseEnter={() => setAt(i)} onFocus={() => setAt(i)} onClick={() => onPick(item)}>{item[0]}</button>
        </li>
      ))}
    </ol>
  );
}
