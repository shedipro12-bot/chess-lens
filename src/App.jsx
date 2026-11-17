import React, { useState, useCallback } from 'react';
import Puzzles from './Puzzles.jsx';
import Analysis from './Analysis.jsx';
import Play from './Play.jsx';
import { LEVELS, ORDER } from './chessUtils.js';

const PRACTICE_KEY = 'cl_practice';
function loadPractice() {
  try { const v = JSON.parse(localStorage.getItem(PRACTICE_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}

const TABS =[['play', '♟ Play Bots'], ['puzzles', '🧩 Puzzles'], ['analyze', '⚡ Analyze']];

export default function App() {
  const [tab, setTab] = useState('play');
  const [practice, setPractice] = useState(loadPractice);
  const savePractice = next => { try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(next.slice(-150))); } catch {} return next; };
  const [incoming, setIncoming] = useState(null);
  const [toast, setToast] = useState(null);

  const addPractice = useCallback(list => {
    if (!list.length) return;
    setPractice(ps => savePractice([...ps, ...list.filter(n => !ps.some(p => p.fen === n.fen))]));
    setToast(`${list.length} mistake${list.length > 1 ? 's' : ''} added to My Mistakes`);
    setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <>
      <header>
        <h1><span className="logo">♞</span> Chess Lens</h1>
        <nav>
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
          <span className="nav-ink" style={{ transform: `translateX(${TABS.findIndex(t => t[0] === tab) * 100}%)` }} />
        </nav>
        <div className="legend">
          {ORDER.map(k => <span key={k} title={LEVELS[k].name} className="dot" style={{ background: LEVELS[k].color }}>{LEVELS[k].sym}</span>)}
        </div>
      </header>
      <main>
        <div style={{ display: tab === 'play' ? 'contents' : 'none' }}>
          <Play onAnalyze={g => { setIncoming({ ...g, at: Date.now() }); setTab('analyze'); }} />
        </div>
        {tab === 'puzzles' && <Puzzles practice={practice}
          onPracticeSolved={fen => setPractice(ps => savePractice(ps.map(p => p.fen === fen ? { ...p, fixed: true } : p)))}
          onPracticeRemove={fen => setPractice(ps => savePractice(ps.filter(p => p.fen !== fen)))} />}
        <div style={{ display: tab === 'analyze' ? 'contents' : 'none' }}>
          <Analysis incoming={incoming} onPractice={addPractice} />
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
