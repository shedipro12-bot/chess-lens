// sol: alternating user/opponent moves (UCI). On the final move any checkmate is accepted too.
export const PUZZLES = [
  { t: "Scholar's Strike", d: 'White to move. Mate in 1.', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', sol: ['h5f7'], r: 800 },
  { t: 'Back Rank', d: 'White to move. Mate in 1.', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', sol: ['d1d8'], r: 900 },
  { t: "Fool's Punishment", d: 'Black to move. Mate in 1.', fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', sol: ['d8h4'], r: 850 },
  { t: 'Smothered', d: 'White to move. Mate in 1.', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', sol: ['g5f7'], r: 1100 },
  { t: 'Royal Fork', d: 'White to move and win the queen.', fen: '2q3k1/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1', sol: ['d5e7', 'g8h8', 'e7c8'], r: 1250 },
  { t: 'Rook Ladder', d: 'White to move. Mate in 2.', fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1', sol: ['a2a7', 'h8g8', 'b1b8'], r: 1150 },
];
