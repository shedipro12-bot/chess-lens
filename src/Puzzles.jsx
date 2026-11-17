import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import Board from './Board.jsx';
import { trackPieces, tryMove, uci } from './chessUtils.js';
import { PUZZLES as FALLBACK } from './puzzles.js';

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

// Lichess theme tags -> readable names. Order = priority when picking a puzzle's title.
const THEME_NAMES = {
  mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', mateIn4: 'Mate in 4', mateIn5: 'Mate in 5',
  backRankMate: 'Back-rank mate', smotheredMate: 'Smothered mate', fork: 'Fork', pin: 'Pin', skewer: 'Skewer',
  discoveredAttack: 'Discovered attack', doubleCheck: 'Double check', sacrifice: 'Sacrifice', deflection: 'Deflection',
  attraction: 'Attraction', interference: 'Interference', clearance: 'Clearance', xRayAttack: 'X-ray attack',
  trappedPiece: 'Trapped piece', hangingPiece: 'Hanging piece', capturingDefender: 'Remove the defender',
  promotion: 'Promotion', advancedPawn: 'Advanced pawn', zugzwang: 'Zugzwang', quietMove: 'Quiet move',
  defensiveMove: 'Defensive move', intermezzo: 'In-between move', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack', endgame: 'Endgame', rookEndgame: 'Rook endgame', pawnEndgame: 'Pawn endgame',
  middlegame: 'Middlegame', opening: 'Opening', crushing: 'Winning tactic', advantage: 'Win an advantage', equality: 'Save the game',
};
const FILTERS = [
  ['all', 'All themes', () => true],
  ['mate', 'Checkmates', th => th.includes('mate')],
  ['fork', 'Forks', th => th.includes('fork')],
  ['pin', 'Pins', th => th.includes('pin')],
  ['skewer', 'Skewers', th => th.includes('skewer')],
  ['hanging', 'Hanging pieces', th => th.includes('hangingPiece')],
  ['discovered', 'Discovered attacks', th => th.includes('discoveredAttack')],
  ['sacrifice', 'Sacrifices', th => th.includes('sacrifice')],
  ['deflection', 'Deflection & attraction', th => th.includes('deflection') || th.includes('attraction')],
  ['endgame', 'Endgames', th => th.includes('endgame')],
  ['opening', 'Opening traps', th => th.includes('opening')],
];

function fromLichess(p) {
  const title = Object.keys(THEME_NAMES).find(k => p.th.includes(k));
  const tags = p.th.filter(t => THEME_NAMES[t] && t !== title).slice(0, 3);
  return { id: p.id, fen: p.fen, setup: p.m[0], sol: p.m.slice(1), r: p.r, t: THEME_NAMES[title] || 'Tactic', tags: tags.map(t => THEME_NAMES[t]), th: p.th };
}

export default function PuzzlesPage({ practice, onPracticeSolved, onPracticeRemove }) {
  const [mode, setMode] = useState('puzzles');
  const open = practice.filter(p => !p.fixed).length;
  return (
    <div className="pz-page">
      <div className="subtabs">
        <button className={mode === 'puzzles' ? 'on' : ''} onClick={() => setMode('puzzles')}>🧩 Puzzles</button>
        <button className={mode === 'mistakes' ? 'on' : ''} onClick={() => setMode('mistakes')}>🎯 My Mistakes <span className="count hot">{open}</span></button>
      </div>
      {mode === 'puzzles' ? <RatedPuzzles /> : practice.length
        ? <MistakePuzzles practice={practice} onSolved={onPracticeSolved} onRemove={onPracticeRemove} />
        : <div className="empty fade-in"><div className="empty-icon">🎯</div><h2>No mistakes yet</h2>
            <p className="muted">Play a bot or paste a game in Analyze. Every mistake and blunder you make shows up here as a puzzle, so you can practice finding the better move.</p></div>}
    </div>
  );
}

/* ---------- Lichess puzzles matched to your rating ---------- */
function RatedPuzzles() {
  const [all, setAll] = useState(null);
  const [filter, setFilter] = useState(ls.get('cl_filter') || 'all');
  const [rating, setRating] = useState(+(ls.get('cl_rating') || 1000));
  const [solvedN, setSolvedN] = useState(+(ls.get('cl_solved') || 0));
  const [streak, setStreak] = useState(0);
  const [delta, setDelta] = useState(null);
  const [cur, setCur] = useState(null);
  const done = useRef(new Set(JSON.parse(ls.get('cl_done') || '[]')));

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'puzzles.json').then(r => r.json()).then(list => setAll(list.map(fromLichess)))
      .catch(() => setAll(FALLBACK.map((p, i) => ({ ...p, id: 'local' + i, tags: [], th: [] }))));
  }, []);

  const pool = useMemo(() => all && all.filter(p => FILTERS.find(f => f[0] === filter)[2](p.th)), [all, filter]);

  const pickNext = useCallback(() => {
    if (!pool?.length) return;
    let cands = [];
    for (let w = 75; w <= 2400 && cands.length < 8; w *= 2) cands = pool.filter(p => Math.abs(p.r - rating) <= w && !done.current.has(p.id));
    if (!cands.length) { done.current.clear(); cands = pool; }
    setCur(cands[Math.floor(Math.random() * cands.length)]); setDelta(null);
  }, [pool, rating]);

  useEffect(() => { pickNext(); }, [pool]); // eslint-disable-line react-hooks/exhaustive-deps

  function onResult(success) {
    const expected = 1 / (1 + 10 ** ((cur.r - rating) / 400));
    const d = Math.round(32 * ((success ? 1 : 0) - expected)) || (success ? 1 : -1);
    const nr = Math.max(100, rating + d);
    setRating(nr); setDelta(d); ls.set('cl_rating', nr);
    if (success) { setSolvedN(n => { ls.set('cl_solved', n + 1); return n + 1; }); setStreak(s => s + 1); } else setStreak(0);
    done.current.add(cur.id); ls.set('cl_done', JSON.stringify([...done.current].slice(-1500)));
  }

  if (!all || !cur) return <div className="empty"><div className="spinner" /><p className="muted">Loading puzzles…</p></div>;
  return (
    <Trainer key={cur.id} P={cur} onResult={onResult} onNext={pickNext}
      head={<>
        <span className="pill">Puzzle rating {cur.r}</span>
        {!cur.id.startsWith('local') && <a className="pill dim link" href={`https://lichess.org/training/${cur.id}`} target="_blank" rel="noreferrer">#{cur.id}</a>}
      </>}
      footer={<>
        <div className="row">
          <label className="muted">Theme{' '}
            <select value={filter} onChange={e => { setFilter(e.target.value); ls.set('cl_filter', e.target.value); }}>
              {FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <span className="muted small">{pool.length} puzzles</span>
        </div>
        <div className="stats">
          <div><span className="big">{rating}{delta != null && <span className={'delta ' + (delta >= 0 ? 'up' : 'down')}>{delta >= 0 ? '+' : ''}{delta}</span>}</span><span className="muted">your rating</span></div>
          <div><span className="big">{solvedN}</span><span className="muted">solved</span></div>
          <div><span className="big">{streak}{streak >= 3 ? ' 🔥' : ''}</span><span className="muted">streak</span></div>
        </div>
        <p className="muted small">Puzzles from the free <a className="link" href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">Lichess puzzle database</a>, picked to match your rating.</p>
      </>} />
  );
}

/* ---------- Puzzles from your own games ---------- */
function MistakePuzzles({ practice, onSolved, onRemove }) {
  const [idx, setIdx] = useState(Math.max(0, practice.findIndex(p => !p.fixed)));
  const i = Math.min(idx, practice.length - 1);
  const P = practice[i];
  const nextUnfixed = () => { const n = practice.findIndex((p, k) => !p.fixed && k !== i); setIdx(n >= 0 ? n : (i + 1) % practice.length); };
  return (
    <Trainer key={P.fen} P={P} mine onResult={ok => ok && onSolved(P.fen)} onNext={() => setIdx((i + 1) % practice.length)}
      head={<>
        <span className="pill">{i + 1}/{practice.length}</span>
        <span className="pill accent">from your game</span>
        {P.fixed && <span className="pill good">✓ fixed</span>}
      </>}
      footer={<>
        <div className="stats">
          <div><span className="big">{practice.filter(p => p.fixed).length}</span><span className="muted">fixed</span></div>
          <div><span className="big">{practice.filter(p => !p.fixed).length}</span><span className="muted">to practice</span></div>
        </div>
        <div className="row">
          <button className="btn sec" onClick={nextUnfixed}>Next unfixed →</button>
          <button className="btn sec" onClick={() => { onRemove(P.fen); setIdx(Math.max(0, i - 1)); }}>🗑 Remove</button>
        </div>
        <p className="muted small">These come from your own games. Your puzzle rating isn't affected here.</p>
      </>} />
  );
}

/* ---------- One puzzle on the board ---------- */
function Trainer({ P, mine, onResult, onNext, head, footer }) {
  const [nonce, setNonce] = useState(0);
  const [moves, setMoves] = useState([]);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(true);
  const [fb, setFb] = useState({ kind: 'info', text: '' });
  const [badge, setBadge] = useState(null);
  const [hint, setHint] = useState(null);
  const [shake, setShake] = useState(false);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const game = useMemo(() => { const g = new Chess(P.fen); moves.forEach(m => g.move(m.san)); return g; }, [P.fen, moves]);
  const pieces = useMemo(() => trackPieces(P.fen, moves), [P.fen, moves]);
  const startTurn = new Chess(P.fen).turn();
  const solver = P.setup ? (startTurn === 'w' ? 'b' : 'w') : startTurn;

  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMoves([]); setStep(0); setFailed(false); setDone(false); setBadge(null); setHint(null);
    const side = solver === 'w' ? 'White' : 'Black';
    setFb({ kind: 'info', text: `${side} to move. ${mine ? 'Find the better move.' : 'Find the best move.'}` });
    if (P.setup) { // the opponent's move that sets up the puzzle, animated in
      setBusy(true);
      later(() => { const m = tryMove(new Chess(P.fen), P.setup); setMoves([m]); setBusy(false); }, 550);
    } else setBusy(false);
  }, [P.fen, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMove(mv) {
    const g = new Chess(game.fen()); const m = tryMove(g, mv); if (!m) return;
    const expected = P.sol[step], isLast = step === P.sol.length - 1;
    const ok = uci(m).slice(0, 4) === expected.slice(0, 4) || (isLast && g.isCheckmate());
    setHint(null);
    const before = moves, next = [...moves, m];
    setMoves(next);
    if (!ok) {
      setBadge({ sq: m.to, cls: 'mistake', key: Date.now() }); setBusy(true);
      setFb({ kind: 'bad', text: '✗ Not the move. Try again.' });
      setShake(true); later(() => setShake(false), 450);
      if (!failed) { setFailed(true); if (!mine) onResult(false); }
      later(() => { setMoves(before); setBadge(null); setBusy(false); }, 900);
      return;
    }
    setBadge({ sq: m.to, cls: isLast ? 'brilliant' : 'great', key: Date.now() });
    if (isLast) {
      setDone(true);
      if (mine) { setFb({ kind: 'good', text: '✓ Fixed! You found the better move this time.' }); onResult(true); return; }
      setFb({ kind: 'good', text: failed ? '✓ Solved, after a retry.' : '✓ Solved!' });
      if (!failed) onResult(true);
      return;
    }
    setFb({ kind: 'good', text: '✓ Correct! Keep going…' }); setBusy(true);
    later(() => {
      const reply = tryMove(new Chess(g.fen()), P.sol[step + 1]);
      setMoves([...next, reply]); setStep(step + 2); setBadge(null); setBusy(false);
    }, 650);
  }

  function showSolution() {
    if (done) return;
    if (!failed && !mine) onResult(false);
    setFailed(true); setBusy(true); setDone(true);
    const g = new Chess(game.fen()); let acc = [...moves];
    P.sol.slice(step).forEach((u, i, arr) => later(() => {
      const m = tryMove(g, u); acc = [...acc, m]; setMoves(acc); setBadge(null);
      if (i === arr.length - 1) setFb({ kind: 'info', text: 'Solution: ' + acc.slice(moves.length).map(x => x.san).join(' ') });
    }, 600 * (i + 1)));
  }

  return (
    <div className="layout fade-in">
      <div className="boardwrap"><div className="evalbar ghost" />
        <Board fen={game.fen()} pieces={pieces} flipped={solver === 'b'} lastMove={moves[moves.length - 1]} badge={badge}
          onMove={onMove} interactive={!busy && !done} hintSq={hint} shake={shake} /></div>
      <aside className="side">
        <div className="side-head">{head}</div>
        <h2>{P.t}</h2>
        {P.d ? <p className="muted">{P.d}</p> : P.tags?.length > 0 && <div className="tags">{P.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>}
        <div className={'feedback ' + fb.kind} key={fb.text}>{fb.text}</div>
        <div className="row">
          <button className="btn sec" disabled={busy || done} onClick={() => setHint(P.sol[step].slice(0, 2))}>💡 Hint</button>
          <button className="btn sec" disabled={busy || done} onClick={showSolution}>Show solution</button>
          <button className="btn sec" onClick={() => setNonce(n => n + 1)}>↺ Retry</button>
          <button className="btn" onClick={onNext}>Next →</button>
        </div>
        {footer}
      </aside>
    </div>
  );
}
