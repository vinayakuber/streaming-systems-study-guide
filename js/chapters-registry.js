// ============================================================
// Streaming Systems Chapters Registry — PARTS definition + registerChapter()
// ============================================================
// Streaming Systems: The What, Where, When, and How of Large-Scale
// Data Processing by Tyler Akidau, Slava Chernyak & Reuven Lax.
//
//   Part I : The Beam Model           (chapters 1-5)
//   Part II: Streams and Tables       (chapters 6-10)
// ============================================================

var PARTS = [
  { num: 1, label: "Part I: The Beam Model" },
  { num: 2, label: "Part II: Streams and Tables" }
];

var CHAPTERS = [];

function registerChapter(ch) {
  CHAPTERS.push(ch);
}
