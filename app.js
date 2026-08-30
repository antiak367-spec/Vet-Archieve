'use strict';

/* ============================================================
   Question Paper Archive — app.js
   ------------------------------------------------------------
   This site is 100% driven by data.json. You normally NEVER
   need to edit this file:
     - To add a paper:  add an entry to data.json
     - To remove one:   delete its entry from data.json
   Then redeploy (push to GitHub). That's it.
   ============================================================ */

const LEVELS = [1, 2, 3, 4, 5];
const SEMESTERS = [1, 2];
const TYPE_LABEL = {
  CT: 'CT Questions',
  FINAL: 'Semester Final Questions'
};

let papers = [];

const appEl = document.getElementById('app');
const searchEl = document.getElementById('searchInput');

init();

/* -------------------- Boot: load data.json -------------------- */

async function init() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load data.json (HTTP ' + res.status + ').');
    const raw = await res.json();
    if (!Array.isArray(raw)) {
      throw new Error('data.json must contain a JSON array of paper entries.');
    }
    papers = raw.filter(validEntry);
    const skipped = raw.length - papers.length;
    if (skipped > 0) {
      console.warn(skipped + ' entry/entries in data.json were skipped because they are incomplete or invalid.');
    }
  } catch (err) {
    appEl.innerHTML = viewError(err && err.message ? err.message : String(err));
    return;
  }

  window.addEventListener('hashchange', route);
  searchEl.addEventListener('input', onSearchInput);
  route();
}

function validEntry(p) {
  return p
    && LEVELS.includes(Number(p.level))
    && SEMESTERS.includes(Number(p.semester))
    && ['CT', 'FINAL'].includes(String(p.type || '').toUpperCase())
    && typeof p.subject === 'string' && p.subject.trim() !== ''
    && typeof p.title === 'string' && p.title.trim() !== ''
    && typeof p.driveLink === 'string' && /^https?:\/\//i.test(p.driveLink);
}

/* -------------------- Data helpers -------------------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const typeOf = (p) => String(p.type).toUpperCase();
const inLevel = (l) => papers.filter((p) => Number(p.level) === l);
const inSem = (l, s) => inLevel(l).filter((p) => Number(p.semester) === s);
const inType = (l, s, t) => inSem(l, s).filter((p) => typeOf(p) === t);

function fmtDate(d) {
  if (!d) return 'date unknown';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const byDateDesc = (a, b) => String(b.uploadDate || '').localeCompare(String(a.uploadDate || ''));
const bySubjectThenTitle = (a, b) =>
  a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title);

/* -------------------- Router (hash-based) --------------------
   #/                                      -> home
   #/level/1                               -> pick semester
   #/level/1/semester/2/ct                -> CT list
   #/level/1/semester/2/final             -> Final list
   #/search?q=anatomy                     -> search results        */

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const qIndex = hash.indexOf('?');
  const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
  const params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '');
  const seg = path.split('/').filter(Boolean);

  if (seg[0] !== 'search') searchEl.value = '';
  window.scrollTo(0, 0);

  if (seg[0] === 'search') {
    const q = params.get('q') || '';
    searchEl.value = q;
    appEl.innerHTML = renderSearch(q);
    return;
  }

  if (seg[0] === 'level') {
    const l = Number(seg[1]);
    if (!LEVELS.includes(l)) { appEl.innerHTML = renderHome(); return; }

    if (seg[2] === 'semester') {
      const s = Number(seg[3]);
      if (!SEMESTERS.includes(s)) { appEl.innerHTML = renderLevel(l); return; }
      const type = String(seg[4] || 'ct').toUpperCase() === 'FINAL' ? 'FINAL' : 'CT';
      appEl.innerHTML = renderSemester(l, s, type);
      return;
    }
    appEl.innerHTML = renderLevel(l);
    return;
  }

  appEl.innerHTML = renderHome();
}

let searchTimer;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchEl.value.trim();
    if (q) {
      // replaceState keeps the browser history clean while typing
      history.replaceState(null, '', '#/search?q=' + encodeURIComponent(q));
      route();
    } else if (location.hash.startsWith('#/search')) {
      location.hash = '#/';
    }
  }, 180);
}

/* -------------------- Shared pieces -------------------- */

function breadcrumb(items) {
  const parts = ['<a href="#/">Home</a>'];
  for (const it of items) {
    parts.push('<span class="sep" aria-hidden="true">&rsaquo;</span>');
    parts.push(
      it.href
        ? '<a href="' + it.href + '">' + esc(it.label) + '</a>'
        : '<span aria-current="page">' + esc(it.label) + '</span>'
    );
  }
  return '<nav class="crumbs" aria-label="Breadcrumb">' + parts.join('') + '</nav>';
}

function paperRow(p, context) {
  return '' +
    '<article class="paper-row">' +
      '<div class="paper-info">' +
        '<span class="badge">' + esc(p.subject) + '</span>' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p class="paper-meta">' +
          (context ? esc(context) + ' &middot; ' : '') +
          esc(TYPE_LABEL[typeOf(p)]) +
          ' &middot; Uploaded ' + fmtDate(p.uploadDate) +
        '</p>' +
      '</div>' +
      '<a class="btn btn-drive" href="' + esc(p.driveLink) + '" target="_blank" rel="noopener noreferrer">' +
        'Open in Drive <span aria-hidden="true">&nearr;</span>' +
      '</a>' +
    '</article>';
}

function emptyBox(emoji, html) {
  return '<div class="empty"><span class="emoji">' + emoji + '</span><p>' + html + '</p></div>';
}

/* -------------------- Views -------------------- */

function renderHome() {
  const total = papers.length;
  const recent = [...papers].sort(byDateDesc).slice(0, 6);

  return '' +
    '<section class="hero">' +
      '<h1>CT &amp; Semester Final Question Papers</h1>' +
      '<p>Browse archived class test (CT) and semester final question papers from the Faculty of Veterinary, Animal and Biomedical Sciences. Pick a level below, or search by subject name.</p>' +
      '<span class="hero-pill"><strong>' + total + '</strong> paper' + (total === 1 ? '' : 's') + ' archived</span>' +
    '</section>' +

    '<h2 class="section-title">Browse by academic level</h2>' +
    '<div class="card-grid">' +
      LEVELS.map((l) => {
        const n = inLevel(l).length;
        return '' +
          '<a class="card" href="#/level/' + l + '">' +
            '<span class="level-num">' + l + '</span>' +
            '<span><h3>Level ' + l + '</h3>' +
            '<p>' + n + ' paper' + (n === 1 ? '' : 's') + '</p></span>' +
            '<span class="card-arrow" aria-hidden="true">&rarr;</span>' +
          '</a>';
      }).join('') +
    '</div>' +

    '<h2 class="section-title">Recently added</h2>' +
    '<div class="paper-list">' +
      (recent.length
        ? recent.map((p) => paperRow(p, 'Level ' + p.level + ' · Semester ' + p.semester)).join('')
        : emptyBox('📭', 'No papers have been added yet.')) +
    '</div>';
}

function renderLevel(l) {
  return '' +
    breadcrumb([{ label: 'Level ' + l }]) +
    '<h1 class="page-title">Level ' + l + '</h1>' +
    '<p class="page-sub">Choose a semester to browse its question papers.</p>' +
    '<div class="card-grid two">' +
      SEMESTERS.map((s) => {
        const n = inSem(l, s).length;
        return '' +
          '<a class="card" href="#/level/' + l + '/semester/' + s + '/ct">' +
            '<span class="card-icon">S' + s + '</span>' +
            '<span><h3>Semester ' + s + '</h3>' +
            '<p>' + n + ' paper' + (n === 1 ? '' : 's') + '</p></span>' +
            '<span class="card-arrow" aria-hidden="true">&rarr;</span>' +
          '</a>';
      }).join('') +
    '</div>';
}

function renderSemester(l, s, type) {
  const ct = inType(l, s, 'CT').sort(bySubjectThenTitle);
  const fin = inType(l, s, 'FINAL').sort(bySubjectThenTitle);
  const list = type === 'CT' ? ct : fin;

  return '' +
    breadcrumb([
      { label: 'Level ' + l, href: '#/level/' + l },
      { label: 'Semester ' + s }
    ]) +
    '<h1 class="page-title">Level ' + l + ' &middot; Semester ' + s + '</h1>' +

    '<div class="tabs" role="tablist">' +
      '<a class="tab' + (type === 'CT' ? ' active' : '') + '" role="tab" aria-selected="' + (type === 'CT') + '" href="#/level/' + l + '/semester/' + s + '/ct">' +
        'CT Questions <span class="count">' + ct.length + '</span>' +
      '</a>' +
      '<a class="tab' + (type === 'FINAL' ? ' active' : '') + '" role="tab" aria-selected="' + (type === 'FINAL') + '" href="#/level/' + l + '/semester/' + s + '/final">' +
        'Semester Final <span class="count">' + fin.length + '</span>' +
      '</a>' +
    '</div>' +

    '<div class="paper-list">' +
      (list.length
        ? list.map((p) => paperRow(p)).join('')
        : emptyBox('🗂️',
            'No <strong>' + esc(TYPE_LABEL[type]) + '</strong> have been added for this semester yet.<br>' +
            'New papers are usually uploaded after each exam — check back soon.')) +
    '</div>';
}

function renderSearch(q) {
  q = (q || '').trim();
  const needle = q.toLowerCase();

  const hits = q
    ? papers.filter((p) =>
        p.subject.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle) ||
        TYPE_LABEL[typeOf(p)].toLowerCase().includes(needle)
      ).sort((a, b) =>
        Number(a.level) - Number(b.level) ||
        Number(a.semester) - Number(b.semester) ||
        (typeOf(a) < typeOf(b) ? -1 : 1) ||
        a.subject.localeCompare(b.subject))
    : [];

  return '' +
    breadcrumb([{ label: 'Search' }]) +
    '<h1 class="page-title">Search results</h1>' +
    (q
      ? '<p class="page-sub">' + hits.length + ' result' + (hits.length === 1 ? '' : 's') +
        ' for &ldquo;' + esc(q) + '&rdquo;</p>'
      : '<p class="page-sub">Type a subject name (e.g. <em>Anatomy</em>) or a paper name in the search box above.</p>') +
    '<div class="paper-list">' +
      (hits.length
        ? hits.map((p) => paperRow(p, 'Level ' + p.level + ' · Semester ' + p.semester)).join('')
        : (q
            ? emptyBox('🔍',
                'No papers match &ldquo;' + esc(q) + '&rdquo;.<br>' +
                'Try a subject name like <em>Anatomy</em>, <em>Pharmacology</em> or <em>Surgery</em>.')
            : '')) +
    '</div>';
}

function viewError(msg) {
  return '' +
    breadcrumb([]) +
    '<div class="empty" style="margin-top:20px">' +
      '<span class="emoji">⚠️</span>' +
      '<p><strong>Could not load the paper list.</strong></p>' +
      '<p>' + esc(msg) + '</p>' +
      '<p>If you opened this page by double-clicking <code>index.html</code> (address starts with <code>file://</code>), ' +
      'browsers block reading <code>data.json</code>. Preview locally with <code>python3 -m http.server</code> ' +
      '(see README.md), or just deploy to GitHub Pages — it works there automatically.</p>' +
    '</div>';
}
