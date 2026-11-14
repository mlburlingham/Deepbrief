'use strict';
(() => {
const $ = (s, root = document) => root.querySelector(s);
const icons = {
 notebook:'<path d="M6 3h13v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M6 3v18M10 8h5M10 12h5"/>',
 pin:'<path d="m16 3 5 5-4 2-3 5-2 1-4-4 1-2 5-3 2-4ZM8 16l-5 5"/>',
 edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7Z"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 link:'<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
 question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2.5M12 17h.01"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 arrow:'<path d="M20 12H4m6-6-6 6 6 6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.notebook}</svg>`;
function fillIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY = 'deepbrief.notebook.v1';
const newId = () => globalThis.crypto?.randomUUID?.() || `brief-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = new Date().toISOString();
const demo = {
 id: 'monroe-demo', title: 'The Monroe Institute', topic: 'Consciousness', status: 'draft', pinned: true, demo: true,
 question: 'What does the evidence tell us about the Monroe Institute and its consciousness exploration methods?',
 summary: 'The Monroe Institute is an organization founded by Robert Monroe that offers experiential programs using guided audio to explore subjective states of consciousness. Its programs are associated with Hemi-Sync, an audio approach that includes binaural beats. Personal accounts can describe meaningful experiences, but they do not establish out-of-body perception or other paranormal abilities. A declassified 1983 Army assessment of the Gateway process is a historical source, not scientific validation. This demonstration brief is a starting point for investigation, not an exhaustive literature review.',
 claims: ['The Institute presents guided audio and experiential training as tools for exploring consciousness. [1]', 'Binaural beats have been studied for cognitive and emotional outcomes, with findings that depend on the protocol and outcome measured. This does not validate all claims about Hemi-Sync or Gateway. [3]', 'The declassified Gateway assessment documents a military analyst’s interpretation of the program; declassification does not imply government endorsement or proof. [2]'],
 evidence: ['The Institute’s own website describes its programs and mission. As a first-party source, it is useful for understanding what is offered, but it is not independent evidence of effectiveness. [1]', 'Analysis and Assessment of Gateway Process (9 June 1983), by Lt. Col. Wayne M. McDonnell, discusses theoretical explanations and recommendations. It is an interpretive report rather than a controlled clinical trial. [2]', 'García-Argibay, Santed, and Reales (2019), “Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis,” Psychological Research 83, 357–372, reports pooled effects across selected studies. Its scope is binaural beats, not verification of the Institute’s broader claims. [3]'],
 sources: [
 {title:'Monroe Institute — official website (first-party)',url:'https://www.monroeinstitute.org/'},
 {title:'Analysis and Assessment of Gateway Process — CIA Reading Room, 1983',url:'https://www.cia.gov/readingroom/document/cia-rdp96-00788r001700210016-5'},
 {title:'García-Argibay et al. (2019) — binaural beats meta-analysis',url:'https://doi.org/10.1007/s00426-018-1066-8'}],
 questions: ['Which reported benefits remain when compared with an active control matched for relaxation, attention, and expectation?', 'Are there independent, preregistered replications using the Institute’s specific audio protocols?', 'How should subjective experiences be measured separately from claims about externally verifiable perception?'],
 createdAt: now, updatedAt: now
};
let briefs = [], storageAvailable = true;
function validateBrief(b) {
 if (!b || typeof b !== 'object' || Array.isArray(b)) throw Error('Each brief must be an object.');
 for (const key of ['title','topic','question','summary']) if (typeof b[key] !== 'string' || b[key].length > 100000) throw Error(`Invalid ${key} field.`);
 if (!b.title.trim() || b.title.length > 160 || b.topic.length > 60) throw Error('Brief titles and topics are too long or missing.');
 if (!['draft','complete'].includes(b.status)) throw Error('Invalid brief status.');
 for (const key of ['claims','evidence','questions']) if (!Array.isArray(b[key]) || b[key].length > 1000 || b[key].some(x => typeof x !== 'string' || x.length > 100000)) throw Error(`Invalid ${key} list.`);
 if (!Array.isArray(b.sources) || b.sources.length > 1000 || b.sources.some(s => !s || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 100000 || typeof s.url !== 'string' || (s.url && !safeUrl(s.url)))) throw Error('Sources need titles and valid http or https URLs.');
 for (const key of ['createdAt','updatedAt']) if (typeof b[key] !== 'string' || !Number.isFinite(Date.parse(b[key]))) throw Error('Invalid date.');
 return {id: typeof b.id === 'string' && b.id ? b.id : newId(), title:b.title.trim(),topic:b.topic.trim(),question:b.question,summary:b.summary,status:b.status,claims:[...b.claims],evidence:[...b.evidence],questions:[...b.questions],sources:b.sources.map(s=>({title:s.title,url:s.url})),pinned:b.pinned === true,demo:b.demo === true,createdAt:b.createdAt,updatedAt:b.updatedAt};
}
function safeUrl(url) { try { const u = new URL(url); return ['https:','http:'].includes(u.protocol); } catch { return false; } }
try {
 const saved = localStorage.getItem(KEY);
 if (saved !== null) {
  const data = JSON.parse(saved);
  if (data.version !== 1 || !Array.isArray(data.briefs)) throw Error('Invalid stored notebook.');
  briefs = data.briefs.map(validateBrief);
  if (new Set(briefs.map(b=>b.id)).size !== briefs.length) throw Error('Duplicate brief IDs.');
 } else { briefs = [demo]; localStorage.setItem(KEY,JSON.stringify({version:1,briefs})); }
} catch { storageAvailable = false; }
let view='all', filter='all', currentId=null, editingId=null, toastTimer, editorSnapshot='';
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function save(next) {
 if (!storageAvailable) { toast('Saving is disabled because your notebook could not be loaded. Your original data is preserved.'); return false; }
 try { localStorage.setItem(KEY,JSON.stringify({version:1,briefs:next})); briefs=next; return true; }
 catch { toast('Could not save. Browser storage is unavailable or full. Export a backup.'); return false; }
}
// Research imports always read the latest saved brief and append atomically.
// The dialog keeps its own brief ID, so a dashboard search cannot target another card.
const editorResearchId = newId();
const fieldLabels = {question:'Research question',summary:'Summary',claims:'Key claims',evidence:'Supporting evidence',sources:'Sources',questions:'Unanswered questions'};
function parseSources(text) {
 return lines(text).map(line => {const split=line.lastIndexOf('|');return split<0?{title:line,url:''}:{title:line.slice(0,split).trim(),url:line.slice(split+1).trim()};});
}
function editorBrief() {
 const f=Object.fromEntries(new FormData($('#brief-form')));
 return {...f,id:editorResearchId,title:f.title.trim() || 'Untitled research',sources:parseSources(f.sources),claims:lines(f.claims),evidence:lines(f.evidence),questions:lines(f.questions),createdAt:now,updatedAt:now};
}
const research = window.DeepBriefResearch.create({getBrief:id => id === editorResearchId ? editorBrief() : briefs.find(b => b.id === id), addFindings, onView:showFinding});
function showFinding(id, field, draft) {
 if (draft) {
  const wrapper = field && $('#brief-form').elements[field]?.closest('.editor-field');
  if (wrapper) requestAnimationFrame(() => {wrapper.scrollIntoView({block:'start'});wrapper.focus({preventScroll:true});});
  return;
 }
 if (briefs.some(b => b.id === id)) openBrief(id,field);
}
function canonicalSource(url) {
 const parsed = new URL(url); parsed.hash = '';
 if (parsed.hostname === 'doi.org') parsed.pathname = parsed.pathname.toLowerCase();
 return parsed.href.replace(/\/$/, '');
}
function addFindings(id, results, target) {
 const isDraft = id === editorResearchId;
 const b = isDraft && $('#editor').open ? editorBrief() : briefs.find(item => item.id === id);
 if (!b) return {ok:false, message:'This brief is no longer available. Close research and choose another brief.'};
 if (!Object.hasOwn(fieldLabels,target)) return {ok:false, message:'Choose a destination for these findings.'};
 if (b.sources.some(source => !source.title || (source.url && !safeUrl(source.url)))) return {ok:false,message:'Fix the source titles and URLs in your draft before adding findings.'};
 const next = {...b, sources:b.sources.map(source => ({...source})), evidence:[...b.evidence], claims:[...b.claims], questions:[...b.questions]};
 const retrieved = new Date().toISOString().slice(0,10);
 let sourcesAdded = 0, notesAdded = 0;
 for (const result of results) {
  if (!result || !result.title || !safeUrl(result.url)) return {ok:false, message:'A finding has an invalid source URL. Nothing was added.'};
  let index = next.sources.findIndex(source => source.url && canonicalSource(source.url) === canonicalSource(result.url));
  if (index === -1) {
   index = next.sources.length;
   next.sources.push({title:`${result.title} — ${result.provider} (retrieved ${retrieved})`, url:result.url});
   sourcesAdded++;
  }
  if (target === 'sources' || !result.excerpt) continue;
  const marker = `${result.provider === 'Web capture' ? 'Saved web note' : result.edited ? 'Unreviewed edited note' : 'Unreviewed excerpt'} — ${result.provider} — ${result.title}: ${result.excerpt} [${index + 1}]`;
  const note = `${marker} (Retrieved ${retrieved}${result.attribution ? '; ' + result.attribution : ''}.)`;
  if (Array.isArray(next[target]) && !next[target].some(text => text.includes(marker))) {next[target].push(note); notesAdded++;}
  if (typeof next[target] === 'string' && !next[target].includes(marker)) {next[target] = [next[target], note].filter(Boolean).join('\n\n'); notesAdded++;}
 }
 if (!sourcesAdded && !notesAdded) return {ok:true, duplicate:true, notesAdded:0, sourcesAdded:0, message:'These findings are already in this brief. No duplicates added.'};
 next.updatedAt = new Date().toISOString();
 let valid;
 try {valid = validateBrief(next);} catch {return {ok:false, message:'This brief is at its size limit. Shorten it before adding more findings.'};}
 if (isDraft) {
  for (const field of Object.keys(fieldLabels)) $('#brief-form').elements[field].value = field === 'sources' ? valid.sources.map(source => source.title + (source.url ? ' | ' + source.url : '')).join('\n') : Array.isArray(valid[field]) ? valid[field].join('\n') : valid[field];
  return {ok:true,notesAdded,sourcesAdded,message:`Added ${notesAdded} note(s) and ${sourcesAdded} source(s) to your draft. Use Save brief to keep these findings.`};
 }
 if (!save(briefs.map(item => item.id === id ? valid : item))) return {ok:false, message:'Could not save findings. Browser storage is unavailable or full. Your existing brief is unchanged.'};
 render();
 return {ok:true, notesAdded, sourcesAdded, message:`Saved to “${b.title}”: ${notesAdded} note${notesAdded === 1 ? '' : 's'}, ${sourcesAdded} new source${sourcesAdded === 1 ? '' : 's'}. Review imported excerpts before drawing conclusions.`};
}
const date = iso => new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const status = b => `<span class="badge ${b.status === 'complete'?'complete':''}">${b.status==='complete'?'Completed':'In progress'}</span>`;
function render() {
 $('#nav-count').textContent=briefs.length;
 $('#stat-briefs').textContent=briefs.length;
 $('#stat-sources').textContent=briefs.reduce((n,b)=>n+b.sources.length,0);
 $('#stat-questions').textContent=briefs.reduce((n,b)=>n+b.questions.length,0);
 $('#filters-label').textContent = 'Filter & sort' + (filter === 'all' ? '' : filter === 'draft' ? ' · In progress' : ' · Completed');
 const q=$('#search').value.trim().toLowerCase();
 let items=briefs.filter(b=>(view!=='pinned'||b.pinned)&&(view!=='draft'||b.status==='draft')&&(filter==='all'||b.status===filter)&&(!q||[b.title,b.topic,b.question,b.summary,...b.claims,...b.evidence,...b.questions,...b.sources.flatMap(s=>[s.title,s.url])].join(' ').toLowerCase().includes(q)));
 const sort=$('#sort').value;
 items.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):Date.parse(b[sort==='created'?'createdAt':'updatedAt'])-Date.parse(a[sort==='created'?'createdAt':'updatedAt']));
 const label=view==='pinned'?'Pinned briefs':view==='draft'?'In progress':'All briefs';
 $('#briefs-heading').innerHTML=`${label} <span>${items.length}</span>`;
 $('#brief-grid').innerHTML=items.map(b=>`<article class="brief-card">
  <button type="button" class="card-body" data-open="${escape(b.id)}" aria-label="Open brief: ${escape(b.title)}">
   <span class="card-top"><span class="topic">${escape(b.topic||'Uncategorized')}</span></span>
   <span class="card-title">${escape(b.title)}</span>
   <span class="card-question">${escape(b.question||b.summary||'An idea waiting to be explored.')}</span>
   <span class="card-meta"><span>${icon('link')}${b.sources.length} sources</span><span>${icon('question')}${b.questions.length} open questions</span>${b.demo?'<span>Sample brief</span>':''}</span>
   <span class="card-footer">${status(b)}<span class="card-footer-end"><span>Updated ${date(b.updatedAt)}</span>${icon('arrow')}</span></span>
  </button>
  <button class="pin-button ${b.pinned?'pinned':''}" data-pin="${escape(b.id)}" aria-label="${b.pinned?'Unpin':'Pin'} ${escape(b.title)}" aria-pressed="${b.pinned}">${icon('pin')}</button>
  <div class="card-capture-actions"><button class="card-research" data-research="${escape(b.id)}" aria-label="Find sources for ${escape(b.title)}">${icon('search')}Find sources</button></div>
 </article>`).join('') + (items.length===0?`<div class="empty-state"><h3>${q?'No matching briefs':'A fresh page awaits'}</h3><p>${q?'Try another term or change your filters.':'Start with a question. See where it takes you.'}</p>${q?'<button class="button" data-reset>Clear search & filters</button>':'<button class="button primary" data-new>Create a brief</button>'}</div>`:'');
 if(currentId) renderDetail();
}
function renderDetail() {
 const b=briefs.find(x=>x.id===currentId); if(!b) return showDashboard();
 const sections=[['Summary',b.summary,'summary'],['Key claims',b.claims,'claims'],['Supporting evidence',b.evidence,'evidence'],['Sources',b.sources,'sources'],['Unanswered questions',b.questions,'questions']];
 $('#detail').innerHTML=`<div class="detail-top"><button class="back-button" data-back>${icon('arrow')}All briefs</button><div class="detail-actions"><button class="button primary" data-edit>${icon('edit')}Edit brief</button><button class="button research-button" data-research="${escape(b.id)}">${icon('search')}Find sources</button><details class="brief-options"><summary>More</summary><div class="tools-menu"><button class="nav-item" data-markdown>${icon('download')}Export Markdown</button><button class="nav-item" data-pin="${escape(b.id)}">${icon('pin')}${b.pinned?'Unpin':'Pin'} brief</button><button class="nav-item delete-action" data-delete>Delete this brief</button></div></details></div></div><header class="detail-header"><span class="topic">${escape(b.topic||'Uncategorized')}</span><h1>${escape(b.title)}</h1><div class="question-search-heading" id="brief-field-question" tabindex="-1"><span>Research question</span></div><p class="detail-question">${escape(b.question||'Add a research question to guide your thinking.')}</p><div class="detail-meta">${status(b)}<span>Updated ${date(b.updatedAt)}</span>${b.demo?'<span class="demo-label">DEMONSTRATION BRIEF</span>':''}</div></header><div class="detail-content">${sections.map(([title,content,field],i)=>`<section class="research-section" id="brief-field-${field}" tabindex="-1"><div class="field-heading"><h2><span class="section-number">0${i+1}</span>${title}</h2></div>${!content.length?'<p class="section-empty">Room for your next finding.</p>':typeof content==='string'?`<p>${escape(content)}</p>`:title==='Sources'?`<ol>${content.map(s=>`<li>${s.url&&safeUrl(s.url)?`<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)}</a>`:escape(s.title)}</li>`).join('')}</ol>`:`<ul>${content.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`}</section>`).join('')}</div>`;
}
function showDashboard() { currentId=null; $('#detail').hidden=true;$('#dashboard').hidden=false;document.title='DeepBrief — Your research, connected.';render(); }
function openBrief(id, field) {
 currentId=id; $('#dashboard').hidden=true;$('#detail').hidden=false;renderDetail();document.title=`${briefs.find(b=>b.id===id).title} — DeepBrief`;
 if (field && Object.hasOwn(fieldLabels,field)) {
  requestAnimationFrame(() => {const section=$('#brief-field-'+field);if(section){section.scrollIntoView({block:'start'});section.focus({preventScroll:true});}});
 } else {window.scrollTo(0,0);$('#main').focus({preventScroll:true});}
}
function formData() { return JSON.stringify([...new FormData($('#brief-form'))]); }
function openEditor(id=null) {
 editingId=id; const b=briefs.find(x=>x.id===id); const form=$('#brief-form');form.reset();
 $('#editor-title').textContent=b?'Edit research brief':'New research brief';
 if(b) for(const key of ['title','topic','status','question','summary','claims','evidence','sources','questions']) form.elements[key].value=key==='sources'?b.sources.map(s=>s.title+(s.url?' | '+s.url:'')).join('\n'):Array.isArray(b[key])?b[key].join('\n'):b[key];
 editorSnapshot=formData();$('#editor').showModal();$('#editor').scrollTop=0;
}
function closeEditor() { if(formData()!==editorSnapshot&&!window.confirm('Discard your unsaved changes?')) return; $('#editor').close(); }
function lines(value) { return String(value).split('\n').map(x=>x.trim()).filter(Boolean); }
$('#brief-form').addEventListener('submit',event=>{
 event.preventDefault(); const f=Object.fromEntries(new FormData(event.target));
 const existing=briefs.find(b=>b.id===editingId);
 const sources=lines(f.sources).map(line=>{const split=line.lastIndexOf('|');return split<0?{title:line,url:''}:{title:line.slice(0,split).trim(),url:line.slice(split+1).trim()};});
 let b;try { b=validateBrief({...f,id:existing?.id||newId(),pinned:existing?.pinned||false,demo:existing?.demo||false,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),claims:lines(f.claims),evidence:lines(f.evidence),questions:lines(f.questions),sources}); }catch(error){toast(error.message);return;}
 if(save(existing?briefs.map(x=>x.id===b.id?b:x):[b,...briefs])) { $('#editor').close();render();openBrief(b.id);toast(existing?'Brief updated. A clearer picture.':'Brief saved. Follow your curiosity.'); }
});
$('#new-brief').onclick=()=>openEditor();$('#close-editor').onclick=closeEditor;$('#cancel-editor').onclick=closeEditor;
$('#editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('#search').addEventListener('input',render);$('#sort').onchange=()=>{render();$('.notebook-filters').open=false;};
$('.brand').onclick=e=>{e.preventDefault();view='all';filter='all';$('#search').value='';syncNavigation();showDashboard();window.scrollTo(0,0);};
function syncNavigation(){document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});}
document.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.hasAttribute('data-view')){view=target.dataset.view;filter='all';syncNavigation();showDashboard();}
 if(target.hasAttribute('data-filter')){filter=target.dataset.filter;syncNavigation();render();$('.notebook-filters').open=false;}
 if(target.hasAttribute('data-new'))openEditor();
 if(target.hasAttribute('data-research'))research.open(target.dataset.research, {draft:target.dataset.research === editorResearchId});
 if(target.hasAttribute('data-open'))openBrief(target.dataset.open);
 if(target.hasAttribute('data-back'))showDashboard();
 if(target.hasAttribute('data-edit'))openEditor(currentId);
 if(target.hasAttribute('data-pin')){const id=target.dataset.pin;if(save(briefs.map(b=>b.id===id?{...b,pinned:!b.pinned}:b)))render();}
 if(target.hasAttribute('data-markdown'))exportMarkdown();
 if(target.hasAttribute('data-delete'))$('#confirm-dialog').showModal();
 if(target.hasAttribute('data-reset')){view='all';filter='all';$('#search').value='';syncNavigation();render();}
});
$('#confirm-dialog').addEventListener('close',()=>{if($('#confirm-dialog').returnValue==='confirm'&&currentId){if(save(briefs.filter(b=>b.id!==currentId))){showDashboard();toast('Brief deleted.');}}});
$('#layout-toggle').onclick=()=>{const list=$('#brief-grid').classList.toggle('list-view');$('#layout-toggle').innerHTML=icon(list?'grid':'list')+(list?'Grid view':'List view');$('.notebook-filters').open=false;$('#layout-toggle').setAttribute('aria-label',`Switch to ${list?'grid':'list'} view`);};
function download(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function markdown(b){
 const md=s=>String(s).replace(/([\\`*_{}\[\]<>#|!])/g,'\\$1');
 return `# ${md(b.title)}\n\nTopic: ${md(b.topic||'Uncategorized')}\nStatus: ${b.status==='complete'?'Completed':'In progress'}\nUpdated: ${b.updatedAt}\n\n## Research question\n\n${md(b.question)}\n\n## Summary\n\n${md(b.summary)}\n\n## Key claims\n\n${b.claims.map(x=>'- '+md(x)).join('\n')}\n\n## Supporting evidence\n\n${b.evidence.map(x=>'- '+md(x)).join('\n')}\n\n## Sources\n\n${b.sources.map((s,i)=>`${i+1}. ${s.url?`[${md(s.title)}](<${s.url.replace(/[<>\s\\]/g,c=>encodeURIComponent(c))}>)`:md(s.title)}`).join('\n')}\n\n## Unanswered questions\n\n${b.questions.map(x=>'- '+md(x)).join('\n')}\n`;
}
function exportMarkdown(){const b=briefs.find(x=>x.id===currentId);download(markdown(b),'text/markdown;charset=utf-8',(b.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'research-brief')+'.md');toast('Markdown exported.');}
$('#backup').onclick=()=>{$('.notebook-tools').open=false;download(JSON.stringify({app:'DeepBrief',version:1,exportedAt:new Date().toISOString(),briefs},null,2),'application/json','deepbrief-backup-'+new Date().toISOString().slice(0,10)+'.json');toast('Backup exported. Keep it somewhere safe.');};
$('#import').onclick=()=>{$('.notebook-tools').open=false;$('#import-file').click();};
$('#import-file').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try {
  if(file.size>10*1024*1024)throw Error('Backup must be smaller than 10 MB.');
  const data=JSON.parse(await file.text());
  if(data.version!==1||!Array.isArray(data.briefs)||data.briefs.length>1000)throw Error('Choose a version 1 DeepBrief JSON backup with at most 1,000 briefs.');
  const incoming=data.briefs.map(validateBrief);const ids=new Set(briefs.map(b=>b.id));
  let skipped=0; const added=[];
  for(const b of incoming){const exact=briefs.find(x=>x.id===b.id&&JSON.stringify(x)===JSON.stringify(b));if(exact){skipped++;continue;}if(ids.has(b.id))b.id=newId();ids.add(b.id);added.push(b);}
  if(save([...added,...briefs])){render();toast(`${added.length} brief${added.length===1?'':'s'} imported${skipped?`; ${skipped} unchanged skipped`:''}. Existing research kept.`);}
 }catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON. Nothing was imported.':error.message+' Nothing was imported.');}
 finally{event.target.value='';}
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){const menus=[...document.querySelectorAll('.notebook-tools[open],.notebook-filters[open],.brief-options[open]')];for(const menu of menus)menu.open=false;menus.at(-1)?.querySelector('summary').focus();}if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();showDashboard();$('#search').focus();}});
window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const data=JSON.parse(e.newValue);if(data?.version!==1||!Array.isArray(data.briefs))return;briefs=data.briefs.map(validateBrief);render();toast('Notebook updated from another tab.');}catch{toast('Could not load a change from another tab.');}});
for (const [field,label] of Object.entries(fieldLabels)) {
 const control=$('#brief-form').elements[field]; control.id='brief-'+field;
 const original=control.closest('label');
 const wrapper=document.createElement('div'); wrapper.className='editor-field';
 original.before(wrapper);
 const heading=document.createElement('div'); heading.className='editor-field-heading';
 const caption=document.createElement('label'); caption.htmlFor=control.id;caption.textContent=label;
 heading.append(caption);wrapper.tabIndex=-1;
 wrapper.append(heading);
 const help=original.querySelector('small');
 if(help){help.className='field-help';wrapper.append(help);}
 wrapper.append(control);original.remove();
}
document.addEventListener('click',event=>{
 for(const menu of document.querySelectorAll('.notebook-tools[open],.notebook-filters[open],.brief-options[open]')) if(!menu.contains(event.target)) menu.open=false;
});
$('#editor-find-sources').dataset.research=editorResearchId;
fillIcons();render();
if(!storageAvailable){const warning=document.createElement('p');warning.className='storage-warning';warning.setAttribute('role','alert');warning.textContent='Your stored notebook could not be loaded. Existing browser data has been left untouched. Export it from your browser before saving new work, or try your regular browser with storage enabled.';$('#main').prepend(warning);}
})();
