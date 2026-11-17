// Stockfish 10 (asm.js) running in a Web Worker.
// Served from /public so it works offline.
const ENGINE_URL = import.meta.env.BASE_URL + 'stockfish.js';

export function createEngine() {
  const w = new Worker(ENGINE_URL);
  let handler = null, queue = Promise.resolve();
  w.onmessage = e => handler && handler(String(e.data));
  w.postMessage('uci');
  const send = c => w.postMessage(c);

  function run(fen, goCmd, opts) {
    queue = queue.then(() => new Promise(res => {
      const lines = {};
      handler = msg => {
        if (msg.startsWith('info') && msg.includes(' pv ')) {
          const mp = +(msg.match(/multipv (\d+)/) || [0, 1])[1];
          const cp = msg.match(/score cp (-?\d+)/), mt = msg.match(/score mate (-?\d+)/);
          if (!cp && !mt) return;
          const pv = msg.split(' pv ')[1].trim().split(' ');
          lines[mp] = { cp: cp ? +cp[1] : (+mt[1] > 0 ? 10000 - +mt[1] : -10000 - +mt[1]), mate: mt ? +mt[1] : null, pv };
        } else if (msg.startsWith('bestmove')) {
          handler = null;
          res({ best: msg.split(' ')[1], lines: [lines[1], lines[2]].filter(Boolean) });
        }
      };
      send(`setoption name MultiPV value ${opts.multipv || 1}`);
      send(`setoption name Skill Level value ${opts.skill ?? 20}`);
      send('position fen ' + fen);
      send(goCmd);
    }));
    return queue;
  }
  return {
    analyse: (fen, depth) => run(fen, `go depth ${depth}`, { multipv: 2 }).then(r => r.lines),
    bestMove: (fen, { skill, depth }) => run(fen, `go depth ${depth}`, { skill }).then(r => r.best),
    terminate: () => w.terminate(),
  };
}
