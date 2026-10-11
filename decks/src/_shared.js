// _shared.js — the settings every chapter deck shares, so a pronunciation fixed once is
// fixed in every deck. Voice and timing are the template's own defaults; only sayAs grows.
module.exports = {
  theme: 'light',
  voice: {
    preferred: 'Google UK English Male',
    fallbackLangs: ['en-GB', 'en'],
    rate: { google: 0.98, microsoft: 1.0, other: 0.95 },
    pitch: 1.0,
    sentencePauseMs: 320,
    questionPauseMs: 420,
    // Template rule 4: the voice never reads an acronym, code or symbol. The bar may show
    // the short form; these are what is said instead. The engine replaces plain substrings
    // in order, so a key must never occur inside another key's text.
    sayAs: {
      'e.g.': 'for example', '&': 'and', '→': ' to ', '·': ', ', '×': ' times ', '≈': 'about ',
      'OLTP': 'O L T P', 'OLAP': 'oh-lap', 'SQL': 'sequel', 'LIMIT': 'limit',
      'SUM': 'sum', 'ORC': 'O R C', 'RLE': 'run-length encoding', 'ID': 'I D', 'CPU': 'C P U'
    }
  },
  auto: { afterSpeechMs: 700, minStepMs: 5200, msPerChar: 62, firstStepDelayMs: 1200 },
  legend: { main: 'in use', change: 'the stage being costed', new: 'added by this design', ext: 'outside this chapter' }
};
