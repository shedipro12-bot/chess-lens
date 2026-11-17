import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from './Board.jsx';
import { trackPieces, tryMove, uci } from './chessUtils.js';

const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export default function Puzzles({ puzzles }) {
  const [idx, setIdx] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [moves, setMoves] = useState([]);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState({ kind: 'info', text: '' });
  const [badge, setBadge] = useState(null);
  const [hint, setHint] = useState(null);
  const [shake, setShake] = useState(false);
  const [solved, setSolved] = useState(+(ls.get('cl_solved') || 0));
  const [rating, setRating] = useState(+(ls.get('cl_rating') || 1200));
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const P = puzzles[idx % puzzles.length];
  const game = useMemo(() => { const g = new Chess(P.fen); moves.forEach(m => g.move(m.san)); return g; }, [P, moves]);
  const pieces = useMemo(() => trackPieces(P.fen, moves), [P, moves]);
  const flipped = new Chess(P.fen).turn() === 'b';

  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMoves([]); setStep(0); setFailed(false); setDone(false); setBusy(false); setBadge(null); setHint(null);
    setFb({ kind: 'info', text: `${new Chess(P.fen).turn() === 'w' ? 'White' : 'Black'} to move. Find the best move.` });
  }, [idx, P, nonce]);

  const saveScore = (s, r) => { setSolved(s); setRating(r); ls.set('cl_solved', s); ls.set('cl_rating', r); };

  function onMove(mv) {
    const g = new Chess(game.fen()); const m = tryMove(g, mv); if (!m) return;
    const expected = P.sol[step], isLast = step === P.sol.length - 1;
    const ok = uci(m).slice(0, 4) === expected.slice(0, 4) || (isLast && g.isCheckmate());
    setHint(null);
    const next = [...moves, m];
    setMoves(next);
    if (!ok) {
      setBadge({ sq: m.to, cls: 'mistake', key: Date.now() }); setBusy(true);
      setFb({ kind: 'bad', text: '✗ Not the move. Try again.' });
      setShake(true); later(() => setShake(false), 450);
      if (!failed) { setFailed(true); saveScore(solved, Math.max(100, rating - 12)); }
      later(() => { setMoves(moves); setBadge(null); setBusy(false); }, 900);
      return;
    }
    setBadge({ sq: m.to, cls: isLast ? 'brilliant' : 'great', key: Date.now() });
    if (isLast) {
      setDone(true);
      setFb({ kind: 'good', text: failed ? '✓ Solved (with a retry).' : '✓ Solved! +15 rating' });
      if (!failed) saveScore(solved + 1, rating + 15);
      return;
    }
    setFb({ kind: 'good', text: '✓ Correct! Keep going…' }); setBusy(true);
    later(() => {
      const g2 = new Chess(g.fen()); const reply = tryMove(g2, P.sol[step + 1]);
      setMoves([...next, reply]); setStep(step + 2); setBadge(null); setBusy(false);
    }, 650);
  }

  function showSolution() {
    if (done) return;
    setFailed(true); setBusy(true); setDone(true);
    let g = new Chess(game.fen()), acc = [...moves];
    P.sol.slice(step).forEach((u, i) => later(() => {
      const m = tryMove(g, u); acc = [...acc, m]; setMoves(acc); setBadge(null);
      if (i === P.sol.length - step - 1) setFb({ kind: 'info', text: 'Solution: ' + acc.slice(moves.length).map(x => x.san).join(' ') });
    }, 600 * (i + 1)));
  }

  return (
    <div className="layout fade-in" key={'pz' + idx}>
      <div className="boardwrap"><div className="evalbar ghost" /><Board fen={game.fen()} pieces={pieces} flipped={flipped}
        lastMove={moves[moves.length - 1]} badge={badge} onMove={onMove} interactive={!busy && !done} hintSq={hint} shake={shake} /></div>
      <aside className="side">
        <div className="side-head">
          <span className="pill">Puzzle {idx % puzzles.length + 1}/{puzzles.length}</span>
          {P.r ? <span className="pill dim">rated {P.r}</span> : <span className="pill accent">from your game</span>}
        </div>
        <h2>{P.t}</h2>
        <p className="muted">{P.d}</p>
        <div className={'feedback ' + fb.kind} key={fb.text}>{fb.text}</div>
        <div className="row">
          <button className="btn sec" disabled={busy || done} onClick={() => setHint(P.sol[step].slice(0, 2))}>💡 Hint</button>
          <button className="btn sec" disabled={busy || done} onClick={showSolution}>Show solution</button>
          <button className="btn sec" onClick={() => setNonce(n => n + 1)}>↺ Retry</button>
          <button className="btn" onClick={() => setIdx((idx + 1) % puzzles.length)}>Next →</button>
        </div>
        <div className="stats">
          <div><span className="big">{solved}</span><span className="muted">solved</span></div>
          <div><span className="big">{rating}</span><span className="muted">puzzle rating</span></div>
        </div>
        <p className="muted small">Mistakes and blunders from games you analyse are added here as practice puzzles.</p>
      </aside>
    </div>
  );
}
