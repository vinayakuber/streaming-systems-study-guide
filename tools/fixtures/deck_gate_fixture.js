// deck_gate_fixture.js — the known-good deck tools/test_deck_gate.py mutates. Frozen to plain
// data (links and the code listing resolved once), so the same fixture runs in every study-guide
// repo regardless of that repo's chapters.
module.exports = {
 "title": "OLAP 101",
 "eyebrow": "OLAP · Chapter 1",
 "theme": "light",
 "voice": {
  "preferred": "Google UK English Male",
  "fallbackLangs": [
   "en-GB",
   "en"
  ],
  "rate": {
   "google": 0.98,
   "microsoft": 1,
   "other": 0.95
  },
  "pitch": 1,
  "sentencePauseMs": 320,
  "questionPauseMs": 420,
  "sayAs": {
   "e.g.": "for example",
   "&": "and",
   "→": " to ",
   "·": ", ",
   "×": " times ",
   "≈": "about ",
   "OLTP": "O L T P",
   "OLAP": "oh-lap",
   "SQL": "sequel",
   "LIMIT": "limit",
   "SUM": "sum",
   "ORC": "O R C",
   "RLE": "run-length encoding",
   "ID": "I D",
   "CPU": "C P U"
  }
 },
 "auto": {
  "afterSpeechMs": 700,
  "minStepMs": 5200,
  "msPerChar": 62,
  "firstStepDelayMs": 1200
 },
 "legend": {
  "main": "in use",
  "change": "the stage being costed",
  "new": "added by this design",
  "ext": "outside this chapter"
 },
 "sources": {
  "ch": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md",
   "Chapter 1 on GitHub"
  ],
  "obj": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#learning-objectives",
   "Chapter 1 · learning objectives"
  ],
  "layout": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#oltp-vs-olap--two-opposite-access-patterns",
   "Chapter 1 · OLTP vs OLAP"
  ],
  "query": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#the-shape-of-an-analytics-query",
   "Chapter 1 · the shape of a query"
  ],
  "write": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#read-optimized-vs-write-optimized--the-fundamental-tradeoff",
   "Chapter 1 · the write tradeoff"
  ],
  "sd": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#system-design-interview",
   "Chapter 1 · system design"
  ],
  "iq": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#interview-questions",
   "Chapter 1 · interview questions"
  ],
  "kc": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#key-concepts",
   "Chapter 1 · key concepts"
  ],
  "quiz": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#quiz",
   "Chapter 1 · quiz"
  ],
  "take": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#key-takeaways",
   "Chapter 1 · key takeaways"
  ],
  "links": [
   "https://github.com/vinayakuber/olap-system-design-study-guide/blob/main/docs/ch01-olap-101-the-analytics-workload.md#links--the-bigger-picture",
   "Chapter 1 · links to later chapters"
  ],
  "cstore": [
   "https://www.vldb.org/conf/2005/papers/p553-stonebraker.pdf",
   "Stonebraker et al. — C-Store (VLDB 2005)"
  ],
  "pinot": [
   "https://docs.pinot.apache.org/basics/concepts",
   "Apache Pinot documentation — Concepts"
  ],
  "dremel": [
   "https://research.google/pubs/pub36632/",
   "Melnik et al. — Dremel"
  ],
  "clickhouse": [
   "https://clickhouse.com/docs/en/optimize/sparse-primary-indexes",
   "ClickHouse documentation — columnar storage"
  ]
 },
 "slides": [
  {
   "title": "Ch 1",
   "layout": "title",
   "eyebrow": "01 · OLAP 101 · the analytics workload",
   "heading": "One fork in the road decides everything else.",
   "hero": {
    "step": 0,
    "text": "A transaction system touches whole <b>rows</b>; an analytics system scans whole <b>columns</b>. This chapter measures that fork on one small table, then follows it into the shape of a query, the cost of a write, and a full system.[[src:ch]]"
   },
   "tiles": [
    {
     "step": 1,
     "value": 32,
     "label": "rows in the example table[[src:layout]]"
    },
    {
     "step": 1,
     "value": 50,
     "label": "columns in every row[[src:layout]]"
    },
    {
     "step": 1,
     "value": 2,
     "suffix": " of 50",
     "label": "columns the analytics question needs[[src:layout]]"
    },
    {
     "step": 1,
     "value": 4500,
     "label": "clicks for campaign c1 — the answer, whichever layout[[src:layout]]"
    }
   ],
   "cardsLabel": "The chapter · four parts",
   "cards": [
    {
     "step": 2,
     "n": 1,
     "title": "Two access patterns",
     "text": "Rows versus columns, measured on the same 32 rows.[[src:layout]]"
    },
    {
     "step": 2,
     "n": 2,
     "title": "The shape of a query",
     "text": "Filter, group, aggregate, order — and what each one costs.[[src:query]]"
    },
    {
     "step": 3,
     "n": 3,
     "title": "The write bill",
     "text": "Why one insert becomes 50 writes, and how batching divides it.[[src:write]]"
    },
    {
     "step": 3,
     "n": 4,
     "title": "A system for both",
     "text": "A click dashboard over a billion rows, built on that split.[[src:sd]]"
    }
   ],
   "note": {
    "step": 4,
    "text": "<b>Every ↗ opens the chapter on GitHub</b> at the section the slide is drawn from, so any number here can be checked against its worked derivation.[[src:ch]]"
   },
   "narration": [
    "This chapter is about one fork in the road. A transaction system touches whole rows. An analytics system scans whole columns. Everything else in the book follows from that.",
    "We will use one small table the whole way through: 32 rows, 50 columns. The analytics question needs only 2 of those columns, and its answer is 4,500 clicks.",
    "The chapter has four parts. First, the two access patterns, measured on the same rows. Second, the shape every analytics query takes.",
    "Third, the price of the column layout, paid on every write. Fourth, a complete system that serves fast writes and fast reads at the same time.",
    "Every small arrow opens the chapter on GitHub, at the section that slide is drawn from. So any number you see can be checked against its full working."
   ]
  },
  {
   "title": "Goals",
   "layout": "table",
   "eyebrow": "02 · What you will be able to do",
   "heading": "Five things this chapter teaches",
   "stand": "Each row is one learning objective. The last column says which part of the deck covers it.",
   "table": {
    "columns": [
     "You will be able to…",
     "Covered in"
    ],
    "rows": [
     {
      "step": 0,
      "cells": [
       "Tell transaction and analytics systems apart by their reads, writes and latency budget.[[src:obj]]",
       "Part 1"
      ]
     },
     {
      "step": 0,
      "cells": [
       "Explain why a row store suits writes and a column store suits reads.[[src:obj]]",
       "Part 1"
      ]
     },
     {
      "step": 1,
      "cells": [
       "Break any analytics query into filter, group, aggregate and order.[[src:obj]]",
       "Part 2"
      ]
     },
     {
      "step": 1,
      "cells": [
       "Say why columns win when a query touches a few of many columns.[[src:obj]]",
       "Parts 1 and 2"
      ]
     },
     {
      "step": 2,
      "cells": [
       "Name the four knobs — layout, indexes, mutation, serving — the rest of the book turns.[[src:obj]]",
       "Parts 3 and 4"
      ]
     }
    ]
   },
   "side": {
    "step": 2,
    "title": "The four knobs",
    "html": "<p><span class=\"chip u\">LAYOUT</span><span class=\"chip u\">INDEXES</span><span class=\"chip d\">MUTATION</span><span class=\"chip a\">SERVING</span></p><ul class=\"l\"><li>Every later chapter turns one of these four.[[src:links]]</li></ul>"
   },
   "narration": [
    "By the end you should be able to tell the two kinds of system apart, and explain why one layout suits writes while the other suits reads.",
    "You should also be able to break any analytics query into four stages, and say why columns win when a query touches only a few of many columns.",
    "Finally, you should be able to name the four knobs the rest of the book turns: the layout, the indexes, how data changes, and how queries are served."
   ]
  },
  {
   "title": "Asks",
   "layout": "cards",
   "eyebrow": "03 · Part 1 · two access patterns",
   "heading": "Two requests, over the same rows",
   "stand": "One names a row and wants all of it. The other names no row and wants almost none of it.",
   "columns": 3,
   "cards": [
    {
     "step": 0,
     "title": "Request A · the transaction",
     "html": "<p><code>SELECT * FROM events WHERE id = 3</code></p><p><b>1 row, all 50 columns.</b> It names one record and wants every field of it.[[src:layout]]</p>"
    },
    {
     "step": 1,
     "title": "Request B · the analytics",
     "html": "<p><code>SELECT sum(clicks) FROM events WHERE campaign = 'c1'</code></p><p><b>2 columns, all 32 rows.</b> It names no row at all.[[src:layout]]</p>"
    },
    {
     "step": 2,
     "title": "The asymmetry",
     "html": "<p>Request B needs nothing from 48 of the 50 columns. A disk hands back whole blocks, so the layout that serves one request wastes most of what it reads for the other.[[src:layout]]</p>"
    }
   ],
   "narration": [
    "Here is the first request. It asks for row number 3, and it wants every one of its 50 fields. This is how a transaction system works: one record, all of it.",
    "Here is the second request. It adds up the clicks for one campaign, across all 32 rows. It needs two columns, campaign and clicks, and nothing else.",
    "So the second request ignores 48 of the 50 columns. A disk always hands back whole blocks. Whichever layout suits one request will waste most of its reads on the other."
   ]
  },
  {
   "title": "Rows",
   "layout": "graph",
   "eyebrow": "04 · Part 1 · layout one, each row contiguous",
   "heading": "Row-major: one block is one whole row",
   "stand": "The row store writes row 0’s fields, then row 1’s, and so on. Watch what each request has to read.",
   "graph": {
    "viewBox": "0 0 1520 450",
    "legend": false,
    "nodes": [
     {
      "id": "r0",
      "x": 110,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "row 0",
      "sub": "50 fields",
      "kind": "main",
      "step": 0,
      "src": "layout"
     },
     {
      "id": "r1",
      "x": 330,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "row 1",
      "sub": "50 fields",
      "kind": "main",
      "step": 0
     },
     {
      "id": "r2",
      "x": 550,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "row 2",
      "sub": "50 fields",
      "kind": "main",
      "step": 0
     },
     {
      "id": "r3",
      "x": 770,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "row 3",
      "sub": "50 fields",
      "kind": "change",
      "step": 1
     },
     {
      "id": "rmid",
      "x": 990,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "rows 4 …",
      "sub": "one block each",
      "kind": "main",
      "step": 0
     },
     {
      "id": "rlast",
      "x": 1210,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "last row",
      "sub": "50 fields",
      "kind": "main",
      "step": 0
     },
     {
      "id": "A",
      "x": 330,
      "y": 270,
      "w": 300,
      "h": 62,
      "title": "Request A",
      "sub": "row 3, all 50 fields",
      "kind": "main",
      "step": 1
     },
     {
      "id": "B",
      "x": 890,
      "y": 270,
      "w": 320,
      "h": 62,
      "title": "Request B",
      "sub": "campaign + clicks, every row",
      "kind": "main",
      "step": 2
     },
     {
      "id": "blocks",
      "x": 330,
      "y": 360,
      "w": 300,
      "h": 84,
      "title": "blocks read",
      "kind": "new",
      "step": 0,
      "values": [
       "0",
       "1",
       "32"
      ]
     },
     {
      "id": "vals",
      "x": 890,
      "y": 360,
      "w": 320,
      "h": 84,
      "title": "values read · used",
      "kind": "new",
      "step": 0,
      "values": [
       "0 · 0",
       "50 · 50",
       "1,600 · 64"
      ]
     }
    ],
    "edges": [
     {
      "from": "A",
      "to": "r3",
      "kind": "change",
      "step": 1,
      "label": "1 block",
      "labelAt": 0.2,
      "dx": -16,
      "dy": 4,
      "labelAnchor": "end"
     },
     {
      "from": "B",
      "to": "r0",
      "kind": "main",
      "step": 2
     },
     {
      "from": "B",
      "to": "r1",
      "kind": "main",
      "step": 2
     },
     {
      "from": "B",
      "to": "r2",
      "kind": "main",
      "step": 2
     },
     {
      "from": "B",
      "to": "r3",
      "kind": "main",
      "step": 2
     },
     {
      "from": "B",
      "to": "rmid",
      "kind": "main",
      "step": 2
     },
     {
      "from": "B",
      "to": "rlast",
      "kind": "main",
      "step": 2,
      "label": "every block",
      "dx": 14,
      "dy": 4,
      "labelAnchor": "start"
     }
    ]
   },
   "narration": [
    "The first layout keeps each row together. Row 0’s fields come first, then row 1’s, and so on. One block on disk is exactly one whole row.",
    "Request A wants row 3. That is one block, and it delivers 50 values when 50 were wanted. Nothing is wasted. For this request, a row store cannot be beaten.",
    "Request B must visit every row, and every row arrives with all 50 fields. That is 32 blocks and 1,600 values read, to use just 64 of them."
   ]
  },
  {
   "title": "Cols",
   "layout": "graph",
   "eyebrow": "05 · Part 1 · layout two, each column contiguous",
   "heading": "Column-major: one run is one whole column",
   "stand": "Exactly the same values, regrouped. No row number is stored: row 3 is slot 3 of every column file.",
   "graph": {
    "viewBox": "0 0 1520 450",
    "legend": false,
    "nodes": [
     {
      "id": "cid",
      "x": 110,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "id",
      "sub": "32 values",
      "kind": "main",
      "step": 0,
      "src": "layout"
     },
     {
      "id": "ccamp",
      "x": 330,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "campaign",
      "sub": "32 values",
      "kind": "change",
      "step": 1
     },
     {
      "id": "cclk",
      "x": 550,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "clicks",
      "sub": "32 values",
      "kind": "change",
      "step": 1
     },
     {
      "id": "c4",
      "x": 770,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "column 4",
      "sub": "32 values",
      "kind": "main",
      "step": 0
     },
     {
      "id": "cmid",
      "x": 990,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "columns 5 …",
      "sub": "one run each",
      "kind": "main",
      "step": 0
     },
     {
      "id": "c50",
      "x": 1210,
      "y": 20,
      "w": 200,
      "h": 56,
      "title": "column 50",
      "sub": "32 values",
      "kind": "main",
      "step": 0
     },
     {
      "id": "B",
      "x": 280,
      "y": 270,
      "w": 300,
      "h": 62,
      "title": "Request B",
      "sub": "campaign + clicks",
      "kind": "main",
      "step": 1
     },
     {
      "id": "A",
      "x": 890,
      "y": 270,
      "w": 320,
      "h": 62,
      "title": "Request A",
      "sub": "slot 3 of every file",
      "kind": "main",
      "step": 2
     },
     {
      "id": "blocks",
      "x": 280,
      "y": 360,
      "w": 300,
      "h": 84,
      "title": "blocks read",
      "kind": "new",
      "step": 0,
      "values": [
       "0",
       "2",
       "50"
      ]
     },
     {
      "id": "vals",
      "x": 890,
      "y": 360,
      "w": 320,
      "h": 84,
      "title": "values read · used",
      "kind": "new",
      "step": 0,
      "values": [
       "0 · 0",
       "64 · 64",
       "1,600 · 50"
      ]
     }
    ],
    "edges": [
     {
      "from": "B",
      "to": "ccamp",
      "kind": "change",
      "step": 1,
      "label": "find code 41",
      "dx": -14,
      "dy": 4,
      "labelAnchor": "end"
     },
     {
      "from": "B",
      "to": "cclk",
      "kind": "change",
      "step": 1,
      "label": "add 9 values",
      "labelAt": 0.15,
      "dx": 14,
      "dy": 4,
      "labelAnchor": "start"
     },
     {
      "from": "A",
      "to": "cid",
      "kind": "main",
      "step": 2
     },
     {
      "from": "A",
      "to": "ccamp",
      "kind": "main",
      "step": 2
     },
     {
      "from": "A",
      "to": "cclk",
      "kind": "main",
      "step": 2
     },
     {
      "from": "A",
      "to": "c4",
      "kind": "main",
      "step": 2
     },
     {
      "from": "A",
      "to": "cmid",
      "kind": "main",
      "step": 2
     },
     {
      "from": "A",
      "to": "c50",
      "kind": "main",
      "step": 2,
      "label": "50 scattered reads",
      "dx": 14,
      "dy": 4,
      "labelAnchor": "start"
     }
    ]
   },
   "notes": [
    {
     "step": 3,
     "html": "<b>No row number is stored.</b> Row 3 is wherever slot 3 is, in every column file at once.[[src:layout]]"
    },
    {
     "step": 3,
     "html": "<b>Positional identity.</b> Slot <i>i</i> of campaign and slot <i>i</i> of clicks are the same record.[[src:layout]]"
    },
    {
     "step": 3,
     "html": "<b>Chapter 2</b> shows what breaks if a sort moves one column without the others.[[src:links]]"
    }
   ],
   "narration": [
    "The second layout keeps each column together. All 32 campaign values sit in one run, all 32 clicks in another. The values are the same; only the grouping changed.",
    "Request B now opens just two files. It finds the 9 rows with campaign code 41, reads the clicks at those slots, and adds them up to 4,500. 64 values read, 64 used.",
    "But request A now pays. Row 3 is spread across 50 files, so rebuilding it takes 50 scattered reads where the row store needed one.",
    "Notice that no row number is stored anywhere. Row 3 is simply slot 3 of every column file. Every later chapter depends on that, and calls it positional identity."
   ]
  },
  {
   "title": "Costs",
   "layout": "cards",
   "eyebrow": "06 · Part 1 · the fork, measured",
   "heading": "Each layout is ideal exactly where the other is bad",
   "stand": "In the chapter’s program each request keeps a cost record that counts up as it reads. These are the final block counts.",
   "bars": {
    "step": 0,
    "label": "Blocks read, per request and layout",
    "items": [
     {
      "label": "A on row-major",
      "value": 1
     },
     {
      "label": "A on column-major",
      "value": 50
     },
     {
      "label": "B on row-major",
      "value": 32
     },
     {
      "label": "B on column-major",
      "value": 2
     }
    ]
   },
   "columns": 3,
   "cards": [
    {
     "step": 1,
     "title": "No loop, one block",
     "html": "<p>The row-major point read calls <code>readBlock</code> once. There is no loop over blocks in that function — which is why transaction systems are row stores.[[src:layout]]</p>"
    },
    {
     "step": 2,
     "title": "96% thrown away",
     "html": "<p>The row-major aggregate loops 32 times, using 2 of 50 fields each time: 1,600 values read, 64 used.[[src:layout]]</p>"
    },
    {
     "step": 3,
     "title": "Not decided by layout",
     "html": "<p><b>Correctness:</b> both layouts return 4,500. <b>Timing:</b> the layout is chosen once, when the table is created.[[src:layout]]</p>"
    }
   ],
   "narration": [
    "Here are the four costs side by side, as blocks read. Request A: 1 block on the row store, 50 on the column store. Request B: 32 blocks on the row store, 2 on the column store.",
    "The chapter’s program makes the reason visible. The row store’s point read has no loop at all: it reads one block and stops. That is why transaction systems store rows.",
    "The row store’s aggregate loops over all 32 rows, and uses 2 of the 50 fields each time. It reads 1,600 values to use 64, throwing away 96 percent on every run.",
    "The layout never changes the answer: both return 4,500. It only changes the cost. And it is chosen once, when the table is made, from the questions you expect to ask."
   ]
  },
  {
   "title": "Query",
   "layout": "table",
   "eyebrow": "07 · Part 2 · the shape of an analytics query",
   "heading": "Four clauses, four stages, four different costs",
   "stand": "Every analytics query runs as the same four stages, in the same order. Each is slow for a different reason.",
   "table": {
    "columns": [
     "Stage",
     "What it does here",
     "Rows",
     "What makes it slow"
    ],
    "rows": [
     {
      "step": 0,
      "cells": [
       "<b>Filter</b>",
       "drop every row of campaign c4",
       "32 → 30",
       "how many rows must be checked[[src:query]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "<b>Group</b>",
       "one bucket per campaign",
       "30 → 4",
       "how many <i>distinct</i> values there are[[src:query]]"
      ]
     },
     {
      "step": 2,
      "cells": [
       "<b>Aggregate</b>",
       "add the clicks in each bucket",
       "4 → 4",
       "arithmetic over contiguous bytes[[src:query]]"
      ]
     },
     {
      "step": 3,
      "cells": [
       "<b>Order</b>",
       "rank the buckets, keep the top 2",
       "4 → 2",
       "a sort of an already tiny result[[src:query]]"
      ]
     }
    ]
   },
   "side": {
    "step": 0,
    "title": "The request",
    "html": "<p><code>SELECT campaign, sum(clicks)<br>FROM events<br>WHERE campaign &lt;&gt; 'c4'<br>GROUP BY campaign<br>ORDER BY clicks DESC<br>LIMIT 2</code>[[src:query]]</p>"
   },
   "narration": [
    "Here is one analytics question: total clicks per campaign, leaving out campaign c4, top two only. First comes the filter. It drops the 2 rows of c4, so 32 rows become 30.",
    "Next, grouping puts the 30 surviving rows into buckets, one per campaign. There are 4 buckets. Its cost depends on how many distinct values there are, not on the rows.",
    "Then aggregation adds up the clicks inside each bucket. It is cheap because the clicks column sits together on disk, which the next chapter makes smaller still.",
    "Finally, the order stage ranks the 4 totals and keeps the top 2. By now there is almost nothing left to sort, which is exactly why ordering comes last."
   ]
  },
  {
   "title": "Funnel",
   "layout": "graph",
   "eyebrow": "08 · Part 2 · the funnel, and which chapter attacks which stage",
   "heading": "A slow query is one slow arrow",
   "stand": "Each stage does work in proportion to what the previous one left. Below each stage: the chapter that makes it cheaper.",
   "graph": {
    "viewBox": "0 0 1520 400",
    "legend": true,
    "nodes": [
     {
      "id": "rows",
      "x": 20,
      "y": 60,
      "w": 220,
      "h": 96,
      "title": "Stored rows",
      "sub": "the segment",
      "kind": "main",
      "step": 0,
      "values": [
       "32",
       "32",
       "32",
       "32",
       "32"
      ]
     },
     {
      "id": "filter",
      "x": 320,
      "y": 60,
      "w": 220,
      "h": 96,
      "title": "Filter",
      "sub": "campaign is not c4",
      "kind": "change",
      "step": 0,
      "values": [
       "30",
       null,
       null,
       null,
       null
      ]
     },
     {
      "id": "group",
      "x": 620,
      "y": 60,
      "w": 220,
      "h": 96,
      "title": "Group",
      "sub": "by campaign",
      "kind": "main",
      "step": 1,
      "values": [
       "",
       "4",
       null,
       null,
       null
      ]
     },
     {
      "id": "agg",
      "x": 920,
      "y": 60,
      "w": 220,
      "h": 96,
      "title": "Aggregate",
      "sub": "sum of clicks",
      "kind": "main",
      "step": 2,
      "values": [
       "",
       "",
       "4",
       null,
       null
      ]
     },
     {
      "id": "order",
      "x": 1220,
      "y": 60,
      "w": 260,
      "h": 96,
      "title": "Order + limit 2",
      "sub": "rank, keep two",
      "kind": "main",
      "step": 3,
      "values": [
       "",
       "",
       "",
       "2",
       null
      ]
     },
     {
      "id": "x48",
      "x": 320,
      "y": 280,
      "w": 220,
      "h": 64,
      "title": "Chapters 4 to 8",
      "sub": "filter indexes",
      "kind": "ext",
      "step": 4,
      "src": "links"
     },
     {
      "id": "x6",
      "x": 620,
      "y": 280,
      "w": 220,
      "h": 64,
      "title": "Chapter 6",
      "sub": "the star-tree",
      "kind": "ext",
      "step": 4,
      "src": "links"
     },
     {
      "id": "x2",
      "x": 920,
      "y": 280,
      "w": 220,
      "h": 64,
      "title": "Chapter 2",
      "sub": "encoding",
      "kind": "ext",
      "step": 4,
      "src": "links"
     },
     {
      "id": "x3",
      "x": 1240,
      "y": 280,
      "w": 220,
      "h": 64,
      "title": "Chapter 3",
      "sub": "sorted columns",
      "kind": "ext",
      "step": 4,
      "src": "links"
     }
    ],
    "edges": [
     {
      "from": "rows",
      "to": "filter",
      "kind": "change",
      "step": 0,
      "label": "32 → 30"
     },
     {
      "from": "filter",
      "to": "group",
      "kind": "main",
      "step": 1,
      "label": "30 → 4"
     },
     {
      "from": "group",
      "to": "agg",
      "kind": "main",
      "step": 2,
      "label": "4 → 4"
     },
     {
      "from": "agg",
      "to": "order",
      "kind": "main",
      "step": 3,
      "label": "4 → 2"
     },
     {
      "from": "x48",
      "to": "filter",
      "kind": "ext",
      "step": 4,
      "label": "cheaper filter"
     },
     {
      "from": "x6",
      "to": "group",
      "kind": "ext",
      "step": 4,
      "label": "precomputed groups"
     },
     {
      "from": "x2",
      "to": "agg",
      "kind": "ext",
      "step": 4,
      "label": "smaller columns"
     },
     {
      "from": "x3",
      "to": "order",
      "kind": "ext",
      "step": 4,
      "label": "top-k as a prefix read"
     }
    ]
   },
   "narration": [
    "Here is the same query as a funnel. The filter comes first, and it keeps row positions, not values, so every later stage can read any column at those rows. 32 rows become 30.",
    "Grouping turns 30 rows into 4 buckets. Because the campaign column is sorted, equal values sit together, so the engine walks 4 boundaries instead of hashing 30 rows.",
    "Aggregation folds each bucket into one total. 4 buckets in, 4 totals out. The work here is plain arithmetic over values that sit next to each other.",
    "Ordering ranks 4 totals and keeps 2. The limit saved nothing upstream: all 30 rows were still read and all 4 buckets summed. Only a sorted column makes top results cheap.",
    "Each stage has its own chapter. Chapters 4 to 8 make filtering cheaper. Chapter 6 precomputes groups. Chapter 2 shrinks columns. Chapter 3 makes top results a prefix read."
   ]
  },
  {
   "title": "Sums",
   "layout": "table",
   "eyebrow": "09 · Part 2 · the numbers inside each bucket",
   "heading": "Four buckets, and a tie the data really has",
   "stand": "Campaign is stored as a number code. Equal codes sit next to each other because the column is sorted.",
   "table": {
    "columns": [
     "Campaign",
     "Code",
     "Rows",
     "Sum of clicks"
    ],
    "rows": [
     {
      "step": 0,
      "cells": [
       "c1",
       "<code>41</code>",
       "9 · rows 0 … 8",
       "100 + 800 + 600 + 400 + 200 + 900 + 700 + 500 + 300 = <b>4,500</b>[[src:query]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "c2",
       "<code>58</code>",
       "7",
       "<b>3,700</b>[[src:query]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "c3",
       "<code>63</code>",
       "5",
       "<b>2,300</b>[[src:query]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "c4",
       "<code>79</code>",
       "2 · rows 21 … 22",
       "[[tag:unv|filtered out]] never summed"
      ]
     },
     {
      "step": 1,
      "cells": [
       "c5",
       "<code>86</code>",
       "9",
       "<b>4,500</b>[[src:query]]"
      ]
     }
    ]
   },
   "side": {
    "step": 2,
    "title": "The tie",
    "html": "<p>c1 and c5 both total <b>4,500</b>, so <code>LIMIT 2</code> has more than one correct answer.[[src:query]]</p><ul class=\"l\"><li>The data was left this way on purpose.</li><li>Real systems add a tiebreaker: <code>ORDER BY clicks DESC, campaign ASC</code>.[[src:query]]</li></ul>"
   },
   "narration": [
    "Here is one bucket worked in full. Campaign c1 is stored as code 41, in rows 0 to 8. Adding its 9 click values gives 4,500.",
    "The other buckets follow the same way: c2 totals 3,700, c3 totals 2,300, and c5 totals 4,500. Campaign c4 was removed by the filter, so it is never summed.",
    "Look at the top: c1 and c5 both total 4,500. So the request for the top two has more than one right answer. Real systems add a tiebreaker for exactly this reason."
   ]
  },
  {
   "title": "Write",
   "layout": "graph",
   "eyebrow": "10 · Part 3 · read-optimized versus write-optimized",
   "heading": "The columnar win is a loan, repaid on every write",
   "stand": "One new row. On a row store it is one append. On a column store its fields live in 50 different files.",
   "graph": {
    "viewBox": "0 0 1520 430",
    "legend": false,
    "nodes": [
     {
      "id": "ins",
      "x": 40,
      "y": 170,
      "w": 300,
      "h": 70,
      "title": "Insert one row",
      "sub": "50 fields",
      "kind": "main",
      "step": 0,
      "src": "write"
     },
     {
      "id": "rs",
      "x": 600,
      "y": 30,
      "w": 320,
      "h": 70,
      "title": "Row store",
      "sub": "one append, one place",
      "kind": "main",
      "step": 0
     },
     {
      "id": "cs1",
      "x": 600,
      "y": 170,
      "w": 320,
      "h": 50,
      "title": "campaign file",
      "kind": "change",
      "step": 1
     },
     {
      "id": "cs2",
      "x": 600,
      "y": 234,
      "w": 320,
      "h": 50,
      "title": "clicks file",
      "kind": "change",
      "step": 1
     },
     {
      "id": "cs3",
      "x": 600,
      "y": 298,
      "w": 320,
      "h": 50,
      "title": "columns 3 … 50",
      "sub": "one file each",
      "kind": "change",
      "step": 1
     },
     {
      "id": "writes",
      "x": 1160,
      "y": 120,
      "w": 320,
      "h": 100,
      "title": "scattered writes",
      "kind": "new",
      "step": 0,
      "values": [
       "1",
       "50",
       "1,600",
       "5,000,000"
      ]
     }
    ],
    "edges": [
     {
      "from": "ins",
      "to": "rs",
      "kind": "main",
      "step": 0,
      "label": "1 write"
     },
     {
      "from": "ins",
      "to": "cs1",
      "kind": "change",
      "step": 1
     },
     {
      "from": "ins",
      "to": "cs2",
      "kind": "change",
      "step": 1
     },
     {
      "from": "ins",
      "to": "cs3",
      "kind": "change",
      "step": 1,
      "label": "50 writes",
      "dx": 0,
      "dy": 18
     }
    ]
   },
   "notes": [
    {
     "step": 2,
     "html": "<b>32 rows one at a time:</b> 32 × 50 = 1,600 scattered writes.[[src:write]]"
    },
    {
     "step": 3,
     "html": "<b>A production batch of 100,000 rows:</b> 5,000,000 writes.[[src:write]]"
    },
    {
     "step": 3,
     "html": "<b>No faster disk fixes a 50× multiplier.</b> The data has to be written differently, not faster.[[src:write]]"
    }
   ],
   "narration": [
    "The column layout made reading cheap. Now the bill arrives. Inserting one row into a row store is a single append: one write, in one place.",
    "The same insert on a column store touches all 50 column files, one write each. That is called write amplification: one logical row becomes 50 physical writes.",
    "Written one row at a time, our 32 rows would cost 32 times 50, which is 1,600 scattered writes.",
    "A real batch of 100,000 rows would cost 5,000,000 writes. No faster disk fixes a fifty-times multiplier. The data has to be written differently."
   ]
  },
  {
   "title": "Batch",
   "layout": "timeline",
   "eyebrow": "11 · Part 3 · the analytics answer: buffer, then write each column once",
   "heading": "Hold rows in memory, then write each column once",
   "stand": "The buffer is row-shaped and in memory. The write is column-shaped and happens once per batch.",
   "timeline": [
    {
     "step": 0,
     "time": "arrive",
     "title": "Rows arrive",
     "text": "Each new row lands in an in-memory buffer.[[src:write]]"
    },
    {
     "step": 1,
     "time": "hold",
     "title": "Buffer fills",
     "text": "32 rows held — and still 0 writes.[[src:write]]"
    },
    {
     "step": 2,
     "time": "seal",
     "title": "Pivot and write",
     "text": "Gather each column across the buffer; write it once: 50 writes.[[src:write]]"
    },
    {
     "step": 3,
     "time": "visible",
     "title": "Queryable",
     "text": "Only now can a reader see these rows.[[src:write]]"
    }
   ],
   "strip": {
    "step": 1,
    "label": "The buffer · row-shaped, in memory, nothing on disk yet",
    "items": [
     {
      "n": "row 0",
      "text": "held"
     },
     {
      "n": "row 1",
      "text": "held"
     },
     {
      "n": "row 2",
      "text": "held"
     },
     {
      "n": "…",
      "text": "held"
     },
     {
      "n": "last row",
      "text": "held",
      "tone": "warn"
     }
    ]
   },
   "narration": [
    "Analytics systems avoid that bill by batching. New rows do not go to disk at all at first. They land in a buffer in memory, still shaped as rows.",
    "The buffer fills up. 32 rows are now held, and the number of writes is still zero. Nothing has touched a disk, and no reader can see these rows yet.",
    "At seal time the system pivots. It gathers each column across every buffered row, and writes that column once. That is 50 writes for all 32 rows.",
    "Only after sealing are the rows visible to queries. The delay is the price, and an analytics system can pay it because its answers may be seconds old."
   ]
  },
  {
   "title": "Bill",
   "layout": "cards",
   "eyebrow": "12 · Part 3 · when the bill is paid, and what batching does not fix",
   "heading": "Batching divides the bill; it does not remove it",
   "stand": "The same 32 rows, written two ways.",
   "bars": {
    "step": 0,
    "label": "Writes for the same 32 rows",
    "items": [
     {
      "label": "one row at a time",
      "value": 1600
     },
     {
      "label": "batched, one write per column",
      "value": 50
     }
    ]
   },
   "columns": 3,
   "cards": [
    {
     "step": 1,
     "title": "Divided by the batch",
     "html": "<p>1.56 writes per row here, and 0.00050 at a batch of 100,000 rows.[[src:write]]</p>"
    },
    {
     "step": 2,
     "title": "The price is freshness",
     "html": "<p>A row is not queryable until its batch seals. Analytics can wait seconds; a payments system cannot.[[src:write]]</p>"
    },
    {
     "step": 3,
     "title": "Not for written rows",
     "html": "<p>A correction to a sealed row becomes a new segment, a delete marker, and a later merge — chapter 9.[[src:write]]</p>"
    }
   ],
   "narration": [
    "Here are the two bills for the same 32 rows. Written one at a time, 1,600 writes. Buffered and written once per column, 50 writes.",
    "Batching does not remove the multiplier. It divides it by the batch size: about 1.56 writes per row here, and far less than one write per row at production scale.",
    "The price is freshness. A row cannot be queried until its batch is sealed. An analytics system can accept that. A payments system cannot.",
    "And batching does nothing for rows already written. A correction becomes a new segment, a delete marker, and a later merge. Chapter 9 is about exactly that."
   ]
  },
  {
   "title": "Brief",
   "layout": "table",
   "eyebrow": "13 · Part 4 · system design interview",
   "heading": "Design a click analytics store",
   "stand": "A dashboard shows clicks per campaign. The numbers below are the whole difficulty.",
   "table": {
    "columns": [
     "Constraint",
     "Value",
     "Pulls toward"
    ],
    "rows": [
     {
      "step": 0,
      "cells": [
       "Table size",
       "<b>1 billion rows</b>",
       "column scans[[src:sd]]"
      ]
     },
     {
      "step": 0,
      "cells": [
       "Columns",
       "<b>50</b>, of which the query reads 2",
       "column scans[[src:sd]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "Arrival rate",
       "<b>100,000 rows a second</b>",
       "many small writes[[src:sd]]"
      ]
     },
     {
      "step": 2,
      "cells": [
       "Freshness",
       "<b>5 seconds</b> from emit to visible",
       "nothing large can be rebuilt[[src:sd]]"
      ]
     }
    ]
   },
   "side": {
    "step": 3,
    "title": "Why it is hard",
    "html": "<p>Written row by row, the ingest alone would be <b>5,000,000 scattered writes a second</b>.[[src:sd]]</p><ul class=\"l\"><li>So the design splits the write path from the read path.</li><li>Rows cross from one to the other exactly once.</li></ul>"
   },
   "narration": [
    "Now a full design question. A dashboard shows clicks per campaign, over a table of a billion rows with 50 columns. The query reads just 2 of them.",
    "New clicks arrive at 100,000 rows every second. That part looks like a transaction workload: many small writes.",
    "And every click must be visible within 5 seconds. That is too short to rebuild anything large.",
    "Written row by row, the ingest alone would be 5 million scattered writes a second. So the design has to split the write path from the read path."
   ]
  },
  {
   "title": "Arch",
   "layout": "graph",
   "eyebrow": "14 · Part 4 · five stages, and the split between them",
   "heading": "Rows cross from mutable to frozen exactly once",
   "stand": "Top lane: row-shaped and changeable. Bottom lane: column-shaped and frozen. The crossing is the seal.",
   "graph": {
    "viewBox": "0 0 1520 420",
    "legend": true,
    "lanes": [
     {
      "y": 10,
      "h": 190,
      "label": "Row-shaped · mutable"
     },
     {
      "y": 215,
      "h": 195,
      "label": "Column-shaped · frozen"
     }
    ],
    "nodes": [
     {
      "id": "writer",
      "x": 175,
      "y": 64,
      "w": 230,
      "h": 72,
      "title": "Writer",
      "sub": "emits click rows",
      "kind": "main",
      "step": 0,
      "src": "sd"
     },
     {
      "id": "ingest",
      "x": 525,
      "y": 52,
      "w": 250,
      "h": 96,
      "title": "Ingestion buffer",
      "sub": "holds rows for 1s",
      "kind": "new",
      "step": 0,
      "values": [
       "100,000 rows",
       null,
       null,
       null
      ]
     },
     {
      "id": "store",
      "x": 525,
      "y": 262,
      "w": 250,
      "h": 104,
      "title": "Columnar store",
      "sub": "frozen segments",
      "kind": "hub",
      "step": 1,
      "values": [
       null,
       "50 writes",
       "10,000 segments",
       null
      ]
     },
     {
      "id": "engine",
      "x": 905,
      "y": 278,
      "w": 240,
      "h": 72,
      "title": "Query engine",
      "sub": "filter, group, aggregate",
      "kind": "main",
      "step": 2
     },
     {
      "id": "dash",
      "x": 1290,
      "y": 266,
      "w": 210,
      "h": 96,
      "title": "Dashboard",
      "sub": "reader",
      "kind": "ext",
      "step": 3,
      "values": [
       null,
       null,
       null,
       "1.5s"
      ]
     }
    ],
    "edges": [
     {
      "from": "writer",
      "to": "ingest",
      "kind": "main",
      "step": 0,
      "label": "small writes"
     },
     {
      "from": "ingest",
      "to": "store",
      "kind": "new",
      "step": 1,
      "label": "seal: pivot to columns",
      "dx": 12,
      "dy": 4,
      "labelAnchor": "start"
     },
     {
      "from": "engine",
      "to": "store",
      "kind": "main",
      "step": 2,
      "label": "prune segments"
     },
     {
      "from": "engine",
      "to": "dash",
      "kind": "main",
      "step": 3,
      "label": "2 of 50 files"
     }
    ]
   },
   "narration": [
    "Here is the design. The writer emits small click rows, and the ingestion buffer holds them for one second. Everything in the top lane is shaped as rows, and can change.",
    "When the second is up, the buffer is sealed. Each column is written once, as a frozen segment. 50 writes, instead of 5 million a second.",
    "A billion rows at 100,000 per segment is 10,000 segments. The engine skips most of them by checking each segment’s smallest and largest value first.",
    "For segments that survive, the engine opens only 2 of the 50 column files. The answer reaches the dashboard in about 1.5 seconds, inside the 5 second budget."
   ]
  },
  {
   "title": "Click",
   "layout": "sequence",
   "eyebrow": "15 · Part 4 · one click, from emit to dashboard",
   "heading": "The same pipeline, in time order",
   "stand": "Each column is one component. Messages appear in the order they happen.",
   "sequence": {
    "actors": [
     {
      "name": "Writer",
      "sub": "emits clicks",
      "src": "sd"
     },
     {
      "name": "Ingestion buffer",
      "sub": "row-shaped, in memory"
     },
     {
      "name": "Columnar store",
      "sub": "frozen segments",
      "highlight": true
     },
     {
      "name": "Query engine",
      "sub": "four stages"
     },
     {
      "name": "Dashboard",
      "sub": "the reader"
     }
    ],
    "messages": [
     {
      "from": "Writer",
      "to": "Ingestion buffer",
      "label": "click row — nothing written yet",
      "step": 0
     },
     {
      "from": "Ingestion buffer",
      "to": "Columnar store",
      "label": "seal after 1s · 50 writes · min 41, max 86",
      "step": 1,
      "src": "sd"
     },
     {
      "from": "Dashboard",
      "to": "Query engine",
      "label": "clicks per campaign?",
      "step": 2
     },
     {
      "from": "Query engine",
      "to": "Columnar store",
      "label": "prune 10,000 segments",
      "step": 2
     },
     {
      "from": "Columnar store",
      "to": "Query engine",
      "label": "campaign + clicks files only",
      "step": 3
     },
     {
      "from": "Query engine",
      "to": "Dashboard",
      "label": "1 + 0.2 + 0.3 = 1.5s",
      "step": 3,
      "src": "sd"
     }
    ]
   },
   "narration": [
    "Follow one click in time order. The writer sends a click row to the buffer. Nothing is written to disk yet, so no reader can see it.",
    "After one second the buffer seals. Each column is written once, and the segment records its smallest and largest campaign code, 41 and 86. Then it is frozen for good.",
    "The dashboard asks for clicks per campaign. The engine first prunes the 10,000 segments, using only those two stored numbers. No column file is opened to do it.",
    "Surviving segments hand back just the campaign and clicks files. The answer arrives in about 1.5 seconds: one second of buffering, plus 0.2 and 0.3 for sealing and querying."
   ]
  },
  {
   "title": "Limit",
   "layout": "cards",
   "eyebrow": "16 · Part 4 · what this design is bad at",
   "heading": "A design is understood once its failures are named",
   "stand": "Each limit is the direct cost of a choice made two slides ago.",
   "columns": 2,
   "cards": [
    {
     "step": 0,
     "title": "Point lookups",
     "html": "<p>One row costs 50 scattered reads. Use a row store.[[src:sd]]</p>"
    },
    {
     "step": 0,
     "title": "Sub-second freshness",
     "html": "<p>The 1 second flush interval is a floor on how fresh an answer can be.[[src:sd]]</p>"
    },
    {
     "step": 1,
     "title": "In-place updates",
     "html": "<p>A sealed segment cannot be edited: a correction is a new segment, a tombstone and a merge.[[src:sd]]</p>"
    },
    {
     "step": 1,
     "title": "Multi-row transactions",
     "html": "<p>There is no atomicity across rows here.[[src:sd]]</p>"
    },
    {
     "step": 2,
     "title": "A problem of its own",
     "html": "<p>1,000,000,000 rows at 100,000 per segment is <b>10,000 segments</b>. Managing them is chapter 9’s compaction.[[src:sd]]</p>"
    }
   ],
   "narration": [
    "This design is bad at some things, on purpose. Looking up one row costs 50 scattered reads. And no answer can be fresher than the one second buffer.",
    "A sealed segment can never be edited, so a correction becomes a new segment, a tombstone and a later merge. There are no transactions across several rows.",
    "And the design creates a problem of its own: 10,000 segments. Keeping that number manageable is the job of compaction, in chapter 9."
   ]
  },
  {
   "title": "Quiz",
   "layout": "cards",
   "eyebrow": "18 · Quiz · check yourself",
   "heading": "Five questions, with the answers",
   "stand": "Say your answer out loud before the narration reads it.",
   "columns": 3,
   "cards": [
    {
     "step": 0,
     "title": "1 · Unit of work in OLTP?",
     "html": "<p><b>The row</b> — one row by key, all of its columns.[[src:quiz]]</p>"
    },
    {
     "step": 1,
     "title": "2 · Why is a column sum cheap?",
     "html": "<p>It reads <b>exactly that column</b>, contiguously, and compresses it.[[src:quiz]]</p>"
    },
    {
     "step": 2,
     "title": "3 · The four stages, in order?",
     "html": "<p><b>Filter → group → aggregate → order.</b>[[src:quiz]]</p>"
    },
    {
     "step": 3,
     "title": "4 · What is write amplification?",
     "html": "<p>One logical row insert becomes <b>one write per column file</b>.[[src:quiz]]</p>"
    },
    {
     "step": 4,
     "title": "5 · Why batch writes?",
     "html": "<p>To rewrite <b>whole column blocks at once</b>, dividing the per-row cost.[[src:quiz]]</p>"
    }
   ],
   "narration": [
    "Question one: what is the unit of work in a transaction system? The answer is the row: one row, found by its key, with all of its columns.",
    "Question two: why does a column store make summing a column cheap? Because it reads exactly that column, stored together on disk, and compressed.",
    "Question three: what are the four stages of an analytics query, in order? Filter, then group, then aggregate, then order.",
    "Question four: what is write amplification? It is one logical row insert turning into one physical write for every column file.",
    "Question five: why do analytics systems batch their writes? To write whole column blocks at once, which divides the cost of each row."
   ]
  },
  {
   "title": "Recap",
   "layout": "table",
   "eyebrow": "19 · Key concepts and takeaways",
   "heading": "Everything after this chapter is one installment of this tradeoff",
   "stand": "Six ideas the rest of the book builds on, then where they lead.",
   "table": {
    "columns": [
     "Concept",
     "In one sentence"
    ],
    "rows": [
     {
      "step": 0,
      "cells": [
       "<b>Two workloads</b>",
       "Transactions want whole rows by key; analytics wants whole columns by scan.[[src:kc]]"
      ]
     },
     {
      "step": 0,
      "cells": [
       "<b>OLTP</b>",
       "Thousands of tiny operations a second, each touching one row and all its columns.[[src:kc]]"
      ]
     },
     {
      "step": 0,
      "cells": [
       "<b>OLAP</b>",
       "A few heavy questions, each scanning a few columns across millions of rows.[[src:kc]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "<b>Row vs column store</b>",
       "Layout is zero-sum: you speed up one direction by taxing the other.[[src:kc]]"
      ]
     },
     {
      "step": 1,
      "cells": [
       "<b>Four-stage query</b>",
       "Filter, group, aggregate, order — naming the slow stage names the index.[[src:kc]]"
      ]
     },
     {
      "step": 2,
      "cells": [
       "<b>Write amplification</b>",
       "One row insert becomes one write per column: the repayment on the read loan.[[src:take]]"
      ]
     }
    ]
   },
   "side": {
    "step": 3,
    "title": "Where next",
    "html": "<ul class=\"l\"><li><b>Chapter 2</b> shrinks columns with encoding.[[src:links]]</li><li><b>Chapter 3</b> sorts them, so top results are a prefix read.[[src:links]]</li><li><b>Chapter 6</b> precomputes groups; <b>chapter 9</b> handles changes to frozen data.[[src:links]]</li></ul><p><span class=\"chip u\">PINOT</span><span class=\"chip u\">DRUID</span><span class=\"chip u\">CLICKHOUSE</span> are column stores, fed from row stores like <span class=\"chip\">POSTGRESQL</span>.[[src:pinot]]</p>"
   },
   "narration": [
    "To sum up. Transaction systems do many tiny operations, each on one whole row. Analytics systems ask a few heavy questions, each scanning a few columns.",
    "Layout is zero-sum: you pay for one direction with the other. And every analytics query is filter, group, aggregate and order, so find the slow stage first.",
    "Fast reads are a loan, and write amplification is the repayment. That cost shapes how data arrives, and how it changes later.",
    "Next, chapter 2 shrinks the columns and chapter 3 sorts them. Real column stores such as Pinot, Druid and ClickHouse are fed from row stores like PostgreSQL."
   ]
  },
  {
   "title": "Ask",
   "layout": "code",
   "code": {
    "lines": [
     "// row store: one point read -> the whole row",
     "// column store: one SUM -> one column, contiguous, compressed",
     "// splitting them lets each engine win its own workload"
    ],
    "shown": [],
    "fresh": [
     [
      0,
      2
     ]
    ],
    "step": 1,
    "label": "the chapter's snippet for Q1",
    "source": {
     "snippet": [
      "ch01",
      0
     ]
    }
   },
   "eyebrow": "20 · fixture question",
   "heading": "One question",
   "stand": "A question with a card revealed after it is answered.",
   "question": {
    "step": 0,
    "prompt": "Which layout reads one whole row in a single block?",
    "options": [
     {
      "text": "The row store.",
      "correct": true,
      "why": "Each block holds one whole row, so one block delivers it."
     },
     {
      "text": "The column store.",
      "correct": false,
      "why": "Each column lives in its own block, so a whole row needs one read per column."
     },
     {
      "text": "Neither of them.",
      "correct": false,
      "why": "The row store does exactly this."
     }
    ]
   },
   "cards": [
    {
     "step": 1,
     "title": "One block",
     "html": "<p>Request A on the row store reads 1 block.</p>"
    }
   ],
   "narration": [
    "A question for the fixture. Which layout reads one whole row in a single block? Choose an answer.",
    "The row store. Each block holds one whole row, so a single read delivers all of it."
   ]
  }
 ]
};
