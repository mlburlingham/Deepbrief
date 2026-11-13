const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless:true, args:['--no-sandbox']
  });
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    const appUrl = process.env.APP_URL || 'http://127.0.0.1:3000/';
    if (!process.env.APP_URL) await context.route('http://127.0.0.1:3000/**', async route => {
      const file = new URL(route.request().url()).pathname.slice(1) || 'index.html';
      if (!['index.html','app.js','research.js','styles.css','icon.svg'].includes(file)) return route.fulfill({status:404});
      await route.fulfill({path:path.resolve(__dirname,'..',file)});
    });
    let mode = 'wikipedia';
    const wikiUrl = 'https://en.wikipedia.org/wiki/Monroe_Institute';
    const wiki = {query:{pages:[
      {title:'Binaural beat',fullurl:'https://en.wikipedia.org/wiki/Binaural_beat',index:2,extract:''},
      {title:'Monroe Institute <script>bad()</script>',fullurl:wikiUrl,index:1,extract:'Background <img src="https://evil.example/track" onerror="alert(1)"> excerpt &amp; context.'},
      {title:'Unsafe',fullurl:'javascript:alert(1)',index:3,extract:'Do not import'}
    ]}};
    const papers = {message:{items:[
      {title:['<i>Binaural beats</i> and attention'],DOI:'10.1234/attention',abstract:'<jats:title>Abstract</jats:title><jats:p>A short study excerpt with &lt;b&gt;context&lt;/b&gt; and limitations.</jats:p>',author:[{family:'Researcher'}],publisher:'Research Press',published:{'date-parts':[[2025]]}},
      {title:['Metadata only'],DOI:'10.1234/metadata',publisher:'Research Press'},
      {title:['Unsafe URL'],URL:'javascript:alert(1)'},
      {title:['Duplicate'],DOI:'10.1234/metadata'}
    ]}};
    for (const host of ['en.wikipedia.org','api.crossref.org']) {
      await context.route(`https://${host}/**`, async route => {
        requests.push({url:route.request().url(),headers:await route.request().allHeaders()});
        const headers = {'access-control-allow-origin':'*'};
        if (mode === 'offline') return route.abort('internetdisconnected');
        if (mode === 'rate-limit') return route.fulfill({status:429,headers,body:'busy'});
        if (mode === 'bad-json') return route.fulfill({status:200,headers,contentType:'application/json',body:'{bad'});
        if (mode === 'slow') {
          await new Promise(resolve => setTimeout(resolve, 250));
          return route.fulfill({headers,json:wiki}).catch(()=>{});
        }
        const body = mode === 'empty' ? {batchcomplete:true} : mode === 'api-error' ? {error:{info:'bad search'}} : host === 'en.wikipedia.org' ? wiki : papers;
        await route.fulfill({headers,json:body});
      });
    }
    await context.addCookies([{name:'must-not-send',value:'secret',domain:'en.wikipedia.org',path:'/',secure:true}]);
    await page.goto(appUrl);
    const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('deepbrief.notebook.v1')));
    const target = {...structuredClone(initial.briefs[0]),id:'research-target',title:'Reef restoration',topic:'Ocean',demo:false,pinned:false,
      summary:'PRIVATE ORIGINAL SUMMARY',question:'PRIVATE QUESTION',claims:[],evidence:['Existing evidence to keep.'],questions:[],
      sources:[{title:'Existing source',url:'https://example.org/first'},{title:'Saved Wikipedia source',url:wikiUrl}]};
    await page.evaluate(data => localStorage.setItem('deepbrief.notebook.v1',JSON.stringify(data)),{version:1,briefs:[initial.briefs[0],target]});
    await page.reload();
    const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('deepbrief.notebook.v1')).briefs);
    const savedTarget = async () => (await data()).find(b => b.id === target.id);
    const dialog = page.locator('#research-dialog');
    const query = page.locator('#research-query');
    const search = async value => {
      await query.fill(value);
      await dialog.getByRole('button',{name:'Search',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#research-results').getAttribute('aria-busy')==='false');
    };
    const choose = async (index=0) => dialog.locator('[data-result]').nth(index).check();
    const add = () => dialog.getByRole('button',{name:'Add selected',exact:true}).click();

    assert.equal(requests.length,0,'No external requests on load');
    await page.getByRole('button',{name:'Find sources for Reef restoration',exact:true}).click();
    assert.equal(await query.inputValue(),'Reef restoration');
    assert.equal(requests.length,0,'Opening the panel does not send brief content');
    assert(await dialog.getByRole('button',{name:'Add selected',exact:true}).isDisabled());
    const searchText = 'Monroe & perception / "evidence"?';
    await search(searchText);
    assert.equal(requests.length,1);
    const req = new URL(requests[0].url);
    assert.equal(req.searchParams.get('gsrsearch'),searchText);
    assert.equal(req.searchParams.get('origin'),'*');
    assert(!requests[0].headers.cookie,'Search sends no cookies');
    assert(!requests[0].url.includes('PRIVATE'),'Brief content is never sent');
    assert.equal(await dialog.locator('.research-result').count(),2,'Unsafe URLs filtered');
    assert.equal(await dialog.locator('.research-result img,.research-result script').count(),0);
    assert.equal(await dialog.locator('.research-result h3').first().textContent(),'Monroe Institute');
    assert.equal(await dialog.getByRole('link',{name:'Search the web'}).getAttribute('href'),'https://duckduckgo.com/?q='+encodeURIComponent(searchText));
    // Existing URLs reuse their citation numbers; only this selected card changes.
    await choose();await add();
    let imported = await savedTarget();
    assert.equal(imported.sources.length,2);
    assert.equal(imported.evidence.length,2);
    assert(imported.evidence[1].includes('[2]'));
    assert(imported.evidence[1].includes('Unreviewed excerpt'));
    assert(imported.evidence[1].includes('Wikipedia contributors, CC BY-SA'));
    assert(imported.evidence[1].includes('Background excerpt & context.'));
    assert.equal(imported.summary,target.summary);
    assert.deepEqual((await data()).find(b => b.id !== target.id),initial.briefs[0]);
    assert(await dialog.locator('[data-result]').first().isDisabled());
    await search(searchText);await choose();await add();
    assert.equal((await savedTarget()).evidence.length,2,'Repeated imports do not duplicate notes');
    assert((await dialog.locator('#research-status').textContent()).includes('No duplicates'));

    // An excerpt can also be added to another destination without a new search.
    await dialog.locator('#research-target').selectOption('summary');
    assert(!(await dialog.locator('[data-result]').first().isDisabled()));
    await choose();await add();
    assert((await savedTarget()).summary.includes('Unreviewed excerpt — Wikipedia'));
    await dialog.locator('#research-target').selectOption('evidence');
    assert(await dialog.locator('[data-result]').first().isDisabled());

    // Abstracts append to summary with attribution; missing abstracts add only links.
    await dialog.locator('#research-provider').selectOption('crossref');
    await search('binaural beats');
    assert.equal(await dialog.locator('.research-result').count(),2);
    assert((await dialog.locator('.result-excerpt').first().textContent()).includes('A short study excerpt with context and limitations.'));
    await dialog.locator('#research-target').selectOption('summary');
    await choose();await add();
    imported = await savedTarget();
    assert(imported.summary.startsWith(target.summary+'\n\n'));
    assert(imported.summary.includes('Unreviewed excerpt — Crossref'));
    assert(imported.summary.includes('[3]'));
    assert.equal(imported.evidence.length,2);
    assert.equal(imported.sources.length,3);
    await choose(1);await add();
    assert.equal((await savedTarget()).sources.length,4);
    assert.equal((await savedTarget()).summary,imported.summary);

    // Sources-only mode never inserts an excerpt into notes.
    await dialog.locator('#research-provider').selectOption('wikipedia');
    await search('background');
    await dialog.locator('#research-target').selectOption('sources');
    await choose(1);await add();
    imported = await savedTarget();
    assert.equal(imported.sources.length,5);
    assert.equal(imported.evidence.length,2);

    await dialog.locator('.manual-capture summary').click();
    await dialog.locator('#capture-title').fill('A separate web source');
    await dialog.locator('#capture-url').fill('javascript:alert(1)');
    await dialog.getByRole('button',{name:'Add finding to brief'}).click();
    assert((await dialog.locator('#capture-status').textContent()).includes('valid http'));
    assert.equal((await savedTarget()).sources.length,5);
    await dialog.locator('#capture-url').fill('https://example.org/new-study');
    await dialog.locator('#capture-note').fill('A careful observation from my reading.');
    await dialog.locator('#research-target').selectOption('evidence');
    await dialog.getByRole('button',{name:'Add finding to brief'}).click();
    imported = await savedTarget();
    assert.equal(imported.sources.length,6);
    assert(imported.evidence[2].includes('Saved web note'));
    assert(imported.evidence[2].includes('[6]'));
    assert.equal(await dialog.locator('#capture-title').inputValue(),'');
    // A failed save leaves both stored content and the user's draft intact.
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};});
    await dialog.locator('#capture-title').fill('Unsaved source');
    await dialog.locator('#capture-url').fill('https://example.org/unsaved');
    await dialog.getByRole('button',{name:'Add finding to brief'}).click();
    assert((await dialog.locator('#capture-status').textContent()).includes('Could not save'));
    assert.equal((await savedTarget()).sources.length,6);
    assert.equal(await dialog.locator('#capture-title').inputValue(),'Unsaved source');
    page.once('dialog',prompt=>prompt.dismiss());
    await dialog.getByRole('button',{name:'Done',exact:true}).click();assert(await dialog.isVisible());
    page.once('dialog',prompt=>prompt.accept());
    await dialog.getByRole('button',{name:'Done',exact:true}).click();assert(!(await dialog.isVisible()));
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
    await page.reload();
    assert.equal((await savedTarget()).sources.length,6);
    assert.equal((await savedTarget()).evidence.length,3);
    // Excerpts and provenance survive both export formats.
    await page.getByRole('button',{name:'Reef restoration',exact:true}).click();
    const markdownDownload = page.waitForEvent('download');
    await page.getByRole('button',{name:'Markdown',exact:true}).click();
    const markdown = await fs.readFile(await (await markdownDownload).path(),'utf8');
    assert(markdown.includes('Retrieved'));
    assert(markdown.includes('A careful observation'));
    assert(markdown.includes('https://doi.org/10.1234/attention'));
    const backupDownload = page.waitForEvent('download');
    await page.getByRole('button',{name:'Export backup',exact:true}).click();
    const backup = JSON.parse(await fs.readFile(await (await backupDownload).path(),'utf8'));
    assert.equal(backup.briefs.find(b=>b.id===target.id).sources.length,6);

    await page.locator('#detail').getByRole('button',{name:'Find sources',exact:true}).click();
    for (const [failure, expected] of [['empty','No results'],['api-error','could not complete'],['rate-limit','busy'],['bad-json','unreadable'],['offline','Could not reach']]) {
      mode = failure; await search('check');
      assert((await dialog.locator('#research-status').textContent()).includes(expected),failure);
      assert(await dialog.getByRole('button',{name:'Add selected',exact:true}).isDisabled());
    }
    // Timeouts reset the search control, and closing invalidates late responses.
    mode = 'slow';
    await page.evaluate(()=>{
      window.originalTimeout=window.setTimeout;
      window.setTimeout=(fn,ms,...args)=>window.originalTimeout(fn,ms===12000?10:ms,...args);
    });
    await search('timeout');assert((await dialog.locator('#research-status').textContent()).includes('timed out'));
    await page.evaluate(()=>{window.setTimeout=window.originalTimeout;});
    await query.fill('late response');await dialog.getByRole('button',{name:'Search',exact:true}).click();
    await dialog.getByRole('button',{name:'Close research',exact:true}).click();
    await page.locator('#detail').getByRole('button',{name:'Find sources',exact:true}).click();
    mode = 'wikipedia'; await search('current search');
    assert.equal(await dialog.locator('.research-result').count(),2);
    assert((await dialog.locator('#research-status').textContent()).includes('current search'));
    // Screenshots and layout assertions for a useful results state.
    await fs.mkdir(path.resolve(__dirname,'../test-results'),{recursive:true});
    await page.screenshot({path:path.resolve(__dirname,'../test-results/research-iphone.png'),fullPage:true});
    for (const width of [320,375,390,430,768,1440]) {
      await page.setViewportSize({width,height:844});
      assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),`Dialog overflow at ${width}`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow at ${width}`);
    }
    await page.screenshot({path:path.resolve(__dirname,'../test-results/research-desktop.png'),fullPage:true});
    await page.keyboard.press('Escape');assert(!(await dialog.isVisible()));
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS: topic searches, explicit query privacy, omitted cookies, source safety, excerpts, citations, correct-card import, duplicates, manual capture, save failure, exports, empty/error/timeout states, request cancellation, and 320–1440px layouts.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1);});
