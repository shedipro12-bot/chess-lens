import React, { useMemo, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { LEVELS } from './chessUtils.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

export default function Board({ fen, pieces, flipped, lastMove, badge, onMove, interactive = true, hintSq, arrow, shake }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(hintSq || null), [fen, hintSq]);
  const game = useMemo(() => new Chess(fen), [fen]);
  const legal = sel ? game.moves({ square: sel, verbose: true }) : [];
  const pos = sq => {
    const f = FILES.indexOf(sq[0]), r = +sq[1];
    return { x: flipped ? 7 - f : f, y: flipped ? r - 1 : 8 - r };
  };

  function click(sq) {
    if (!interactive) return;
    const m = legal.find(m => m.to === sq);
    if (sel && m) { setSel(null); onMove?.({ from: sel, to: sq, promotion: m.promotion ? 'q' : undefined }); return; }
    const p = game.get(sq);
    setSel(p && p.color === game.turn() ? sq : null);
  }

  const squares = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const file = flipped ? 7 - x : x, rank = flipped ? y + 1 : 8 - y, sq = FILES[file] + rank;
    const cls = ['sq', (file + rank) % 2 ? 'l' : 'd'];
    if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cls.push('last');
    if (sq === sel) cls.push('sel');
    const target = legal.find(m => m.to === sq);
    if (target) cls.push(game.get(sq) ? 'hint cap' : 'hint');
    if (game.inCheck() && game.get(sq)?.type === 'k' && game.get(sq).color === game.turn()) cls.push('check');
    squares.push(
      <div key={sq} className={cls.join(' ')} onClick={() => click(sq)}>
        {y === 7 && <span className="coord f">{FILES[file]}</span>}
        {x === 0 && <span className="coord r">{rank}</span>}
      </div>
    );
  }

  let arrowEl = null;
  if (arrow) {
    const a = pos(arrow.slice(0, 2)), b = pos(arrow.slice(2, 4));
    arrowEl = (
      <svg className="arrows" viewBox="0 0 8 8">
        <defs><marker id="ah" markerWidth="3" markerHeight="3" refX="1.6" refY="1.5" orient="auto"><path d="M0,0 L3,1.5 L0,3z" fill="rgba(129,182,76,.9)" /></marker></defs>
        <line x1={a.x + .5} y1={a.y + .5} x2={b.x + .5} y2={b.y + .5} stroke="rgba(129,182,76,.85)" strokeWidth=".16" strokeLinecap="round" markerEnd="url(#ah)" className="arrow-line" />
      </svg>
    );
  }

  return (
    <div className={'board' + (shake ? ' shake' : '')}>
      {squares}
      <div className="pieces">
        {pieces.map(p => {
          const { x, y } = pos(p.sq);
          return <div key={p.id} className={'piece ' + p.color} style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}>{GLYPH[p.type]}</div>;
        })}
        {badge && (() => {
          const { x, y } = pos(badge.sq);
          return <div key={badge.key || badge.sq + badge.cls} className="badge-wrap" style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}>
            <div className="badge" style={{ background: LEVELS[badge.cls].color }}>{LEVELS[badge.cls].sym}</div>
          </div>;
        })()}
      </div>
      {arrowEl}
    </div>
  );
}

export function EvalBar({ cp, mate, flipped, hidden }) {
  const pct = Math.max(3, Math.min(97, 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)));
  const txt = mate != null ? 'M' + Math.abs(mate) : (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
  return (
    <div className="evalbar" style={{ visibility: hidden ? 'hidden' : 'visible' }}>
      <div className="evalfill" style={{ height: (flipped ? 100 - pct : pct) + '%', [flipped ? 'top' : 'bottom']: 0 }} />
      <div className="evaltxt" style={{ [flipped ? 'top' : 'bottom']: 3, color: (cp >= 0) !== flipped ? '#333' : '#ddd' }}>{txt}</div>
    </div>
  );
}
