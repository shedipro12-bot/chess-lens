import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import Board, { EvalBar } from './Board.jsx';
import { createEngine } from './engine.js';
import { LEVELS, ORDER, START, classify, accuracyFromLoss, fmtEval, trackPieces, tryMove, winPct } from './chessUtils.js';

const SAMPLE = `[Event "Opera Game"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const sanOf = (fen, u) => (u ? tryMove(new Chess(fen), u)?.san : null);
const GOODISH = ['good', 'great', 'brilliant'];

export default function Analysis({ incoming, onPractice }) {
  const [startFen, setStartFen] = useState(START);
  const [moves, setMoves] = useState([]);
  const [pos, setPos] = useState(0);
  const [res, setRes] = useState([]);
  const [startEval, setStartEval] = useState(null);
  const [pgn, setPgn] = useState('');
  const [depth, setDepth] = useState(12);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [status, setStatus] = useState('Paste a PGN, or play moves on the board, then press Analyze.');
  const [flipped, setFlipped] = useState(false);
  const [names, setNames] = useState({ w: 'White', b: 'Black' });
  const engine = useRef(null);
  const listRef = useRef(null);

  useEffect(() => () => engine.current?.terminate(), []);
  useEffect(() => {
    if (!incoming) return;
    setStartFen(incoming.startFen); setMoves(incoming.moves); setPos(incoming.moves.length); setPgn('');
    setNames(incoming.names || { w: 'White', b: 'Black' }); setFlipped(!!incoming.flipped);
    run(incoming.startFen, incoming.moves);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const game = useMemo(() => { const g = new Chess(startFen); moves.slice(0, pos).forEach(m => g.move(m.san)); return g; }, [startFen, moves, pos]);
  const pieces = useMemo(() => trackPieces(startFen, moves.slice(0, pos)), [startFen, moves, pos]);
  const cur = res[pos - 1];
  const last = moves[pos - 1];

  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') setPos(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPos(p => Math.min(moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);
  useEffect(() => { listRef.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [pos, res]);

  function freeMove(mv) {
    if (busy) return;
    const g = new Chess(game.fen()); const m = tryMove(g, mv); if (!m) return;
    const next = [...moves.slice(0, pos), m];
    setMoves(next); setPos(next.length); setRes([]);
  }

  async function run(sf, mvs) {
    if (!mvs.length) { setStatus('No moves to analyse.'); return; }
    engine.current ??= createEngine();
    setBusy(true); setRes([]);
    const g = new Chess(sf); const fens = [g.fen()];
    for (const m of mvs) { g.move(m.san); fens.push(g.fen()); }
    const evals = [];
    for (let i = 0; i < fens.length; i++) {
      setStatus(`Analysing position ${i + 1} of ${fens.length}…`); setProg((100 * i) / fens.length);
      const t = new Chess(fens[i]);
      if (t.isCheckmate()) evals.push([{ cp: -10000, mate: 0, pv: [] }]);
      else if (t.isGameOver()) evals.push([{ cp: 0, mate: null, pv: [] }]);
      else evals.push(await engine.current.analyse(fens[i], depth));
    }
    setProg(100);
    const out = mvs.map((m, i) => {
      const sign = new Chess(fens[i + 1]).turn() === 'w' ? 1 : -1;
      return {
        cls: classify(evals[i], evals[i + 1], m, fens[i + 1]), color: m.color,
        fenBefore: fens[i], best: evals[i][0], evalW: sign * evals[i + 1][0].cp, mate: evals[i + 1][0].mate,
        loss: Math.max(0, winPct(evals[i][0].cp) - winPct(-evals[i + 1][0].cp)),
      };
    });
    const se = evals[0][0];
    setStartEval({ cp: new Chess(sf).turn() === 'w' ? se.cp : -se.cp, mate: se.mate });
    setRes(out); setBusy(false);
    const practice = out.map((r, i) => ({ r, i }))
      .filter(({ r }) => (r.cls === 'mistake' || r.cls === 'blunder') && r.best.pv[0])
      .map(({ r, i }) => ({
        t: `From your game · move ${Math.floor(i / 2) + 1}`,
        d: `${r.color === 'w' ? 'White' : 'Black'} to move. In the game ${mvs[i].san} was a ${r.cls}. Find the better move.`,
        fen: r.fenBefore, sol: [r.best.pv[0]], r: 0,
      }));
    onPractice(practice);
    setStatus(`Analysis complete.${practice.length ? ` ${practice.length} practice puzzle${practice.length > 1 ? 's' : ''} added to Puzzles.` : ''}`);
  }

  function analyzeClick() {
    if (busy) return;
    if (pgn.trim()) {
      const g = new Chess();
      try { g.loadPgn(pgn.trim()); } catch { setStatus('Could not read that PGN.'); return; }
      const h = g.header(); const sf = h.FEN || START; const mvs = g.history({ verbose: true });
      setNames({ w: h.White || 'White', b: h.Black || 'Black' });
      setStartFen(sf); setMoves(mvs); setPos(mvs.length); run(sf, mvs);
    } else run(startFen, moves);
  }

  const summary = useMemo(() => {
    if (!res.length) return null;
    const c = { w: {}, b: {} }, a = { w: [], b: [] };
    res.forEach(r => { c[r.color][r.cls] = (c[r.color][r.cls] || 0) + 1; a[r.color].push(accuracyFromLoss(r.loss)); });
    const acc = k => (a[k].length ? (a[k].reduce((x, y) => x + y, 0) / a[k].length).toFixed(1) : '–');
    return { c, acc: { w: acc('w'), b: acc('b') } };
  }, [res]);

  const evalNow = cur ? { cp: cur.evalW, mate: cur.mate } : (pos === 0 && startEval) || { cp: 0, mate: null };
  const blackFirst = new Chess(startFen).turn() === 'b';
  const cells = moves.map((m, i) => {
    const r = res[i];
    return (
      <div key={i} className={'mv' + (i + 1 === pos ? ' cur' : '')} onClick={() => setPos(i + 1)}>
        {r && <span className="dot pop" style={{ background: LEVELS[r.cls].color, animationDelay: `${i * 20}ms` }}>{LEVELS[r.cls].sym}</span>}
        {m.san}
      </div>
    );
  });
  if (blackFirst) cells.unshift(<div key="x" />);
  const rows = [];
  for (let i = 0; i < cells.length; i += 2)
    rows.push(<div className="mrow" key={i}><span className="muted">{i / 2 + 1}.</span>{cells[i]}{cells[i + 1] || <div />}</div>);

  const bestSan = cur && sanOf(cur.fenBefore, cur.best.pv[0]);
  return (
    <div className="layout fade-in">
      <div className="boardwrap">
        <EvalBar cp={evalNow.cp} mate={evalNow.mate} flipped={flipped} />
        <Board fen={game.fen()} pieces={pieces} flipped={flipped} lastMove={last} onMove={freeMove} interactive={!busy}
          badge={cur && last ? { sq: last.to, cls: cur.cls, key: 'a' + pos } : null}
          arrow={cur && !GOODISH.includes(cur.cls) ? cur.best.pv[0] : null} />
      </div>
      <aside className="side">
        <h2>Game Analysis</h2>
        <textarea value={pgn} onChange={e => setPgn(e.target.value)} placeholder="Paste a PGN here… (or play moves on the board)" />
        <div className="row">
          <button className="btn" disabled={busy} onClick={analyzeClick}>{busy ? 'Analysing…' : '⚡ Analyze'}</button>
          <button className="btn sec" onClick={() => setPgn(SAMPLE)}>Sample game</button>
          <label className="muted">Depth{' '}
            <select value={depth} onChange={e => setDepth(+e.target.value)}>{[10, 12, 14, 16].map(d => <option key={d}>{d}</option>)}</select>
          </label>
        </div>
        <div className="progress"><div style={{ width: prog + '%' }} /></div>
        <div className="muted small">{status}</div>
        {summary && (
          <div className="summary fade-in">
            <div /><div className="h">{names.w}</div><div className="h">{names.b}</div>
            <div><b>Accuracy</b></div><div className="accnum">{summary.acc.w}</div><div className="accnum">{summary.acc.b}</div>
            {ORDER.map(k => (
              <React.Fragment key={k}>
                <div className="lbl"><span className="dot" style={{ background: LEVELS[k].color }}>{LEVELS[k].sym}</span>{LEVELS[k].name}</div>
                <div>{summary.c.w[k] || 0}</div><div>{summary.c.b[k] || 0}</div>
              </React.Fragment>
            ))}
          </div>
        )}
        {cur && last && (
          <div className="moveinfo fade-in" key={pos} style={{ borderColor: LEVELS[cur.cls].color }}>
            <b style={{ color: LEVELS[cur.cls].color }}>
              {last.san} is {/^[aeiou]/i.test(LEVELS[cur.cls].name) ? 'an' : 'a'} {LEVELS[cur.cls].name.toLowerCase()} move
            </b>
            <span className="muted"> · eval {fmtEval(cur.evalW, cur.mate)}</span>
            {bestSan && bestSan !== last.san && <div className="muted">Best was <b>{bestSan}</b></div>}
          </div>
        )}
        <div className="moves" ref={listRef}>{rows.length ? rows : <div className="muted">No moves yet.</div>}</div>
        <div className="row nav">
          <button className="btn sec" onClick={() => setPos(0)}>⏮</button>
          <button className="btn sec" onClick={() => setPos(p => Math.max(0, p - 1))}>◀</button>
          <button className="btn sec" onClick={() => setPos(p => Math.min(moves.length, p + 1))}>▶</button>
          <button className="btn sec" onClick={() => setPos(moves.length)}>⏭</button>
          <button className="btn sec" onClick={() => setFlipped(f => !f)}>⇅ Flip</button>
          <button className="btn sec" disabled={busy}
            onClick={() => { setMoves([]); setPos(0); setRes([]); setStartFen(START); setStartEval(null); setPgn(''); setProg(0); setStatus('New board. Play moves or paste a PGN.'); }}>New</button>
        </div>
      </aside>
    </div>
  );
}
