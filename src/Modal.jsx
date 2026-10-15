import { useEffect } from 'react';
import Ornate, { LEVELS } from './Ornate.jsx';

// something brought up over the page, in the ornate frame, which stirs a little while it is up. a click off it, or escape, puts it away
// level = how much frame it gets; --f tells what is inside how deep that is, --k where the heart of a corner lies
// tap = a click on the thing itself puts it away too: it only has something to say. side = something shown beside the frame, outside it
export default function Modal({ onShut, wide, tap, side, level = 2, children }) {
  useEffect(() => { const key = (e) => e.key === 'Escape' && onShut(); addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, [onShut]);
  return <div className="veil" style={{ '--f': `${LEVELS[level - 1].b}px`, '--k': `${LEVELS[level - 1].k}px` }} onClick={onShut}><Ornate level={level} live={0.3} className={wide ? 'frame wide' : 'frame'} onClick={(e) => tap || e.stopPropagation()}>{children}</Ornate>{side && <div className="side" onClick={(e) => e.stopPropagation()}>{side}</div>}</div>;
}
