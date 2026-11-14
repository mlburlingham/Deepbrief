const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // In-process HTTP fixtures exercise the static app without a listening server.
 const url=process.env.APP_URL||'http://127.0.0.1:3000/';
 async function fixture(ctx){if(process.env.APP_URL)return;await ctx.route('http://127.0.0.1:3000/**',async route=>{const pathname=new URL(route.request().url()).pathname;const filename=pathname==='/'?'index.html':pathname.slice(1);if(!['index.html','styles.css','app.js','research.js','icon.svg'].includes(filename))return route.fulfill({status:404,body:'Not found'});await route.fulfill({path:path.resolve(__dirname,'..',filename)});});}
 await fixture(context);
 await page.goto(url);
 await fs.mkdir(path.resolve(__dirname,'../test-results'),{recursive:true});
 await page.screenshot({path:path.resolve(__dirname,'../test-results/initial-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.resolve(__dirname,'../test-results/initial-iphone.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.notebook-filters > summary').click();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.notebook-filters').evaluate(el=>el.open),false);
 assert.equal(await page.locator('.brief-card').count(),1);
 await page.getByRole('button',{name:'The Monroe Institute',exact:true}).click();
 assert.equal(await page.locator('.research-section').count(),5);
 assert.equal(await page.locator('.research-section a').count(),3);
 // Markdown contains all sections and source links.
 await page.locator('.brief-options > summary').click();
 const mdDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Markdown',exact:true}).click();
 const md=await fs.readFile(await (await mdDownload).path(),'utf8');
 for(const heading of ['Research question','Summary','Key claims','Supporting evidence','Sources','Unanswered questions'])assert(md.includes('## '+heading));
 assert(md.includes('https://doi.org/'));
 await page.getByRole('button',{name:'All briefs',exact:true}).click();
 await page.getByRole('button',{name:'New brief',exact:true}).click();
 const editor=page.locator('#editor');
 await editor.locator('[name=title]').fill('Ocean research');
 await editor.locator('[name=topic]').fill('Climate');
 await editor.locator('[name=question]').fill('How does ocean warming affect reefs?');
 await editor.locator('[name=summary]').fill('Summary with <img src=x onerror=alert(1)>');
 await editor.locator('[name=claims]').fill('Claim one\nClaim two');
 await editor.locator('[name=evidence]').fill('Study result [1]');
 await editor.locator('[name=sources]').fill('Reef source | https://example.org/reefs');
 await editor.locator('[name=questions]').fill('How fast?\nWhere next?');
 await editor.getByRole('button',{name:'Save brief'}).click();
 await page.locator('#detail h1').filter({hasText:'Ocean research'}).waitFor();
 assert.equal(await page.locator('#detail img').count(),0);
 await page.reload();assert.equal(await page.locator('.brief-card').count(),2);
 await page.getByRole('searchbox').fill('reefs');assert.equal(await page.locator('.brief-card').count(),1);
 await page.getByRole('searchbox').fill('impossiblequery');assert.equal(await page.locator('.brief-card').count(),0);
 await page.getByRole('button',{name:'Clear search & filters'}).click();
 await page.getByRole('button',{name:'Ocean research',exact:true}).click();
 await page.getByRole('button',{name:'Edit brief',exact:true}).click();
 await editor.locator('[name=status]').selectOption('complete');
 await editor.locator('[name=summary]').fill('Edited and saved');
 await editor.getByRole('button',{name:'Save brief'}).click();
 await page.getByRole('button',{name:'All briefs',exact:true}).click();
 await page.locator('.notebook-filters > summary').click();
 await page.getByRole('button',{name:'Completed',exact:true}).click();assert.equal(await page.locator('.brief-card').count(),1);
 await page.locator('.notebook-filters > summary').click();
 await page.getByRole('button',{name:'All',exact:true}).click();
 await page.getByRole('button',{name:'Pin Ocean research',exact:true}).click();
 await page.getByRole('button',{name:'Pinned briefs',exact:true}).click();assert.equal(await page.locator('.brief-card').count(),2);
 // Export, delete, and restore a complete backup.
 await page.locator('.notebook-tools > summary').click();
 const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
 const backupPath=await (await backupDownload).path();const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));assert.equal(backup.briefs.length,2);
 await page.getByRole('button',{name:'Ocean research',exact:true}).click();await page.locator('.brief-options > summary').click();await page.getByRole('button',{name:'Delete this brief'}).click();
 await page.locator('#confirm-dialog').getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('#detail h1').textContent(),'Ocean research');
 await page.locator('.brief-options > summary').click();
 await page.getByRole('button',{name:'Delete this brief'}).click();await page.locator('#confirm-dialog').getByRole('button',{name:'Delete brief',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.brief-card').length===1);
 await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForFunction(()=>document.querySelectorAll('.brief-card').length===2);
 await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('not valid JSON'));assert.equal(await page.locator('.brief-card').count(),2);
 const unsafe=structuredClone(backup);unsafe.briefs[0].sources[0].url='javascript:alert(1)';
 await page.locator('#import-file').setInputFiles({name:'unsafe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unsafe))});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('valid http'));assert.equal(await page.locator('.brief-card').count(),2);
 // Existing IDs with modified content are preserved as separate copies.
 const conflict=structuredClone(backup);conflict.briefs=conflict.briefs.slice(0,1);conflict.briefs[0].summary='A different revision';
 await page.locator('#import-file').setInputFiles({name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflict))});
 await page.waitForFunction(()=>document.querySelectorAll('.brief-card').length===3);
 // Mobile widths, editor, keyboard controls, and no horizontal overflow.
 await fs.mkdir(path.resolve(__dirname,'../test-results'),{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.resolve(__dirname,'../test-results/iphone.png'),fullPage:true});
 for(const width of [320,375,390,430,768,1440]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}: ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))))}`);
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'New brief',exact:true}).click();
 assert(await editor.isVisible());assert(await page.evaluate(()=>document.querySelector('#editor').scrollWidth<=document.querySelector('#editor').clientWidth));
 await page.keyboard.press('Escape');assert(!(await editor.isVisible()));
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.resolve(__dirname,'../test-results/desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 // A completely emptied notebook stays empty after reopening.
 await page.evaluate(()=>localStorage.setItem('deepbrief.notebook.v1',JSON.stringify({version:1,briefs:[]})));await page.reload();assert.equal(await page.locator('.brief-card').count(),0);
 await context.close();
 // Storage failure does not falsely claim a saved brief.
 const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('Blocked');};});
 await fixture(blocked);const blockedPage=await blocked.newPage();await blockedPage.goto(url);assert(await blockedPage.locator('.storage-warning').isVisible());
 await blocked.close();await browser.close();console.log('PASS: CRUD, persistence, full-text search, filters, pinning, Markdown, backups, safe imports, XSS text handling, empty state, storage failure, and responsive layouts.');
})().catch(e=>{console.error(e);process.exit(1);});
