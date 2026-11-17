import { Chess } from 'chess.js';

export const LEVELS = {
  brilliant: { name: 'Brilliant', sym: '!!', color: '#1baca6' },
  great: { name: 'Great', sym: '!', color: '#5c8bb0' },
  good: { name: 'Good', sym: '✓', color: '#81b64c' },
  inaccuracy: { name: 'Inaccuracy', sym: '?!', color: '#f7c631' },
  mistake: { name: 'Mistake', sym: '?', color: '#ff8c1a' },
  blunder: { name: 'Blunder', sym: '??', color: '#e02828' },
};
export const ORDER = ['brilliant', 'great', 'good', 'inaccuracy', 'mistake', 'blunder'];
export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const START = new Chess().fen();

export const winPct = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
export const fmtEval = (cp, mate) => mate != null ? 'M' + Math.abs(mate) : (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
export const uci = m => m.from + m.to + (m.promotion || '');

export function tryMove(g, mv) {
  try { return g.move(typeof mv === 'string' ? { from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] || 'q' } : mv); }
  catch { return null; }
}

/** Replays moves and gives each piece a stable id, so the board can animate it sliding. */
export function trackPieces(startFen, moves) {
  const g = new Chess(startFen);
  const map = {}; let n = 0;
  g.board().flat().forEach(p => { if (p) map[p.square] = { id: 'p' + n++, type: p.type, color: p.color }; });
  for (const m of moves) {
    const piece = map[m.from];
    delete map[m.from];
    if (m.flags.includes('e')) delete map[m.to[0] + m.from[1]];
    map[m.to] = { ...piece, type: m.promotion || piece.type };
    const rank = m.from[1];
    if (m.flags.includes('k')) { map['f' + rank] = map['h' + rank]; delete map['h' + rank]; }
    if (m.flags.includes('q')) { map['d' + rank] = map['a' + rank]; delete map['a' + rank]; }
  }
  return Object.entries(map).map(([sq, p]) => ({ ...p, sq }));
}

function isSacrifice(fenAfter, m) {
  const v = VAL[m.piece], c = m.captured ? VAL[m.captured] : 0;
  if (v - c < 2) return false;
  const atk = new Chess(fenAfter).moves({ verbose: true }).filter(x => x.to === m.to).map(x => VAL[x.piece] || 99);
  return atk.length > 0 && Math.min(...atk) < v;
}

/** Rate a move into one of 6 levels from engine lines before (mover POV) and after (opponent POV). */
export function classify(before, after, m, fenAfter) {
  const best = before[0], second = before[1];
  const played = after ? -after[0].cp : best.cp;
  const wBest = winPct(best.cp), wPlayed = winPct(played);
  const loss = Math.max(0, wBest - wPlayed);
  const isBest = best.pv[0]?.slice(0, 4) === m.from + m.to;
  if (loss <= 2 || isBest) {
    if (isSacrifice(fenAfter, m) && wPlayed >= 50 && wBest < 97) return 'brilliant';
    if (second && isBest && wBest - winPct(second.cp) >= 15 && wBest < 97) return 'great';
    return 'good';
  }
  if (loss <= 5) return 'good';
  if (loss <= 10) return 'inaccuracy';
  if (loss <= 20) return 'mistake';
  return 'blunder';
}
export const accuracyFromLoss = l => Math.max(0, Math.min(100, 103.17 * Math.exp(-0.04354 * l) - 3.17));
