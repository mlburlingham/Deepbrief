const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror',e=>errors.push(e.message));
    const appUrl = process.env.APP_URL || 'http://127.0.0.1:3000/';
    if (!process.env.APP_URL) await context.route('http://127.0.0.1:3000/**',async route=>{
      const url = new URL(route.request().url());
      const file = url.pathname.slice(1) || 'index.html';
      if (file === 'research.js' && !url.search) return route.fulfill({contentType:'text/javascript',body:'throw Error("Stale unversioned script");'});
      if (!['index.html','styles.css','app.js','research.js','icon.svg'].includes(file)) return route.fulfill({status:404});
      await route.fulfill({path:path.resolve(__dirname,'..',file)});
    });
    let mode = 'normal';
    const wikiUrl='https://en.wikipedia.org/wiki/Monroe_Institute';
    const wiki={query:{pages:[{title:'Binaural beat',fullurl:'https://en.wikipedia.org/wiki/Binaural_beat',index:2,extract:''},{title:'Monroe Institute <script>bad()</script>',fullurl:wikiUrl,index:1,extract:'Background <img src="https://evil.example/track" onerror="alert(1)"> excerpt &amp; context.'},{title:'Unsafe',fullurl:'javascript:alert(1)',index:3,extract:'Do not import'}]}};
    const papers={message:{items:[{title:['<i>Binaural beats</i> and attention'],DOI:'10.1234/attention',abstract:'<jats:p>A study with &lt;b&gt;context&lt;/b&gt; and limitations.</jats:p>',author:[{family:'Researcher'}],publisher:'Research Press',published:{'date-parts':[[2025]]}},{title:['Metadata only'],DOI:'10.1234/metadata'},{title:['Duplicate'],DOI:'10.1234/metadata'},{title:['Unsafe'],URL:'javascript:alert(1)'}]}};
    const europe={resultList:{result:[{id:'12345',source:'MED',title:'A biomedical finding',abstractText:'<p>Evidence from a study.</p>',authorString:'Smith J',pubYear:'2024'}]}};
    const books={docs:[{key:'/works/OL123W',title:'A research book',author_name:['Jane Writer'],first_publish_year:2020},{key:'//evil.example',title:'Unsafe'}]};
    const fixtures={'en.wikipedia.org':wiki,'api.crossref.org':papers,'www.ebi.ac.uk':europe,'openlibrary.org':books};
    const empty={'en.wikipedia.org':{batchcomplete:true},'api.crossref.org':{message:{items:[]}},'www.ebi.ac.uk':{resultList:{result:[]}},'openlibrary.org':{docs:[]}};
    for (const host of Object.keys(fixtures)) await context.route(`https://${host}/**`,async route=>{
      requests.push({url:route.request().url(),headers:await route.request().allHeaders()});
      const headers={'access-control-allow-origin':'*'};
      if(mode==='offline')return route.abort('internetdisconnected');
      if(mode==='rate-limit'||(mode==='partial'&&host==='api.crossref.org'))return route.fulfill({status:429,headers,body:'busy'});
      if(mode==='bad-json')return route.fulfill({headers,contentType:'application/json',body:'{bad'});
      if(mode==='slow'){await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({headers,json:fixtures[host]}).catch(()=>{});}
      return route.fulfill({headers,json:mode==='empty'?empty[host]:mode==='api-error'?{error:{info:'bad search'}}:fixtures[host]});
    });
    await context.addCookies([{name:'must-not-send',value:'secret',domain:'en.wikipedia.org',path:'/',secure:true}]);
    await page.goto(appUrl);
    const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('deepbrief.notebook.v1')));
    const target={...structuredClone(initial.briefs[0]),id:'research-target',title:'Reef restoration',topic:'Ocean',demo:false,pinned:false,summary:'PRIVATE ORIGINAL SUMMARY',question:'PRIVATE QUESTION',claims:[],evidence:['Existing evidence to keep.'],questions:[],sources:[{title:'Existing source',url:'https://example.org/first'},{title:'Saved Wikipedia source',url:wikiUrl}]};
    await page.evaluate(data=>localStorage.setItem('deepbrief.notebook.v1',JSON.stringify(data)),{version:1,briefs:[initial.briefs[0],target]});
    await page.reload();
    const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('deepbrief.notebook.v1')).briefs);
    const savedTarget=async()=>(await data()).find(b=>b.id===target.id);
    const dialog=page.locator('#research-dialog');
    const query=dialog.locator('#research-query');
    const result=name=>dialog.locator('.research-result').filter({has:page.getByRole('link',{name,exact:true})});
    const add=name=>result(name).getByRole('button',{name:'Add to brief',exact:true}).click();
    const done=()=>dialog.getByRole('button',{name:'Done',exact:true}).click();
    const paste=()=>dialog.getByRole('button',{name:'Paste a link',exact:true}).click();
    const search=async text=>{
      await query.fill(text);await dialog.getByRole('button',{name:'Search',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#research-results').getAttribute('aria-busy')==='false');
    };
    const provider=async value=>{
      if(!await dialog.locator('.search-options').evaluate(el=>el.open))await dialog.locator('.search-options > summary').click();
      await dialog.locator('#research-provider').selectOption(value);
    };
    const capture=async (suffix,note)=>{
      await dialog.locator('#capture-url').fill('https://example.org/'+suffix);
      await dialog.locator('#capture-note').fill(note);
      await dialog.locator('#capture-form').getByRole('button',{name:'Add to brief',exact:true}).click();
    };
    assert.equal(requests.length,0,'No automatic searches');
    await page.getByRole('button',{name:'Find sources for Reef restoration',exact:true}).click();
    assert.equal(await query.inputValue(),'Reef restoration');
    assert.equal(await dialog.locator('#research-provider').inputValue(),'all');
    assert.equal(await dialog.locator('input[type=checkbox]').count(),0,'One add action per result');
    assert.equal(requests.length,0,'Opening a picker is private');
    const searchText='Monroe & perception / "evidence"?';
    await search(searchText);
    assert.equal(requests.length,4,'One search covers all four providers');
    for(const req of requests){const url=new URL(req.url);assert.equal(url.searchParams.get('gsrsearch')||url.searchParams.get('query')||url.searchParams.get('q'),searchText);assert(!req.headers.cookie);assert(!req.headers.referer);assert(!req.url.includes('PRIVATE'));}
    assert.equal(await dialog.locator('.research-result').count(),6,'Safe, deduplicated, mixed results');
    assert.equal(await dialog.locator('.research-result img,.research-result script').count(),0);
    await add('Monroe Institute');
    let imported=await savedTarget();
    assert.equal(imported.sources.length,2);assert.equal(imported.evidence.length,2);
    assert(imported.evidence[1].includes('[2]'));assert(imported.evidence[1].includes('Unreviewed excerpt'));assert(imported.evidence[1].includes('Wikipedia contributors, CC BY-SA'));
    assert.equal(imported.summary,target.summary);
    assert.deepEqual((await data()).find(b=>b.id!==target.id),initial.briefs[0]);
    assert(await result('Monroe Institute').getByRole('button',{name:'Added',exact:true}).isDisabled());
    await search(searchText);await add('Monroe Institute');
    assert.equal((await savedTarget()).evidence.length,2);assert((await dialog.locator('#research-feedback').textContent()).includes('Already'));
    // A selected field is the only destination that changes.
    await dialog.locator('#research-target').selectOption('summary');
    await add('Binaural beats and attention');
    imported=await savedTarget();assert(imported.summary.startsWith(target.summary+'\n\n'));assert(imported.summary.includes('Unreviewed excerpt — Crossref'));assert.equal(imported.sources.length,3);assert.equal(imported.evidence.length,2);
    const summaryBefore=imported.summary;await add('Metadata only');assert.equal((await savedTarget()).summary,summaryBefore);assert.equal((await savedTarget()).sources.length,4);
    await dialog.locator('#research-target').selectOption('claims');await add('A biomedical finding');
    assert((await savedTarget()).claims[0].includes('Europe PMC'));
    await add('A research book');assert.equal((await savedTarget()).sources.length,6);assert.equal((await savedTarget()).claims.length,1);
    // Edited excerpts and link-only additions preserve attribution and numbering.
    await dialog.locator('#research-target').selectOption('summary');
    await result('Monroe Institute').locator('.result-edit > summary').click();
    await result('Monroe Institute').locator('[data-excerpt]').fill('A shorter note with context.');
    await add('Monroe Institute');assert((await savedTarget()).summary.includes('Unreviewed edited note'));assert((await savedTarget()).summary.includes('A shorter note with context. [2]'));
    await result('Binaural beat').locator('.result-edit > summary').click();await result('Binaural beat').locator('[data-excerpt]').fill('');
    const beforeLinkOnly=(await savedTarget()).summary;await add('Binaural beat');assert.equal((await savedTarget()).summary,beforeLinkOnly);
    // Mode switches preserve a pasted draft and do not trigger any requests.
    const requestCount=requests.length;await paste();
    assert(await dialog.locator('#paste-panel').isVisible());assert(!(await query.isVisible()));
    await dialog.locator('#capture-note').fill('Keep this pasted draft.');
    await dialog.getByRole('button',{name:'Search sources',exact:true}).click();await paste();
    assert.equal(await dialog.locator('#capture-note').inputValue(),'Keep this pasted draft.');assert.equal(requests.length,requestCount);
    await dialog.locator('#research-target').selectOption('evidence');
    await dialog.locator('#capture-url').fill('javascript:alert(1)');await dialog.locator('#capture-form').getByRole('button',{name:'Add to brief',exact:true}).click();
    assert((await dialog.locator('#research-feedback').textContent()).includes('valid http'));
    await dialog.locator('#capture-url').fill('https://www.example.net/pasted-study');
    await dialog.locator('#capture-form').getByRole('button',{name:'Add to brief',exact:true}).click();
    assert((await savedTarget()).sources.some(s=>s.title.startsWith('example.net — Web capture')));
    assert((await savedTarget()).evidence.some(s=>s.includes('Keep this pasted draft.')));
    // Failed saves retain the capture form and the existing notebook.
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};});
    const beforeFailed=(await savedTarget()).sources.length;
    await capture('unsaved','Do not lose this text.');
    assert((await dialog.locator('#research-feedback').textContent()).includes('Could not save'));assert.equal((await savedTarget()).sources.length,beforeFailed);assert.equal(await dialog.locator('#capture-note').inputValue(),'Do not lose this text.');
    page.once('dialog',prompt=>prompt.dismiss());await done();assert(await dialog.isVisible());
    page.once('dialog',prompt=>prompt.accept());await done();
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    await page.reload();assert((await savedTarget()).evidence.some(s=>s.includes('Keep this pasted draft.')));
    // All saved field shortcuts open the same picker with the right destination.
    await page.getByRole('button',{name:'Reef restoration',exact:true}).click();
    for(const [field,label] of Object.entries({question:'Research question',summary:'Summary',claims:'Key claims',evidence:'Supporting evidence',sources:'Sources',questions:'Unanswered questions'})){
      await page.getByRole('button',{name:'Find sources for '+label,exact:true}).click();assert.equal(await dialog.locator('#research-target').inputValue(),field);
      await paste();await capture('field/'+field,'Context for '+field);
      const updated=await savedTarget();if(field==='sources')assert(updated.sources.some(s=>s.url.endsWith('/field/sources')));else assert((Array.isArray(updated[field])?updated[field].join(' '):updated[field]).includes('Context for '+field));
      await done();
    }
    // Exports keep imported text and provenance.
    await page.locator('.brief-options > summary').click();
    let download=page.waitForEvent('download');await page.getByRole('button',{name:'Markdown',exact:true}).click();
    const md=await fs.readFile(await(await download).path(),'utf8');assert(md.includes('Retrieved'));assert(md.includes('A shorter note with context.'));assert(md.includes('https://doi.org/10.1234/attention'));
    await page.locator('.notebook-tools > summary').click();download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
    const backup=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));assert(backup.briefs.find(b=>b.id===target.id).sources.length>=7);
    // An editor search adds only to its unsaved draft until Save brief.
    await page.getByRole('link',{name:'DeepBrief home'}).click();await page.getByRole('button',{name:'New brief',exact:true}).click();
    const editor=page.locator('#editor');await editor.locator('[name=title]').fill('Draft with field research');await editor.locator('[name=summary]').fill('Keep this draft summary.');
    const countBefore=(await data()).length;assert.equal(await editor.locator('[data-research-field]').count(),6);
    await editor.getByRole('button',{name:'Find sources for Key claims',exact:true}).click();await paste();await capture('draft-source','A draft finding.');
    assert((await dialog.locator('#research-feedback').textContent()).includes('Save brief'));assert.equal((await data()).length,countBefore);
    await done();assert.equal(await editor.locator('[name=summary]').inputValue(),'Keep this draft summary.');assert((await editor.locator('[name=claims]').inputValue()).includes('A draft finding.'));
    await editor.getByRole('button',{name:'Save brief'}).click();assert((await data()).some(b=>b.title==='Draft with field research'&&b.claims[0].includes('A draft finding.')));
    // Optional source filters, partial failures, and empty/error states.
    await page.locator('#detail').getByRole('button',{name:'Find sources',exact:true}).click();
    await provider('europepmc');const beforeSingle=requests.length;await search('a paper');assert.equal(requests.length,beforeSingle+1);assert.equal(await dialog.locator('.research-result').count(),1);
    await provider('openlibrary');await search('books');assert.equal(await dialog.locator('.research-result').count(),1);assert((await dialog.locator('.result-meta').textContent()).includes('Jane Writer'));
    await provider('all');mode='partial';await search('partially available');assert.equal(await dialog.locator('.research-result').count(),4);assert((await dialog.locator('#research-status').textContent()).includes('Some sources'));
    for(const [failure,expected] of [['empty','No results'],['rate-limit','busy'],['bad-json','unreadable'],['offline','Could not reach'],['api-error','could not complete']]){
      mode=failure;await search('check');assert((await dialog.locator('#research-status').textContent()).includes(expected),failure);assert.equal(await dialog.locator('.research-result').count(),0);
    }
    mode='slow';await page.evaluate(()=>{window.originalTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.originalTimeout(fn,ms===12000?10:ms,...args);});
    await search('timeout');assert((await dialog.locator('#research-status').textContent()).includes('timed out'));await page.evaluate(()=>{window.setTimeout=window.originalTimeout;});
    await query.fill('late response');await dialog.getByRole('button',{name:'Search',exact:true}).click();await done();
    await page.locator('#detail').getByRole('button',{name:'Find sources',exact:true}).click();mode='normal';await search('current search');
    assert.equal(await dialog.locator('.research-result').count(),6);await page.waitForTimeout(300);assert.equal(await dialog.locator('.research-result').count(),6);
    // Unsaved result text survives mode switches and prompts on dismissal.
    await result('Monroe Institute').locator('.result-edit > summary').click();await result('Monroe Institute').locator('[data-excerpt]').fill('An unsaved edited note.');
    await paste();await dialog.getByRole('button',{name:'Search sources',exact:true}).click();assert.equal(await result('Monroe Institute').locator('[data-excerpt]').inputValue(),'An unsaved edited note.');
    page.once('dialog',prompt=>prompt.dismiss());await done();assert(await dialog.isVisible());page.once('dialog',prompt=>prompt.accept());await done();assert(!(await dialog.isVisible()));
    // Screenshots and responsive checks cover both modes and editor layout.
    await page.locator('#detail').getByRole('button',{name:'Find sources',exact:true}).click();await search('Monroe Institute');
    await fs.mkdir(path.resolve(__dirname,'../test-results'),{recursive:true});
    for(const width of [320,375,390,430,768,1440]){
      await page.setViewportSize({width,height:844});
      assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),`Search overflow at ${width}`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow at ${width}`);
      if(width===390||width===1440)await page.screenshot({path:path.resolve(__dirname,`../test-results/simple-search-${width}.png`)});
      await paste();assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),`Paste overflow at ${width}`);
      if(width===390)await page.screenshot({path:path.resolve(__dirname,'../test-results/simple-paste-390.png')});
      await dialog.getByRole('button',{name:'Search sources',exact:true}).click();
    }
    await done();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Edit brief',exact:true}).click();
    assert(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth));await page.screenshot({path:path.resolve(__dirname,'../test-results/simple-editor-390.png')});
    await page.keyboard.press('Escape');assert(!(await editor.isVisible()));
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS: unified source search, privacy, partial failures, simple imports, edited text, paste mode, citations, duplicates, draft fields, exports, storage failure, cancellation, and mobile layouts.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
