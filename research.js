'use strict';
// Public, browser-readable APIs only. No API keys, proxy, or page scraping.
window.DeepBriefResearch = (() => {
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); }
    catch { return false; }
  };
  function plainText(value, limit = 900) {
    if (typeof value !== 'string') return '';
    // Decode entities in an inert textarea after removing JATS/HTML tags.
    // Never insert external markup into the live DOM (even for text extraction).
    const decoder = document.createElement('textarea');
    decoder.innerHTML = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
    const text = decoder.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
  }
  function wikipedia(data) {
    if (data.error) throw Error('Wikipedia could not complete that search. Try a simpler topic.');
    // MediaWiki omits query when there are no generator results.
    const pages = data.query?.pages ?? [];
    if (!Array.isArray(pages)) throw Error('Wikipedia returned an unexpected response. Try again.');
    return pages.slice().sort((a,b) => (a.index ?? 0) - (b.index ?? 0)).flatMap(page => {
      const title = plainText(page.title, 500);
      if (!title || !safeUrl(page.fullurl) || new URL(page.fullurl).hostname !== 'en.wikipedia.org') return [];
      return [{title, url:page.fullurl, excerpt:plainText(page.extract), provider:'Wikipedia',
        meta:'Encyclopedia overview · review the article’s original sources',
        attribution:'Wikipedia contributors, CC BY-SA; see linked article for history and license'}];
    }).slice(0, 6);
  }
  function crossref(data) {
    if (!Array.isArray(data.message?.items)) throw Error('Crossref returned an unexpected response. Try again.');
    return data.message.items.slice(0, 6).flatMap(work => {
      const title = plainText(work.title?.[0], 500);
      const url = typeof work.DOI === 'string' && /^10\.\d{4,9}\/\S+$/i.test(work.DOI)
        ? 'https://doi.org/' + work.DOI : work.URL;
      if (!title || !safeUrl(url)) return [];
      const authors = Array.isArray(work.author) ? work.author.slice(0, 2).map(a => plainText(a.family || a.name, 80)).filter(Boolean).join(', ') : '';
      const year = work.published?.['date-parts']?.[0]?.[0];
      const meta = [authors, typeof year === 'number' ? String(year) : '', plainText(work.publisher, 120)].filter(Boolean).join(' · ');
      return [{title, url, excerpt:plainText(work.abstract), provider:'Crossref', meta:meta || 'Publication metadata', attribution:''}];
    });
  }
  function europepmc(data) {
    if (!Array.isArray(data.resultList?.result)) throw Error('Europe PMC returned an unexpected response. Try again.');
    return data.resultList.result.slice(0, 6).flatMap(work => {
      const title = plainText(work.title, 500);
      const id = typeof work.id === 'string' && /^[a-zA-Z0-9._-]+$/.test(work.id) ? work.id : '';
      const source = typeof work.source === 'string' && /^[a-zA-Z0-9]+$/.test(work.source) ? work.source : '';
      if (!title || !id || !source) return [];
      const meta = [plainText(work.authorString, 160), plainText(String(work.pubYear || ''), 10), plainText(work.journalTitle, 120)].filter(Boolean).join(' · ');
      return [{title, url:`https://europepmc.org/article/${source}/${id}`, excerpt:plainText(work.abstractText), provider:'Europe PMC', meta:meta || 'Biomedical publication', attribution:''}];
    });
  }
  function openlibrary(data) {
    if (!Array.isArray(data.docs)) throw Error('Open Library returned an unexpected response. Try again.');
    return data.docs.slice(0, 6).flatMap(book => {
      const title = plainText(book.title, 500);
      if (!title || typeof book.key !== 'string' || !/^\/works\/OL[0-9]+W$/.test(book.key)) return [];
      const authors = Array.isArray(book.author_name) ? book.author_name.slice(0, 3).map(a => plainText(a, 80)).filter(Boolean).join(', ') : '';
      const year = typeof book.first_publish_year === 'number' ? String(book.first_publish_year) : '';
      const meta = [authors, year].filter(Boolean).join(' · ');
      return [{title, url:'https://openlibrary.org' + book.key, excerpt:'', provider:'Open Library', meta:meta || 'Book record', attribution:''}];
    });
  }
  function endpoint(provider, query) {
    if (provider === 'wikipedia') {
      const params = new URLSearchParams({action:'query', generator:'search', gsrsearch:query, gsrnamespace:'0', gsrlimit:'6',
        prop:'extracts|info', exintro:'1', explaintext:'1', exchars:'900', exlimit:'6', inprop:'url', origin:'*', format:'json', formatversion:'2'});
      return 'https://en.wikipedia.org/w/api.php?' + params;
    }
    if (provider === 'europepmc') return 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?' + new URLSearchParams({query, format:'json', pageSize:'6', resultType:'core'});
    if (provider === 'openlibrary') return 'https://openlibrary.org/search.json?' + new URLSearchParams({q:query, limit:'6', fields:'key,title,author_name,first_publish_year'});
    const params = new URLSearchParams({query, rows:'6', select:'title,DOI,URL,abstract,publisher,published,author,type'});
    return 'https://api.crossref.org/works?' + params;
  }
  const providers = {
    wikipedia: {name:'Wikipedia', parse:wikipedia},
    crossref: {name:'Crossref', parse:crossref},
    europepmc: {name:'Europe PMC', parse:europepmc},
    openlibrary: {name:'Open Library', parse:openlibrary}
  };

  function create({getBrief, addFindings}) {
    const dialog = $('#research-dialog');
    let briefId = null, results = [], requestNumber = 0, controller = null, isDraft = false;
    let mode = 'search';
    const saved = new Set(), edits = new Map(), unsavedEdits = new Set();
    const target = () => $('#research-target').value;
    const wasSaved = i => saved.has(`${target()}:${i}`);
    const feedback = message => { $('#research-feedback').textContent = message; };

    function finding(i) {
      const result = results[i];
      const excerpt = edits.has(i) ? edits.get(i).replace(/\s+/g,' ').trim() : result.excerpt;
      return {...result, excerpt, edited:excerpt !== result.excerpt};
    }
    function renderResults() {
      $('#research-results').innerHTML = results.map((r,i) => `<article class="research-result ${wasSaved(i) ? 'result-saved' : ''}">
        <div class="result-source"><span>${escape(r.provider)}</span><span>${escape(new URL(r.url).hostname)}</span></div>
        <h3><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escape(r.title)}</a></h3>
        <p class="result-meta">${escape(r.meta)}</p>
        <p class="result-excerpt">${r.excerpt ? escape(r.excerpt) : 'Source link only · write a note below if you like.'}</p>
        <div class="result-actions">
          <details class="result-edit" ${edits.has(i) && !wasSaved(i) ? 'open' : ''}><summary>Edit text</summary><div class="result-editor"><label class="research-label">Text to keep<small>Shorten the excerpt or write a note. Clear it to keep only the link.</small><textarea data-excerpt="${i}" rows="5" maxlength="2000" ${wasSaved(i) ? 'disabled' : ''}>${escape(edits.get(i) ?? r.excerpt)}</textarea></label>${r.attribution ? `<p class="result-attribution">${escape(r.attribution)}</p>` : ''}</div></details>
          <button type="button" class="button ${wasSaved(i) ? 'added-button' : 'primary'} result-add" data-add-result="${i}" ${wasSaved(i) ? 'disabled' : ''}>${wasSaved(i) ? 'Added' : 'Add to brief'}</button>
        </div>
      </article>`).join('');
    }
    function resetResults() {
      results = []; saved.clear(); edits.clear(); unsavedEdits.clear(); renderResults();
    }
    function cancelRequest() {
      requestNumber++;
      controller?.abort(); controller = null;
      $('#run-research').disabled = false;
      $('#run-research').textContent = 'Search';
      $('#research-results').setAttribute('aria-busy','false');
    }
    function close() {
      const manualDraft = [...$('#capture-form').elements].some(el => el.value?.trim());
      if ((unsavedEdits.size || manualDraft) && !window.confirm('Discard your unsaved text?')) return;
      cancelRequest(); dialog.close(); briefId = null;
    }
    function showMode(next, focus = true) {
      if (controller && next !== mode) {
        cancelRequest();
        $('#research-status').textContent = 'Search when you’re ready.';
      }
      mode = next;
      $('#search-panel').hidden = mode !== 'search';
      $('#paste-panel').hidden = mode !== 'paste';
      $('#mode-search').setAttribute('aria-pressed',String(mode === 'search'));
      $('#mode-paste').setAttribute('aria-pressed',String(mode === 'paste'));
      feedback('');
      $('.research-body').scrollTop = 0;
      if (focus) $(mode === 'search' ? '#research-query' : '#capture-url').focus({preventScroll:true});
    }
    function revealStatus() {
      const body = $('.research-body');
      body.scrollTop += $('#research-status').getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
    }
    async function search(event) {
      event.preventDefault();
      const query = $('#research-query').value.trim();
      if (!query) { $('#research-query').focus(); return; }
      if (unsavedEdits.size && !window.confirm('Discard your edited text and search again?')) return;
      $('#research-query').blur();
      cancelRequest(); resetResults(); feedback('');
      const number = requestNumber;
      const provider = $('#research-provider').value;
      $('.search-options').open = false;
      $('#research-provider').dataset.searched = provider;
      const keys = provider === 'all' ? Object.keys(providers) : [provider];
      const request = new AbortController(); controller = request;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; request.abort(); },12000);
      $('#run-research').disabled = true;
      $('#run-research').textContent = 'Searching…';
      $('#research-results').setAttribute('aria-busy','true');
      $('#research-status').textContent = provider === 'all' ? 'Searching all sources…' : `Searching ${providers[provider].name}…`;
      try {
        // A failed provider never discards successful results from other sources.
        const responses = await Promise.allSettled(keys.map(async key => {
          const response = await fetch(endpoint(key,query), {signal:request.signal, credentials:'omit', referrerPolicy:'no-referrer'});
          if (!response.ok) throw Error(response.status === 429 ? `${providers[key].name} is busy. Try again in a minute.` : `${providers[key].name} is unavailable (HTTP ${response.status}).`);
          return providers[key].parse(await response.json());
        }));
        if (number !== requestNumber || !dialog.open) return;
        const lists = responses.map(r => r.status === 'fulfilled' ? r.value.slice(0,provider === 'all' ? 3 : 6) : []);
        // Interleave sources, preserving each provider's relevance order.
        results = [];
        for (let i=0; i<6; i++) for (const list of lists) if (list[i] && !results.some(r => r.url === list[i].url)) results.push(list[i]);
        renderResults();
        const failures = responses.filter(r => r.status === 'rejected');
        if (results.length) {
          $('#research-status').textContent = `${results.length} result${results.length === 1 ? '' : 's'}${failures.length ? ' · Some sources could not be reached.' : ''}`;
        } else if (failures.length) {
          const reason = failures[0].reason;
          $('#research-status').textContent = timedOut ? 'Search timed out. Try again or paste a link.' : reason instanceof TypeError ? 'Could not reach the sources. Check your connection or paste a link.' : reason instanceof SyntaxError ? 'A source returned an unreadable response. Try another source in Search options.' : reason.message;
        } else {
          $('#research-status').textContent = 'No results. Try a shorter topic or paste a link.';
        }
        revealStatus();
      } finally {
        clearTimeout(timer);
        if (number === requestNumber) {
          controller = null;
          $('#run-research').disabled = false;
          $('#run-research').textContent = 'Search';
          $('#research-results').setAttribute('aria-busy','false');
        }
      }
    }
    function report(outcome) {
      if (!outcome.ok) { feedback(outcome.message); return; }
      feedback(outcome.duplicate ? 'Already in this field.' : isDraft ? 'Added to your draft. Save brief when finished.' : 'Added to your brief.');
    }
    $('#research-search-form').addEventListener('submit',search);
    $('#mode-search').addEventListener('click',() => showMode('search'));
    $('#mode-paste').addEventListener('click',() => showMode('paste'));
    $('#research-target').addEventListener('change',() => { renderResults(); feedback(''); });
    $('#research-provider').addEventListener('change',() => {
      if (unsavedEdits.size && !window.confirm('Discard your edited text and change sources?')) {
        $('#research-provider').value = $('#research-provider').dataset.searched || 'all'; return;
      }
      cancelRequest(); resetResults(); feedback('');
      $('#research-status').textContent = 'Press Search to use these sources.';
    });
    $('#research-results').addEventListener('input',event => {
      if (!event.target.matches('[data-excerpt]')) return;
      const i = Number(event.target.dataset.excerpt);
      edits.set(i,event.target.value);
      if (finding(i).edited) unsavedEdits.add(i); else unsavedEdits.delete(i);
    });
    $('#research-results').addEventListener('click',event => {
      const button = event.target.closest('[data-add-result]');
      if (!button || button.disabled) return;
      const i = Number(button.dataset.addResult);
      const outcome = addFindings(briefId,[finding(i)],target());
      report(outcome);
      if (!outcome.ok) return;
      saved.add(`${target()}:${i}`); unsavedEdits.delete(i); renderResults();
    });
    $('#capture-form').addEventListener('submit',event => {
      event.preventDefault();
      const url = $('#capture-url').value.trim();
      if (!safeUrl(url)) { feedback('Enter a valid http or https link.'); return; }
      const title = $('#capture-title').value.trim() || new URL(url).hostname.replace(/^www\./,'');
      const outcome = addFindings(briefId,[{title,url,excerpt:$('#capture-note').value.replace(/\s+/g,' ').trim(),provider:'Web capture',attribution:''}],target());
      report(outcome);
      if (outcome.ok) $('#capture-form').reset();
    });
    $('#close-research').addEventListener('click',close);
    $('#done-research').addEventListener('click',close);
    dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
    return {
      open(id,options = {}) {
        const brief = getBrief(id);
        if (!brief) return;
        cancelRequest(); briefId = id; isDraft = !!options.draft;
        $('#research-target').value = options.target || 'evidence';
        resetResults();
        $('#research-brief-name').textContent = brief.title;
        const fieldValue = brief[options.target];
        const context = typeof fieldValue === 'string' ? fieldValue : Array.isArray(fieldValue) && typeof fieldValue[0] === 'string' ? fieldValue[0] : '';
        const query = options.target && context.length <= 140 && !/Unreviewed|Saved web note/.test(context) ? context : '';
        $('#research-query').value = (query || brief.title || brief.topic).slice(0,300);
        $('#research-provider').value = 'all';
        $('#research-provider').dataset.searched = 'all';
        $('.search-options').open = false;
        $('#capture-form').reset();
        $('#research-status').textContent = 'Search a topic, then add a result to your brief.';
        $('#research-save-hint').textContent = isDraft ? 'Draft · use Save brief when finished' : 'Saved on this device';
        showMode(options.capture ? 'paste' : 'search',false);
        dialog.showModal();
        $(mode === 'search' ? '#research-query' : '#capture-url').focus({preventScroll:true});
      }
    };
  }
  return {create};
})();
