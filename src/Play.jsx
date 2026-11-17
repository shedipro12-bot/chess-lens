import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from './Board.jsx';
import { createEngine } from './engine.js';
import { START, trackPieces, tryMove } from './chessUtils.js';

// 5 bots from beginner to 1800. Strength = Stockfish skill + search depth + chance of a random move.
export const BOTS = [
  { id: 'pip', name: 'Pip', rating: 400, avatar: '🐣', color: '#8bc34a', skill: 0, depth: 1, random: 0.4, blurb: 'Just learned how the pieces move. Hangs pieces a lot.' },
  { id: 'rosa', name: 'Rosa', rating: 800, avatar: '🌹', color: '#e57373', skill: 2, depth: 2, random: 0.18, blurb: 'Knows the basics, but misses simple tactics.' },
  { id: 'kai', name: 'Kai', rating: 1200, avatar: '🐴', color: '#64b5f6', skill: 5, depth: 4, random: 0.06, blurb: 'Solid club beginner. Will punish a free piece.' },
  { id: 'vera', name: 'Vera', rating: 1500, avatar: '🦉', color: '#ba68c8', skill: 9, depth: 6, random: 0.02, blurb: 'Plays sound openings and spots most tactics.' },
  { id: 'sterling', name: 'Sterling', rating: 1800, avatar: '👑', color: '#ffb74d', skill: 13, depth: 9, random: 0, blurb: 'Strong and patient. Bring your best game.' },
];

export default function Play({ onAnalyze }) {
  const [bot, setBot] = useState(null);
  const [youColor, setYouColor] = useState('w');
  const [moves, setMoves] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState({ bot: 2, color: 'w' });
  const engine = useRef(null);
  const gameId = useRef(0);

  useEffect(() => () => engine.current?.terminate(), []);
  const game = useMemo(() => { const g = new Chess(); moves.forEach(m => g.move(m.san)); return g; }, [moves]);
  const pieces = useMemo(() => trackPieces(START, moves), [moves]);

  useEffect(() => {
    if (!bot || result) return;
    if (game.isGameOver()) { setResult(outcome(game, youColor)); return; }
    if (game.turn() === youColor) return;
    const id = gameId.current; let cancelled = false;
    setThinking(true);
    (async () => {
      const t0 = Date.now();
      let mv;
      const legal = game.moves({ verbose: true });
      if (Math.random() < bot.random) {
        const caps = legal.filter(m => m.captured);
        const pool = caps.length && Math.random() < 0.5 ? caps : legal;
        mv = pool[Math.floor(Math.random() * pool.length)];
      } else {
        engine.current ??= createEngine();
        mv = await engine.current.bestMove(game.fen(), bot);
      }
      const wait = Math.max(0, 450 + Math.random() * 500 - (Date.now() - t0));
      setTimeout(() => {
        if (cancelled || id !== gameId.current) return;
        const g = new Chess(game.fen()); const m = tryMove(g, mv) || tryMove(g, legal[0]);
        setMoves(ms => [...ms, m]); setThinking(false);
      }, wait);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, bot, result]);

  function start() {
    const color = pick.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : pick.color;
    gameId.current++; setYouColor(color); setMoves([]); setResult(null); setThinking(false); setBot(BOTS[pick.bot]);
  }
  function userMove(mv) {
    if (game.turn() !== youColor || result) return;
    const g = new Chess(game.fen()); const m = tryMove(g, mv); if (m) setMoves(ms => [...ms, m]);
  }
  function analyze() {
    onAnalyze({ startFen: START, moves, flipped: youColor === 'b',
      names: youColor === 'w' ? { w: 'You', b: `${bot.name} (${bot.rating})` } : { w: `${bot.name} (${bot.rating})`, b: 'You' } });
  }

  if (!bot) return (
    <div className="botpick fade-in">
      <h2>Play against a bot</h2>
      <p className="muted">Pick an opponent from 400 to 1800, then analyse the game afterwards to see your brilliant moves and blunders.</p>
      <div className="botgrid">
        {BOTS.map((b, i) => (
          <button key={b.id} className={'botcard' + (pick.bot === i ? ' on' : '')} style={{ '--bc': b.color, animationDelay: i * 70 + 'ms' }} onClick={() => setPick(p => ({ ...p, bot: i }))}>
            <span className="avatar">{b.avatar}</span>
            <span className="bname">{b.name}</span>
            <span className="brating">{b.rating}</span>
            <span className="muted small">{b.blurb}</span>
          </button>
        ))}
      </div>
      <div className="row center">
        <span className="muted">Play as</span>
        {[['w', '♔ White'], ['r', '🎲 Random'], ['b', '♚ Black']].map(([c, l]) => (
          <button key={c} className={'btn ' + (pick.color === c ? '' : 'sec')} onClick={() => setPick(p => ({ ...p, color: c }))}>{l}</button>
        ))}
      </div>
      <button className="btn big-btn" onClick={start}>Play {BOTS[pick.bot].name} →</button>
    </div>
  );

  const rows = [];
  for (let i = 0; i < moves.length; i += 2)
    rows.push(<div className="mrow" key={i}><span className="muted">{i / 2 + 1}.</span><div className="mv">{moves[i].san}</div><div className="mv">{moves[i + 1]?.san}</div></div>);

  return (
    <div className="layout fade-in">
      <div className="boardwrap">
        <div className="evalbar ghost" />
        <div className="boardcol">
          <div className="playerbar">
            <span className="avatar sm" style={{ background: bot.color }}>{bot.avatar}</span>
            <b>{bot.name}</b><span className="muted">({bot.rating})</span>
            {thinking && <span className="thinking"><i /><i /><i /></span>}
          </div>
          <div className="relative">
            <Board fen={game.fen()} pieces={pieces} flipped={youColor === 'b'} lastMove={moves[moves.length - 1]}
              onMove={userMove} interactive={!thinking && !result && game.turn() === youColor} />
            {result && (
              <div className="overlay">
                <div className="result-card">
                  <div className="result-emoji">{result.emoji}</div>
                  <h2>{result.title}</h2>
                  <p className="muted">{result.sub}</p>
                  <button className="btn" onClick={analyze}>⚡ Analyze this game</button>
                  <button className="btn sec" onClick={start}>Rematch</button>
                  <button className="btn sec" onClick={() => setBot(null)}>Choose bot</button>
                </div>
              </div>
            )}
          </div>
          <div className="playerbar"><span className="avatar sm">🙂</span><b>You</b></div>
        </div>
      </div>
      <aside className="side">
        <h2>vs {bot.name} <span className="muted">· {bot.rating}</span></h2>
        <p className="muted small">{bot.blurb}</p>
        <div className="moves">{rows.length ? rows : <div className="muted">{youColor === 'w' ? 'Your move.' : `${bot.name} is opening…`}</div>}</div>
        <div className="row">
          <button className="btn sec" disabled={!!result || thinking || moves.length < 2} onClick={() => {
            gameId.current++; setThinking(false);
            const back = game.turn() === youColor ? 2 : 1; setMoves(ms => ms.slice(0, -back));
          }}>↶ Takeback</button>
          <button className="btn sec" disabled={!!result} onClick={() => setResult({ emoji: '🏳️', title: `${bot.name} wins`, sub: 'You resigned.' })}>Resign</button>
          <button className="btn sec" onClick={() => { gameId.current++; setBot(null); }}>Change bot</button>
          {moves.length > 0 && <button className="btn" onClick={analyze}>⚡ Analyze</button>}
        </div>
      </aside>
    </div>
  );
}

function outcome(g, you) {
  if (g.isCheckmate()) return g.turn() === you
    ? { emoji: '😵', title: 'Checkmate. You lost', sub: 'Analyse the game to find where it went wrong.' }
    : { emoji: '🏆', title: 'Checkmate. You win!', sub: 'Analyse the game to find your brilliant moves.' };
  const why = g.isStalemate() ? 'Stalemate' : g.isThreefoldRepetition() ? 'Threefold repetition' : g.isInsufficientMaterial() ? 'Insufficient material' : '50-move rule';
  return { emoji: '🤝', title: 'Draw', sub: why };
}
