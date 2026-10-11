#!/usr/bin/env python3
"""extend_deck_engine.py — add layouts to decks/narrated-deck-template.html (ask, array, code).

The template is the user's own engine; this script is the ONLY place it is changed, so the
change is reviewable and repeatable (re-running it on an extended file is a no-op).

  ask    an interactive question. The voice asks it, the viewer clicks an answer, and the
         deck says whether it was right and why. The deck — clicks, arrow keys and auto-play
         alike — will not move past the question until it has been answered.
  array  an animated column: values drop into numbered slots, a slot can be picked out across
         every row at once, and a pointer can sweep the column with a live counter (a running
         sum, or a comparison count with the matches marked).
"""
import os, sys

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'decks', 'narrated-deck-template.html')
MARK = '/* ---- extension: ask + array layouts ---- */'

CSS = MARK + """
.askwrap,.arrwrap{display:flex;flex-direction:column;gap:12px;flex:1;min-height:0}
.askq .qtext{font-family:var(--f-serif);font-size:24px;line-height:1.35;color:var(--ink);margin:0 0 14px;max-width:62ch}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.opt{display:flex;gap:12px;align-items:flex-start;text-align:left;font:inherit;font-size:15px;line-height:1.35;color:var(--ink);background:var(--sheet);border:1.5px solid var(--rule);padding:12px 14px;cursor:pointer;transition:border-color .2s,background .2s,opacity .3s}
.opt:hover:not(:disabled),.opt:focus-visible{border-color:var(--acc);outline:none}
.opt i{font-style:normal;font-family:var(--f-mono);font-size:12px;font-weight:700;color:var(--acc);border:1px solid var(--acc);padding:1px 7px;flex:none}
.opt.right{border-color:var(--up);background:var(--upbg)} .opt.right i{color:var(--up);border-color:var(--up)}
.opt.wrong{border-color:var(--dn);background:var(--dnbg)} .opt.wrong i{color:var(--dn);border-color:var(--dn)}
.opt.dim{opacity:.45} .opt:disabled{cursor:default}
.fb{margin-top:12px;font-size:15px;line-height:1.45;color:var(--ink);min-height:22px} .fb p{margin:0 0 6px;max-width:100ch}
.fb .verdict{font-family:var(--f-mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700}
.fb .verdict.ok{color:var(--up)} .fb .verdict.no{color:var(--dn)} .fb .hint{color:var(--acc);font-family:var(--f-mono);font-size:12px}
.slide.nudge .opts{animation:nudge .5s}
@keyframes nudge{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.arr .agrid{display:grid;gap:3px;align-items:center}
.arr .al{font-family:var(--f-mono);font-size:11px;color:var(--soft);padding-right:8px;line-height:1.25}
.arr .ai{font-family:var(--f-mono);font-size:9.5px;color:var(--faint);text-align:center;transition:color .25s}
.arr .ai.pick{color:var(--acc);font-weight:700}
.arr .ac{font-family:var(--f-mono);font-size:12px;text-align:center;padding:7px 0;background:var(--panel);border:1px solid var(--hair);color:var(--ink);opacity:0;transform:translateY(-10px);transition:opacity .35s,transform .35s,background .25s,border-color .25s,color .25s}
.arr .ac.in{opacity:1;transform:none}
.arr .ac.seen{background:var(--upbg);border-color:var(--up)}
.arr .ac.hit{background:var(--dnbg);border-color:var(--dn);color:var(--dn);font-weight:600}
.arr .ac.pick{background:var(--acc-soft);border-color:var(--acc);color:var(--acc);font-weight:700;animation:land .6s}
.arr .ac.ptr{outline:2px solid var(--acc);outline-offset:1px}
.ameter{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}
.am{border:1px solid var(--hair);background:var(--panel);padding:8px 14px;min-width:170px}
.am b{display:block;font-family:var(--f-serif);font-size:28px;line-height:1.1;color:var(--ink);font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.arr .ac,.opt{transition:none;animation:none}}
"""

RENDER = """ /* extension: ask + array layouts */
 ask(s){const q=s.question;
  let h='<div class="card askq"'+st(q.step)+'><p class="k">'+rich(q.label||'Your turn · pick an answer')+'</p><p class="qtext">'+rich(q.prompt)+'</p><div class="opts">'+
   q.options.map((o,j)=>'<button type="button" class="opt" data-j="'+j+'"><i>'+String.fromCharCode(65+j)+'</i><span>'+rich(o.text)+'</span></button>').join('')+
   '</div><div class="fb" aria-live="polite"></div></div>';
  return head(s)+'<div class="askwrap">'+h+extCards(s)+'</div>'},
 array(s){const a=s.array,n=a.rows[0].values.length;
  let h='<div class="card arr"><div class="agrid" style="grid-template-columns:'+(a.labelWidth||130)+'px repeat('+n+',minmax(0,1fr))">';
  if(a.slots!==false)h+='<span class="al k">'+rich(a.slotLabel||'slot')+'</span>'+Array.from({length:n},(_,j)=>'<span class="ai" data-c="'+j+'">'+j+'</span>').join('');
  a.rows.forEach((r,ri)=>{h+='<span class="al">'+rich(r.label)+'</span>'+r.values.map((v,j)=>'<span class="ac" data-r="'+ri+'" data-c="'+j+'">'+esc(v)+'</span>').join('')});
  h+='</div>'+((a.meters||[]).length?'<div class="ameter">'+a.meters.map((m,j)=>'<div class="am" data-m="'+j+'"><span class="k">'+rich(m)+'</span><b>0</b></div>').join('')+'</div>':'')+'</div>';
  return head(s)+'<div class="arrwrap">'+h+extCards(s)+'</div>'},
"""

HELPERS = """/* extension helpers: a card row under an ask/array slide, and plain text for the voice */
function extCards(s){return s.cards&&s.cards.length?'<div class="grid" style="grid-template-columns:repeat('+(s.columns||Math.min(3,s.cards.length))+',1fr)">'+
 s.cards.map(c=>'<div class="card"'+st(c.step)+'><h3>'+rich(c.title)+'</h3>'+rich(c.html)+'</div>').join('')+'</div>':''}
function plain(t){return String(t==null?'':t).replace(/\\\\\\[\\[/g,'[[').replace(/\\[\\[[^\\]]*\\]\\]/g,'').replace(/<[^>]*>/g,'').replace(/\\s+/g,' ').trim()}
const RENDER={"""

HOOKS = """ /* extension: ask — answering is the only way past the question step */
 if(s.layout==='ask'){const q=s.question,fb=$('.fb',sec),bs=$$('.opt',sec),L=j=>String.fromCharCode(65+j);
  const reset=()=>{sec._answered=false;bs.forEach(b=>{b.className='opt';b.disabled=false});fb.innerHTML=''};
  bs.forEach(b=>b.onclick=e=>{e.stopPropagation();if(sec._answered)return;const j=+b.dataset.j,o=q.options[j],ok=!!o.correct,ci=q.options.findIndex(x=>x.correct),c=q.options[ci];
   sec._answered=true;bs.forEach((x,m)=>{x.disabled=true;x.classList.add(q.options[m].correct?'right':m===j?'wrong':'dim')});
   fb.innerHTML='<p class="verdict '+(ok?'ok':'no')+'">'+(ok?'Right':'Not quite')+'</p><p>'+rich(o.why)+'</p>'+(ok?'':'<p><b>The answer is '+L(ci)+'.</b> '+rich(c.why)+'</p>');
   if(voice&&HAS_TTS)speakLine((ok?'Right. ':'Not quite. ')+plain(o.why)+(ok?'':' The answer is '+plain(c.text)+'. '+plain(c.why)));
   else if(playing){clearTimeout(timer);timer=setTimeout(next,Math.max(4000,plain(fb.textContent).length*55))}});
  sec._hooks.push({stage:()=>{},reset})}
 /* extension: array — show, pick and sweep, each tied to a narration step */
 if(s.layout==='array'){const a=s.array,A=a.actions||[],cell=(r,c)=>$('.ac[data-r="'+r+'"][data-c="'+c+'"]',sec),M=$$('.am b',sec);
  let gen=0;const fmt0=v=>Number(v).toLocaleString('en-US'),setM=(i,v)=>{if(i!=null&&M[i])M[i].textContent=fmt0(v)};
  const rowsOf=x=>x.rows!=null?x.rows:x.row!=null?[x.row]:a.rows.map((_,r)=>r);
  const clear=()=>{gen++;$$('.ac',sec).forEach(e=>e.classList.remove('in','seen','hit','pick','ptr'));$$('.ai',sec).forEach(e=>e.classList.remove('pick'));M.forEach(m=>m.textContent='0')};
  const sweepTo=(x,upto)=>{const r=x.row,vals=a.rows[r].values;let read=0,acc=0,hits=0;
   for(let c=0;c<=upto;c++){const el=cell(r,c),v=Number(vals[c]);read++;el.classList.add('seen');
    if(x.mode==='sum')acc+=v;else if(x.mode==='match'&&String(vals[c])===String(x.match)){hits++;el.classList.add('hit')}}
   setM(x.readMeter,read);if(x.mode==='sum')setM(x.resultMeter,acc);if(x.mode==='match')setM(x.resultMeter,hits)};
  const stageA=k=>{clear();const g=gen;
   A.filter(x=>x.step<=k).forEach(x=>{const live=x.step===k;
    if(x.do==='show')rowsOf(x).forEach(r=>a.rows[r].values.forEach((_,c)=>{const el=cell(r,c);if(live){el._t=setTimeout(()=>{if(g===gen)el.classList.add('in')},c*45+r*120)}else el.classList.add('in')}));
    if(x.do==='pick')(x.slots||[]).forEach(c=>{rowsOf(x).forEach(r=>cell(r,c).classList.add('pick'));const i=$('.ai[data-c="'+c+'"]',sec);if(i)i.classList.add('pick')});
    if(x.do==='sweep'){const n=a.rows[x.row].values.length;
     if(!live)sweepTo(x,n-1);else{let c=0;(function tick(){if(g!==gen)return;$$('.ac.ptr',sec).forEach(e=>e.classList.remove('ptr'));
      if(c>=n)return;sweepTo(x,c);cell(x.row,c).classList.add('ptr');c++;setTimeout(tick,x.speed||140)})()}}})};
  sec._hooks.push({stage:stageA,reset:clear})}
"""

NEXT_OLD = "function next(){stopSpeech();"
NEXT_NEW = """/* extension: an unanswered question holds the deck on its question step */
function blocked(){const s=DECK.slides[cur];return s.layout==='ask'&&line===s.question.step&&!S[cur]._answered}
function nudge(){const s=S[cur];s.classList.remove('nudge');void s.offsetWidth;s.classList.add('nudge');
 const fb=$('.fb',s);if(fb&&!fb.textContent.trim())fb.innerHTML='<p class="hint">Choose an answer to carry on.</p>'}
function next(){if(blocked()){nudge();return}stopSpeech();"""

HOOK_ANCHOR = "/* authoring check: warns (console only) when a step number has no narration line */"
HOOK_CLOSE = "   reset:()=>{sec._tok=0;tks.forEach(t=>{clearTimeout(t._t);t.classList.remove('in','fade')});fills.forEach(f=>f.style.width='0')}})}});"
HOOK_CLOSE_NEW = "   reset:()=>{sec._tok=0;tks.forEach(t=>{clearTimeout(t._t);t.classList.remove('in','fade')});fills.forEach(f=>f.style.width='0')}})}\n" + HOOKS + "});"


def once(text, old, new):
    if text.count(old) != 1:
        sys.exit(f'anchor not found exactly once: {old[:70]!r}')
    return text.replace(old, new)


# ---------------------------------------------------------------- code layout ----
# `code`: a program built up one piece per slide. The listing shows only the lines written
# so far (earlier pieces plain, this slide's new lines highlighted and revealed on their
# step), with a gap marker where unwritten lines will go. An optional question sits beside
# it and, as on `ask`, holds the deck until it is answered — so the viewer decides what
# the next lines must do before seeing them. `full: true` shows the entire file.
MARK2 = '/* ---- extension: code layout ---- */'

CSS2 = MARK2 + """
.codegrid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);grid-template-rows:minmax(0,1fr);gap:12px;flex:1;min-height:0}
.codegrid.solo{grid-template-columns:minmax(0,1fr)}
.codeside{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0;overflow:hidden}
.codeside>.card{flex:none}
.codecard{display:flex;flex-direction:column;min-height:0;height:100%;padding:0;overflow:hidden}
.codecard .k{padding:10px 14px 6px;margin:0;border-bottom:1px solid var(--hair)}
.codep{flex:1;min-height:0;overflow:auto;margin:0;padding:8px 0;font-family:var(--f-mono);font-size:12.5px;line-height:1.5;background:var(--code)}
.codep .ln{display:grid;grid-template-columns:44px 1fr;white-space:pre;color:var(--ink);padding-right:14px}
.codep .ln i{font-style:normal;color:var(--faint);text-align:right;padding-right:12px;user-select:none}
.codep .ln.fresh{background:var(--acc-soft);box-shadow:inset 3px 0 0 var(--acc)}
.codep .ln.fresh[data-st]:not(.lit){opacity:0;filter:none}
.codep .gap{color:var(--faint);padding:2px 0 2px 56px;font-style:italic;font-size:11.5px}
.askq.compact .qtext{font-size:19px}
.askq.compact .opts{grid-template-columns:1fr}
"""

RENDER2 = """ /* extension: code layout */
 code(s){const c=s.code,L=c.lines,shown=new Set(),fresh=new Set();
  (c.shown||[]).forEach(([a,b])=>{for(let i=a;i<=b;i++)shown.add(i)});(c.fresh||[]).forEach(([a,b])=>{for(let i=a;i<=b;i++)fresh.add(i)});
  if(c.full)L.forEach((_,i)=>shown.add(i));
  let h='',prev=-1;L.forEach((t,i)=>{if(!shown.has(i)&&!fresh.has(i))return;
   if(prev>=0&&i>prev+1)h+='<div class="gap">⋯ '+(i-prev-1)+' line'+(i-prev-1===1?'':'s')+' not written yet</div>';
   h+='<div class="ln'+(fresh.has(i)?' fresh':'')+'" data-n="'+i+'"'+(fresh.has(i)?st(c.step):'')+'><i>'+(i+1)+'</i><span>'+esc(t)+'</span></div>';prev=i});
  if(c.full)h=h.split('not written yet').join('');
  const panel='<div class="card codecard"><p class="k">'+rich(c.label||'the program so far')+'</p><div class="codep">'+h+'</div></div>';
  let side='';
  if(s.question){const q=s.question;side+='<div class="card askq compact"'+st(q.step)+'><p class="k">'+rich(q.label||'Your turn · pick an answer')+'</p><p class="qtext">'+rich(q.prompt)+'</p><div class="opts">'+
   q.options.map((o,j)=>'<button type="button" class="opt" data-j="'+j+'"><i>'+String.fromCharCode(65+j)+'</i><span>'+rich(o.text)+'</span></button>').join('')+'</div><div class="fb" aria-live="polite"></div></div>'}
  if(s.cards&&s.cards.length)side+=s.cards.map(x=>'<div class="card"'+st(x.step)+'><h3>'+rich(x.title)+'</h3>'+rich(x.html)+'</div>').join('');
  return head(s)+'<div class="codegrid'+(side?'':' solo')+'">'+(side?'<div class="codeside">'+side+'</div>':'')+panel+'</div>'},
"""

HOOKS2 = """ /* extension: code — keep the newest lines in view as they appear */
 if(s.layout==='code'){const pane=$('.codep',sec),fr=$$('.ln.fresh',sec);
  sec._hooks.push({stage:k=>{const first=fr.find(e=>e.classList.contains('lit')||!e.hasAttribute('data-st'));
    if(first&&pane)pane.scrollTop=Math.max(0,first.offsetTop-pane.offsetTop-pane.clientHeight*0.25)},
   reset:()=>{if(pane)pane.scrollTop=0}})}
"""


def extend_code(t):
    if MARK2 in t:
        return t, False
    t = once(t, '</style>', CSS2 + '</style>')
    t = once(t, ' /* extension: ask + array layouts */\n', RENDER2 + ' /* extension: ask + array layouts */\n')
    # the question machinery (answer, feedback, the hold on the question step) is shared:
    # it applies to any slide that carries a `question`, not only to the `ask` layout
    t = once(t, " if(s.layout==='ask'){const q=s.question,fb=$('.fb',sec)", " if(s.question){const q=s.question,fb=$('.fb',sec)")
    t = once(t, "function blocked(){const s=DECK.slides[cur];return s.layout==='ask'&&line===s.question.step&&!S[cur]._answered}",
                "function blocked(){const s=DECK.slides[cur];return !!s.question&&line===s.question.step&&!S[cur]._answered}")
    t = once(t, " /* extension: array — show, pick and sweep", HOOKS2 + " /* extension: array — show, pick and sweep")
    return t, True


def main():
    t = open(PATH, encoding='utf-8').read()
    changed = []
    if MARK not in t:
        t = once(t, '</style>', CSS + '</style>')
        t = once(t, 'const RENDER={', HELPERS)
        t = once(t, HELPERS, HELPERS + '\n' + RENDER)
        t = once(t, HOOK_CLOSE, HOOK_CLOSE_NEW)
        t = once(t, NEXT_OLD, NEXT_NEW)
        changed.append('ask + array')
    t, did = extend_code(t)
    if did:
        changed.append('code')
    if not changed:
        print('already extended — nothing to do')
        return 0
    open(PATH, 'w', encoding='utf-8').write(t)
    print('extended: ' + ', '.join(changed) + ' layout(s) added')
    return 0


if __name__ == '__main__':
    sys.exit(main())
