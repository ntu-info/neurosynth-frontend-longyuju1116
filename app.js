/*
  app.js – Neurosynth frontend demo
  - Implements three API calls using fetch
  - Pretty rendering with Tailwind-friendly HTML
  - Clear loading/error states
*/

const API_BASE = 'https://mil.psy.ntu.edu.tw:5000';

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);

function showLoading(el, text = 'Loading…') {
  el.innerHTML = `
    <div class="flex items-center gap-2 text-gray-600">
      <svg class="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      <span>${text}</span>
    </div>`;
}

function showError(el, err) {
  const msg = typeof err === 'string' ? err : (err && err.message) || String(err);
  el.innerHTML = `
    <div class="rounded-lg border border-red-200 bg-red-50 text-red-700 p-4">
      <div class="font-semibold mb-1">Error</div>
      <pre class="whitespace-pre-wrap text-sm">${escapeHtml(msg)}</pre>
      <div class="mt-2 text-xs text-red-600/80">Possible causes: CORS, network, or server error.</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderList(el, items) {
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No data</div>';
    return;
  }
  const lis = items
    .map((x) => {
      const term = String(x);
      return `<li class="py-1.5">
        <button type="button" data-term="${escapeHtml(term)}" class="w-full text-left px-2 py-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-200">
          ${escapeHtml(term)}
        </button>
      </li>`;
    })
    .join('');
  el.innerHTML = `<ul class="space-y-1">${lis}</ul>`;
}

function renderTags(el, items) {
  if (!Array.isArray(items) || items.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No related terms</div>';
    return;
  }
  const chips = items
    .map((x) => {
      const term = String(x);
      return `<button type="button" data-term="${escapeHtml(term)}" class="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-200/70">
        ${escapeHtml(term)}
      </button>`;
    })
    .join(' ');
  el.innerHTML = `<div class="flex flex-wrap gap-2">${chips}</div>`;
}

// Normalize various response shapes into an array of terms, sorted by jaccard desc if available
function normalizeRelated(input) {
  // Unwrap common containers
  const pick = (obj) => (obj?.related ?? obj?.related_terms ?? obj?.associations ?? obj?.terms ?? obj?.data ?? obj);
  let payload = Array.isArray(input) ? input : pick(input);

  // If array of strings
  if (Array.isArray(payload) && (payload.length === 0 || typeof payload[0] === 'string')) {
    return payload;
  }
  // If array of objects with {term, jaccard}
  if (Array.isArray(payload) && typeof payload[0] === 'object') {
    const arr = payload.slice();
    arr.sort((a, b) => {
      const av = typeof a.jaccard === 'number' ? a.jaccard : parseFloat(a.jaccard);
      const bv = typeof b.jaccard === 'number' ? b.jaccard : parseFloat(b.jaccard);
      if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return bv - av; // large -> small
    });
    return arr.map((o) => o.term ?? o.name ?? o.id ?? '');
  }
  // If object map: term -> jaccard or term -> { jaccard }
  if (payload && typeof payload === 'object') {
    const entries = Object.entries(payload);
    entries.sort((a, b) => {
      const aval = typeof a[1] === 'object' ? (a[1]?.jaccard) : a[1];
      const bval = typeof b[1] === 'object' ? (b[1]?.jaccard) : b[1];
      const av = typeof aval === 'number' ? aval : parseFloat(aval);
      const bv = typeof bval === 'number' ? bval : parseFloat(bval);
      if (Number.isNaN(av) && Number.isNaN(bv)) return a[0].localeCompare(b[0]);
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return bv - av; // large -> small
    });
    return entries.map(([k]) => k);
  }
  // Fallback
  return [];
}

function getField(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
    const upper = k?.toUpperCase?.();
    if (upper && obj && Object.prototype.hasOwnProperty.call(obj, upper)) return obj[upper];
  }
  return '';
}

// Extract studies array from API payload or array
function toStudiesArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.studies)) return data.studies;
  return [];
}

function renderStudies(el, data) {
  // Try to support various shapes: array of objects, or object with results
  let studies = [];
  if (Array.isArray(data)) studies = data;
  else if (data && Array.isArray(data.results)) studies = data.results;
  else if (data && Array.isArray(data.studies)) studies = data.studies;

  if (!Array.isArray(studies) || studies.length === 0) {
    el.innerHTML = '<div class="text-gray-500">No results</div>';
    return;
  }

  // Extract fields per study
  const items = studies.map((s, idx) => {
    const title = getField(s, ['title', 'name']) ?? '';
    const year = getField(s, ['year', 'publication_year']) ?? '';
    const authorsRaw = getField(s, ['authors', 'author_list', 'authors_list', 'author']);
    const authors = Array.isArray(authorsRaw) ? authorsRaw.join(', ') : (authorsRaw ?? '');
    const journal = getField(s, ['journal', 'venue']) ?? '';

    const yearHtml = year ? `<span class="ml-4 text-sm text-gray-500 whitespace-nowrap">${escapeHtml(String(year))}</span>` : '';

    return `
      <div class="py-3 border-b last:border-b-0 border-gray-100">
        <button type="button" class="w-full text-left" data-study-index="${idx}">
          <div class="flex items-baseline justify-between gap-4">
            <div class="text-lg sm:text-xl font-semibold leading-snug">${escapeHtml(String(title))}</div>
            ${yearHtml}
          </div>
          <div class="mt-2 hidden text-sm text-gray-700" data-study-details="${idx}">
            <div class="text-gray-700"><span class="font-medium">Authors:</span> ${escapeHtml(String(authors))}</div>
            <div class="text-gray-700"><span class="font-medium">Journal:</span> ${escapeHtml(String(journal))}</div>
          </div>
        </button>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="mb-3 text-sm text-gray-600">Count: ${studies.length}</div>
    <div class="divide-y divide-gray-100">${items}</div>`;
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { 'Accept': 'application/json, text/plain;q=0.8, */*;q=0.5' } });
  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText}\n${text}`);
  }
  if (ct.includes('application/json')) {
    return resp.json();
  }
  // Fallback: try text then JSON parse
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ---------- Wire up UI ----------
window.addEventListener('DOMContentLoaded', () => {
  // Quick helpers for demo buttons to fill inputs
  document.querySelectorAll('[data-fill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.getAttribute('data-fill'));
      if (input) input.value = btn.getAttribute('data-value') || '';
      input?.focus();
    });
  });

  // A. All terms: auto-load and keep in memory for filtering
  const termsOut = $('#terms-out');
  let allTerms = [];
  (async () => {
    showLoading(termsOut, 'Loading…');
    try {
      const data = await fetchJson(`${API_BASE}/terms`);
      allTerms = Array.isArray(data) ? data : (data?.terms || data) || [];
      renderList(termsOut, allTerms);
    } catch (err) {
      showError(termsOut, err);
    }
  })();

  // B. Related terms for a given t1
  const relatedOut = $('#related-out');
  const relatedInput = $('#input-t1');

  // helper to run related search
  const runRelatedSearch = async (term, isLive = false) => {
    const t = (term ?? relatedInput?.value ?? '').trim();
    if (!t) {
      if (isLive) relatedOut.innerHTML = '';
      else relatedOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Enter a term</div>';
      return;
    }
    showLoading(relatedOut, 'Loading…');
    try {
      const data = await fetchJson(`${API_BASE}/terms/${encodeURIComponent(t)}`);
      const items = normalizeRelated(data);
      renderTags(relatedOut, items);
    } catch (err) {
      showError(relatedOut, err);
    }
  };

  // Dynamic filter left Terms as user types + dynamic related fetch
  let relatedTimer;
  relatedInput?.addEventListener('input', () => {
    const q = relatedInput.value.trim().toLowerCase();
    if (!q) { renderList(termsOut, allTerms); } else {
      const filtered = allTerms.filter((t) => String(t).toLowerCase().includes(q));
      renderList(termsOut, filtered);
    }
    // Debounced dynamic related search
    clearTimeout(relatedTimer);
    relatedTimer = setTimeout(() => runRelatedSearch(relatedInput.value, true), 400);
  });

  // Confirmed search on button click
  $('#btn-related')?.addEventListener('click', async () => {
    const t1 = relatedInput?.value.trim();
    if (!t1) {
      relatedOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Enter a term</div>';
      return;
    }
    await runRelatedSearch(t1, false);
  });

  // Enter-to-search for Related
  relatedInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(relatedTimer);
      runRelatedSearch(relatedInput.value, false);
    }
  });

  // Click a term from the Terms list to fill Related and search
  termsOut?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-term]');
    if (!btn) return;
    const term = btn.getAttribute('data-term') || '';
    if (relatedInput) {
      relatedInput.value = term;
      relatedInput.focus();
    }
    clearTimeout(relatedTimer);
    runRelatedSearch(term, false);
  });

  // C. Logic query studies
  const queryOut = $('#query-out');
  // Debounced live search for studies while typing
  const queryInput = $('#input-q');
  let queryTimer;
  const logicToolbar = document.getElementById('logic-toolbar');
  // Filters UI
  const sortSelect = document.getElementById('year-sort');
  const yearFromInput = document.getElementById('year-from');
  const yearToInput = document.getElementById('year-to');
  let lastStudiesRaw = null; // keep last fetched studies array for client-side filtering/sorting

  // Global insert symbol function for Studies input
  window.insertSymbol = function insertSymbol(symbol) {
    const input = queryInput || document.getElementById('input-q');
    if (!input) return;
    input.focus();

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);

    let textToInsert = String(symbol);

    // Add spacing around logical operators
    if (/^(AND|OR|NOT)$/i.test(textToInsert)) {
      const upper = textToInsert.toUpperCase();
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before) && !/\($/.test(before);
      let needsSpaceAfter;
      if (after.length === 0) {
        needsSpaceAfter = true;
      } else {
        // Add a trailing space unless next char is whitespace or ')'
        needsSpaceAfter = !/^[\s)]/.test(after);
      }
      const prefix = needsSpaceBefore ? ' ' : '';
      const suffix = needsSpaceAfter ? ' ' : '';
      textToInsert = `${prefix}${upper}${suffix}`;
    }

    const newValue = before + textToInsert + after;
    input.value = newValue;

    const newCaret = (before + textToInsert).length;
    try {
      input.setSelectionRange(newCaret, newCaret);
    } catch {}
    // Trigger input event to keep live search behavior consistent
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Delegate clicks from the logic toolbar
  logicToolbar?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-logic-symbol]');
    if (!btn) return;
    const sym = btn.getAttribute('data-logic-symbol') || '';
    window.insertSymbol(sym);
  });

  // Determine if a query is complete enough to run
  function isRunnableQuery(q) {
    const s = (q || '').trim();
    if (!s) return false;
    // Do not run if query ends with a bare boolean operator
    if (/(?:^|\s)(AND|OR|NOT)\s*$/i.test(s)) return false;
    // Parentheses balance (simple)
    let bal = 0;
    for (const ch of s) {
      if (ch === '(') bal++;
      else if (ch === ')') bal--;
    }
    if (bal > 0) return false; // unclosed '('
    // Unmatched quotes (simple count)
    const quotes = (s.match(/"/g) || []).length;
    if (quotes % 2 === 1) return false;
    return true;
  }

  // Normalize boolean query to reduce backend ambiguity (wrap bare terms around AND/OR, and NOT target)
  function normalizeBooleanQuery(q) {
    let s = (q || '').trim();
    if (!s) return s;
    // collapse multiple spaces
    s = s.replace(/\s+/g, ' ');
    // Wrap bare terms around AND/OR
    s = s.replace(/(^|[\s(])([^\s()"']+)\s+(OR|AND)\s+([^\s()"']+)(?=[\s)]|$)/gi, (m, pre, a, op, b) => {
      return `${pre}(${a}) ${op.toUpperCase()} (${b})`;
    });
    // Ensure NOT applies to a grouped term
    s = s.replace(/(^|[\s(])NOT\s+([^\s()"']+)(?=[\s)]|$)/gi, (m, pre, a) => {
      return `${pre}NOT (${a})`;
    });
    return s;
  }
  const runStudiesSearch = async (q, isLive = true) => {
    if (!q) {
      if (isLive) queryOut.innerHTML = '';
      else queryOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Enter a query</div>';
      return;
    }
    showLoading(queryOut, 'Loading…');
    try {
      const prepared = normalizeBooleanQuery(q);
      const url = `${API_BASE}/query/${encodeURIComponent(prepared)}/studies`;
      const data = await fetchJson(url);
      lastStudiesRaw = toStudiesArray(data);
      applyStudyFiltersAndRender();
    } catch (err) {
      showError(queryOut, err);
    }
  };

  queryInput?.addEventListener('input', () => {
    const q = queryInput.value;
    clearTimeout(queryTimer);
    queryTimer = setTimeout(() => {
      if (isRunnableQuery(q)) runStudiesSearch(q.trim(), true);
    }, 400);
  });

  // Explicit search on button click
  $('#btn-query')?.addEventListener('click', async () => {
    const q = $('#input-q').value.trim();
    if (!q) {
      queryOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Enter a query</div>';
      return;
    }
    if (!isRunnableQuery(q)) {
      queryOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Incomplete query (operator at end, unmatched quotes or parentheses)</div>';
      return;
    }
    runStudiesSearch(q, false);
  });

  // Enter-to-search for Studies
  queryInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(queryTimer);
      const q = queryInput.value.trim();
      if (!isRunnableQuery(q)) {
        queryOut.innerHTML = '<div class="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Incomplete query (operator at end, unmatched quotes or parentheses)</div>';
        return;
      }
      runStudiesSearch(q, false);
    }
  });

  // Helper to append a term into the Studies query input with sensible spacing/operators
  const appendTermToQuery = (term) => {
    if (!queryInput) return;
    const current = queryInput.value;
    const trimmed = current.trim();
    const needsAnd = trimmed.length > 0 && !/[\s(]$/.test(current) && !/(AND|OR)\s+$/i.test(current);
    const appended = trimmed.length === 0 ? term : (needsAnd ? `${current} AND ${term}` : `${current}${current.endsWith(' ') ? '' : ' '}${term}`);
    queryInput.value = appended;
    queryInput.focus();
  };

  // Click a related chip to append into Studies query
  relatedOut?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-term]');
    if (!btn) return;
    const term = btn.getAttribute('data-term') || '';
    appendTermToQuery(term);
    // Optionally run search immediately
    runStudiesSearch(queryInput.value.trim(), false);
  });

  // Toggle study details on click (event delegation on queryOut)
  queryOut?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-study-index]');
    if (!btn) return;
    const idx = btn.getAttribute('data-study-index');
    const details = queryOut.querySelector(`[data-study-details="${idx}"]`);
    if (details) {
      details.classList.toggle('hidden');
    }
  });

  // Apply current filters/sort to lastStudiesRaw and render
  function applyStudyFiltersAndRender() {
    const arr = Array.isArray(lastStudiesRaw) ? lastStudiesRaw.slice() : [];
    if (arr.length === 0) {
      queryOut.innerHTML = '<div class="text-gray-500">No results</div>';
      return;
    }

    // Read UI controls
    const sortDir = (sortSelect?.value || 'desc').toLowerCase();
    const yFrom = yearFromInput?.value ? parseInt(yearFromInput.value, 10) : NaN;
    const yTo = yearToInput?.value ? parseInt(yearToInput.value, 10) : NaN;

    // Filter by year range if provided
    let filtered = arr.filter((s) => {
      const yearVal = getField(s, ['year', 'publication_year']);
      const y = Number.parseInt(String(yearVal), 10);
      // If either bound is provided, exclude records without a numeric year
      if (!Number.isNaN(yFrom) || !Number.isNaN(yTo)) {
        if (Number.isNaN(y)) return false;
      }
      if (!Number.isNaN(yFrom) && y < yFrom) return false;
      if (!Number.isNaN(yTo) && y > yTo) return false;
      return true;
    });

    // Sort by year
    filtered.sort((a, b) => {
      const ya = Number.parseInt(String(getField(a, ['year', 'publication_year'])), 10);
      const yb = Number.parseInt(String(getField(b, ['year', 'publication_year'])), 10);
      const aValid = !Number.isNaN(ya);
      const bValid = !Number.isNaN(yb);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1; // push invalid/missing to the bottom
      if (!bValid) return -1;
      return sortDir === 'asc' ? ya - yb : yb - ya;
    });

    renderStudies(queryOut, filtered);
  }

  // Wire filters change to re-render
  sortSelect?.addEventListener('change', applyStudyFiltersAndRender);
  yearFromInput?.addEventListener('input', applyStudyFiltersAndRender);
  yearToInput?.addEventListener('input', applyStudyFiltersAndRender);
});
