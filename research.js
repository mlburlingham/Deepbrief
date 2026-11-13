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
  function create({getBrief, addFindings}) {
    const dialog = $('#research-dialog');
    let briefId = null;
    let results = [];
    let selected = new Set();
    let saved = new Set();
    let requestNumber = 0;
    let controller = null;
    function selection() {
      const count = selected.size;
      $('#research-selection').textContent = count ? `${count} result${count === 1 ? '' : 's'} selected` : 'No results selected';
      $('#add-research').disabled = count === 0;
    }
    function renderResults() {
      const wasSaved = i => saved.has(`${$('#research-target').value}:${i}`);
      $('#research-results').innerHTML = results.map((r, i) => `<article class="research-result ${wasSaved(i) ? 'result-saved' : ''}">
        <label class="result-choice"><input type="checkbox" data-result="${i}" ${wasSaved(i) ? 'disabled' : ''} ${selected.has(i) ? 'checked' : ''} aria-label="Select ${escape(r.title)}"><span>${escape(r.provider)}${wasSaved(i) ? ' · Added to this destination' : ''}</span></label>
        <h3><a href="${escape(r.url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escape(r.title)}</a></h3>
        <p class="result-meta">${escape(r.meta)}</p>
        <p class="result-excerpt">${r.excerpt ? escape(r.excerpt) : 'No excerpt available. Adding this result will save its source link only.'}</p>
        ${r.attribution ? `<p class="result-attribution">${escape(r.attribution)}</p>` : ''}</article>`).join('');
      selection();
    }
    function links() {
      const query = $('#research-query').value.trim();
      for (const [selector, base] of [['#research-web','https://duckduckgo.com/?q=']]) {
        const link = $(selector);
        if (!link) continue;
        if (query) { link.href = base + encodeURIComponent(query); link.removeAttribute('aria-disabled'); }
        else { link.removeAttribute('href'); link.setAttribute('aria-disabled','true'); }
      }
    }
    function cancelRequest() {
      requestNumber++;
      controller?.abort();
      controller = null;
      $('#run-research').disabled = false;
      $('#research-results').setAttribute('aria-busy', 'false');
    }
    function resetResults() {
      results = []; selected.clear(); saved.clear(); renderResults();
    }
    function revealStatus() {
      const body = $('.research-body');
      body.scrollTop += $('#research-status').getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    }
    function close() {
      // Preserve a manually drafted finding until it is saved or discarded.
      if ([...$('#capture-form').elements].some(el => el.value?.trim()) && !window.confirm('Discard this unsaved finding?')) return;
      cancelRequest(); dialog.close(); briefId = null;
    }
    async function search(event) {
      event.preventDefault();
      const query = $('#research-query').value.trim();
      if (!query) { $('#research-query').focus(); return; }
      $('#research-query').blur(); // Dismiss the phone keyboard before showing results.
      cancelRequest(); resetResults();
      const number = requestNumber;
      const provider = $('#research-provider').value;
      const providerName = {wikipedia:'Wikipedia', crossref:'Crossref', europepmc:'Europe PMC', openlibrary:'Open Library'}[provider];
      const request = new AbortController(); controller = request;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; request.abort(); }, 12000);
      $('#run-research').disabled = true;
      $('#research-results').setAttribute('aria-busy', 'true');
      $('#research-status').textContent = `Searching ${providerName} for “${query}”…`;
      try {
        const response = await fetch(endpoint(provider, query), {signal:request.signal, credentials:'omit', referrerPolicy:'no-referrer'});
        if (!response.ok) throw Error(response.status === 429 ? `${providerName} is busy. Please wait a minute before searching again.` : `${providerName} is unavailable (HTTP ${response.status}). Try again or use the web links.`);
        const data = await response.json();
        if (number !== requestNumber || !dialog.open) return;
        results = ({wikipedia, crossref, europepmc, openlibrary})[provider](data);
        // Avoid showing the same canonical source multiple times in one response.
        results = results.filter((r,i,all) => all.findIndex(x => x.url === r.url) === i);
        renderResults();
        $('#research-status').textContent = results.length
          ? `${results.length} results from ${providerName} for “${query}”. Select the findings you want to keep.`
          : `No results for “${query}”. Try a broader topic, another provider, or the web links.`;
        revealStatus();
      } catch (error) {
        if (number !== requestNumber || !dialog.open) return;
        $('#research-status').textContent = timedOut ? 'Search timed out. Try again or use the web links and capture a finding below.'
          : error instanceof TypeError ? 'Could not reach the search provider. Check your connection or use the web links and capture a finding below.'
          : error instanceof SyntaxError ? 'The provider returned an unreadable response. Try again or use another provider.' : error.message;
        revealStatus();
      } finally {
        clearTimeout(timer);
        if (number === requestNumber) {
          controller = null;
          $('#run-research').disabled = false;
          $('#research-results').setAttribute('aria-busy', 'false');
        }
      }
    }
    $('#research-search-form').addEventListener('submit', search);
    $('#research-query').addEventListener('input', links);
    $('#research-target').addEventListener('change', () => { selected.clear(); renderResults(); });
    $('#research-provider').addEventListener('change', () => {
      cancelRequest(); resetResults();
      $('#research-status').textContent = 'Press Search to look in this provider.';
    });
    $('#research-results').addEventListener('change', event => {
      if (!event.target.matches('[data-result]')) return;
      const index = Number(event.target.dataset.result);
      if (event.target.checked) selected.add(index); else selected.delete(index);
      selection();
    });
    $('#add-research').addEventListener('click', () => {
      const indices = [...selected];
      if (!indices.length) return;
      const outcome = addFindings(briefId, indices.map(i => results[i]), $('#research-target').value);
      if (!outcome.ok) { $('#research-status').textContent = outcome.message; return; }
      indices.forEach(i => saved.add(`${$('#research-target').value}:${i}`)); selected.clear(); renderResults();
      $('#research-status').textContent = outcome.message;
    });
    $('#capture-form').addEventListener('submit', event => {
      event.preventDefault();
      const url = $('#capture-url').value.trim();
      const title = $('#capture-title').value.trim();
      if (!title || !safeUrl(url)) { $('#capture-status').textContent = 'Enter a source title and a valid http or https URL.'; return; }
      const outcome = addFindings(briefId, [{title, url, excerpt:$('#capture-note').value.replace(/\s+/g,' ').trim(), provider:'Web capture', attribution:''}], $('#research-target').value);
      $('#capture-status').textContent = outcome.message;
      if (outcome.ok) $('#capture-form').reset();
    });
    $('#close-research').addEventListener('click', close);
    $('#done-research').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    return {
      open(id) {
        const brief = getBrief(id);
        if (!brief) return;
        cancelRequest(); briefId = id; resetResults();
        $('#research-brief-name').textContent = `Adding to: ${brief.title}`;
        $('#research-query').value = (brief.title || brief.topic).slice(0,300);
        $('#research-provider').value = 'wikipedia';
        $('#research-target').value = 'evidence';
        $('#capture-form').reset(); $('#capture-status').textContent = '';
        $('.manual-capture').open = false;
        $('#research-status').textContent = 'Search for background or papers, then choose what to keep.';
        links(); dialog.showModal(); dialog.scrollTop = 0; $('.research-body').scrollTop = 0;
        $('#research-query').focus({preventScroll:true});
      }
    };
  }
  return {create};
})();
