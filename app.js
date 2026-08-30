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
let CONFIG = {};

const appEl = document.getElementById('app');
const searchEl = document.getElementById('searchInput');

init();

/* -------------------- Boot -------------------- */

async function init() {
  // config.json is optional — it tells us about the Google Sheet and uploader.
  try {
    const cfgRes = await fetch('config.json', { cache: 'no-store' });
    if (cfgRes.ok) CONFIG = await cfgRes.json() || {};
  } catch (err) { /* config.json may simply not exist */ }

  try {
    papers = await loadPapers();
  } catch (err) {
    appEl.innerHTML = viewError(err && err.message ? err.message : String(err));
    setupUpload();
    return;
  }

  window.addEventListener('hashchange', route);
  searchEl.addEventListener('input', onSearchInput);
  route();
  setupUpload();
}

/* -------------------- Data loading --------------------
   Preferred source: a Google Sheet (see config.json) — easy
   to edit from your phone, no commits needed.
   Fallback source: data.json (works offline / if no sheet set). */

async function loadPapers() {
  // 1) Try the Google Sheet configured in config.json
  try {
    const sheetId = String(CONFIG.googleSheetId || '').trim();
    if (sheetId && !/PASTE_/i.test(sheetId)) {
      const rows = await fetchSheetPapers(sheetId, CONFIG.googleSheetGid || 0);
      const valid = rows.filter(validEntry);
      console.log('Loaded ' + valid.length + ' paper(s) from Google Sheet.');
      return valid;
    }
  } catch (err) {
    console.warn('Google Sheet could not be loaded (' + (err && err.message) + '). Falling back to data.json.');
  }

  // 2) Fallback: data.json
  const res = await fetch('data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load data.json (HTTP ' + res.status + ').');
  const raw = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error('data.json must contain a JSON array of paper entries.');
  }
  const valid = raw.filter(validEntry);
  const skipped = raw.length - valid.length;
  if (skipped > 0) {
    console.warn(skipped + ' entry/entries were skipped because they are incomplete or invalid.');
  }
  return valid;
}

async function fetchSheetPapers(sheetId, gid) {
  const url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) +
    '/gviz/tq?tqx=out:json&gid=' + encodeURIComponent(gid) + '&_=' + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error('sheet HTTP ' + res.status);
  const text = await res.text();

  // The response is wrapped: google.visualization.Query.setResponse({ ... });
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('unexpected response from Google Sheets');
  const data = JSON.parse(text.slice(start, end + 1));
  const rows = (data.table && data.table.rows) || [];
  if (rows.length === 0) return [];

  const cellVal = (c) => (c == null ? '' : (c.v != null ? c.v : (c.f != null ? c.f : '')));

  // Row 1 of the sheet is the header row — map columns by their names.
  const headers = rows[0].c.map((c) => String(cellVal(c)).toLowerCase().trim());
  const findCol = (aliases) => headers.findIndex((h) =>
    aliases.some((a) => h === a || h.indexOf(a) !== -1));
  const idx = {
    level:    findCol(['level']),
    semester: findCol(['semester', 'sem ']),
    type:     findCol(['type']),
    subject:  findCol(['subject', 'course']),
    title:    findCol(['title', 'paper name', 'paper']),
    link:     findCol(['drivelink', 'drive link', 'link', 'url']),
    date:     findCol(['uploaddate', 'upload date', 'timestamp', 'date'])
  };

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = (rows[i].c) || [];
    const get = (k) => {
      const j = idx[k];
      if (j < 0) return '';
      let v = cellVal(cells[j]);
      // Date cells come back as e.g. "Date(2026,7,30)" — convert to YYYY-MM-DD
      if (typeof v === 'string' && /^Date\(\d/.test(v)) {
        const n = v.match(/\d+/g).map(Number);
        v = new Date(n[0], n[1], n[2] || 1).toISOString().slice(0, 10);
      }
      return String(v).trim();
    };

    let type = get('type').toUpperCase();
    type = type.indexOf('CT') !== -1 ? 'CT' : (type.indexOf('FINAL') !== -1 ? 'FINAL' : type);
    const subject = get('subject');
    const title = get('title') || (type === 'CT' ? 'CT Question Paper' : 'Semester Final Question Paper');
    let link = get('link');
    // People sometimes paste the "share" popup link or extra spaces — tidy it.
    link = link.replace(/^https?:\/\/drive\.google\.com\/open\?id=/,
      (m) => 'https://drive.google.com/file/d/') ;

    if (!link && !subject) continue; // completely empty row

    out.push({
      level: get('level'),
      semester: get('semester'),
      type: type,
      subject: subject,
      title: title,
      driveLink: link,
      uploadDate: get('date')
    });
  }
  return out;
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
      '<p>If you use a Google Sheet: make sure the sheet link sharing is set to <strong>&ldquo;Anyone with the link&rdquo;</strong> ' +
      'and the ID in <code>config.json</code> is correct.</p>' +
      '<p>If you opened this page by double-clicking <code>index.html</code> (address starts with <code>file://</code>), ' +
      'browsers block reading the data files. Preview locally with <code>python3 -m http.server</code> ' +
      '(see README.md), or just deploy to GitHub Pages — it works there automatically.</p>' +
    '</div>';
}

/* ============================================================
   Admin Upload — sends a file to the Google Apps Script
   (see apps-script/Code.gs). The button only appears when
   config.json contains a real "uploadScriptUrl".
   ============================================================ */

function setupUpload() {
  const btn = document.getElementById('uploadBtn');
  const modal = document.getElementById('uploadModal');
  if (!btn || !modal) return;

  const url = String(CONFIG.uploadScriptUrl || '').trim();
  if (!url || !/^https:\/\/script\.google\.com\//.test(url)) return; // uploader not configured
  btn.hidden = false;

  const form = document.getElementById('uploadForm');
  const statusEl = document.getElementById('upStatus');
  const submitBtn = document.getElementById('upSubmit');
  const fileInput = document.getElementById('upFile');
  const keyInput = document.getElementById('upKey');
  const typeSel = document.getElementById('upType');
  const titleInput = document.getElementById('upTitle');
  const subjectInput = document.getElementById('upSubject');
  const subjectList = document.getElementById('subjectList');

  // Autocomplete subjects already present in the archive.
  const subjects = [...new Set(papers.map((p) => p.subject).filter(Boolean))].sort();
  subjectList.innerHTML = subjects.map((s) => '<option value="' + esc(s) + '">').join('');

  function openModal() {
    statusEl.hidden = true;
    statusEl.className = 'up-status';
    statusEl.textContent = '';
    form.reset();
    keyInput.value = localStorage.getItem('vetAdminKey') || '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => fileInput.focus(), 50);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !modal.hidden) closeModal();
  });

  // Default the title based on paper type if the user hasn't typed one.
  typeSel.addEventListener('change', () => {
    if (titleInput.value.trim() === '') {
      titleInput.placeholder = typeSel.value === 'FINAL'
        ? 'Semester Final Question Paper'
        : 'e.g. CT-1 Question Paper (2026)';
    }
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    const level = document.getElementById('upLevel').value;
    const semester = document.getElementById('upSemester').value;
    const type = typeSel.value;
    const subject = subjectInput.value.trim();
    const title = titleInput.value.trim();
    const key = keyInput.value;

    if (!file) return showStatus('error', 'Please choose a file to upload.');
    if (file.size > 25 * 1024 * 1024) {
      return showStatus('error', 'That file is ' + (file.size / 1048576).toFixed(1) +
        ' MB — the limit is 25 MB. For a very large paper, please upload it to Google Drive manually and add it to the sheet.');
    }
    if (!level || !semester || !type) return showStatus('error', 'Please pick level, semester and paper type.');
    if (!subject) return showStatus('error', 'Please enter the subject name.');
    if (!key) return showStatus('error', 'Please enter the admin key.');

    localStorage.setItem('vetAdminKey', key);
    submitBtn.disabled = true;
    showStatus('info', 'Uploading “' + esc(file.name) + '”… this may take a moment for large files.');

    readFileAsBase64(file)
      .then((contentBase64) => fetch(url, {
        // text/plain avoids a CORS preflight; Google Apps Script accepts the body.
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          key: key,
          level: Number(level),
          semester: Number(semester),
          type: type,
          subject: subject,
          title: title || (type === 'FINAL' ? 'Semester Final Question Paper' : 'CT Question Paper'),
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          contentBase64: contentBase64
        })
      }))
      .then((res) => res.text())
      .then((txt) => {
        let data;
        try { data = JSON.parse(txt); }
        catch (err) { throw new Error('Unexpected response from the upload service. Check that the Apps Script is deployed as a Web app with access "Anyone".'); }
        if (!data.ok) throw new Error(data.error || 'Upload failed.');
        return data;
      })
      .then((data) => {
        showStatus('ok',
          '✅ Uploaded successfully! The paper was saved to your Google Drive and added to the sheet. ' +
          '<br><a href="' + esc(data.link) + '" target="_blank" rel="noopener noreferrer">Open the file in Drive</a> · ' +
          '<a href="#" id="refreshLink">Refresh the list now</a>');
        form.reset();
        keyInput.value = localStorage.getItem('vetAdminKey') || '';
        const rl = document.getElementById('refreshLink');
        if (rl) rl.addEventListener('click', (e) => { e.preventDefault(); refreshAfterUpload(); });
      })
      .catch((err) => {
        let msg = String(err && err.message ? err.message : err);
        if (/Failed to fetch|NetworkError|load failed/i.test(msg)) {
          msg = 'Could not reach the upload service. Make sure you deployed the Apps Script as a Web app (access: Anyone) and pasted the correct /exec URL into config.json.';
        }
        showStatus('error', '❌ ' + esc(msg));
      })
      .finally(() => { submitBtn.disabled = false; });
  });

  function showStatus(kind, html) {
    statusEl.hidden = false;
    statusEl.className = 'up-status ' + kind;
    statusEl.innerHTML = html;
  }
}

function refreshAfterUpload() {
  loadPapers()
    .then((fresh) => {
      papers = fresh;
      route(); // re-render the current page with the new paper
    })
    .catch(() => {
      // Sheet cache can lag a few seconds; a normal browser refresh will show it.
      location.reload();
    });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result || '';
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}
