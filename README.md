# Vet-Archive — Question Paper Archive

A free static website that archives **class test (CT)** and **semester final** question papers for the
**Faculty of Veterinary, Animal and Biomedical Sciences**.

- PDFs live in **Google Drive** — nothing is stored on the website.
- **Two ways to add papers** (both free, no commits-per-paper):
  1. ⭐ **Upload button on the website** — pick the PDF, choose level/semester/type, click Upload. The file
     flies straight into your Google Drive (shared automatically) and adds itself to the list.
  2. **Google Sheet** — just add a spreadsheet row.
- No backend, no database, no login for students. Hosted free on **GitHub Pages**.

Maintained by **Md. Maruf Islam**.

---

## ⭐ PART 1 — One-time setup of the "Upload" button (Google Apps Script)

This makes a green **Upload** button appear in the site's header. Only your configured passphrase
lets a file through, so random visitors can't add files.

### Step A — Create your Google Sheet first

1. Go to <https://sheets.new>.
2. In row 1, put these 7 headers in A1 → G1 (or use **File → Import** with `papers-template.csv`):

   `level` · `semester` · `type` · `subject` · `title` · `driveLink` · `uploadDate`

3. Click **Share** (top right) → *General access:* **"Anyone with the link"** → role **Viewer** → **Copy link** → Done.
4. From the link, note the **Sheet ID** — the long code between `/d/` and `/edit`.

### Step B — Install the upload script

1. In the sheet, open the menu **Extensions → Apps Script**.
2. Delete everything in the editor.
3. Open the file **`apps-script/Code.gs`** (from this project) and **paste all of it** into the editor.
4. At the top of the pasted code, change this line to your own secret passphrase:
   ```js
   var SECRET_KEY = 'CHANGE-ME-to-a-long-secret-passphrase';
   ```
   Use something only you know, e.g. `vetArchive-2026-xxxxx`. This is your **admin key**.
5. Click the **💾 Save** icon.
6. Click **Deploy → New deployment**:
   - Click the gear ⚙️ icon → choose **Web app**
   - **Execute as:** `Me (your email)`
   - **Who has access:** `Anyone`
   - Click **Deploy**
7. Click **Authorize access** → choose your Google account → you'll see "Google hasn't verified this app":
   - Click **Advanced** → **Go to (your project name) (unsafe)** — this is *your own script*, it's safe →
     allow the permissions.
8. Copy the **Web app URL** shown at the end — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.....long...../exec
   ```

> ⚠️ If you ever edit `Code.gs` later, redeploy: **Deploy → Manage deployments → ✏️ Edit →
> Version: "New version" → Deploy**. Otherwise changes won't take effect.

### Step C — Connect the site

On GitHub, open **`config.json`** (pencil ✏️) and fill in both values, then **Commit changes**:

```json
{
  "googleSheetId": "1AbCdEfGh-your-sheet-id-here",
  "googleSheetGid": 0,
  "uploadScriptUrl": "https://script.google.com/macros/s/AKfycb...../exec"
}
```

Make sure all the updated site files (`app.js`, `index.html`, `styles.css`, `config.json`, `apps-script/Code.gs`
is not needed on GitHub but keep it safe) are pushed to the repo. Within a minute, refresh your site —
the green **Upload** button appears in the header.

### Adding a paper afterwards (≈20 seconds)

1. Click **Upload** on the website.
2. Choose the PDF file, pick **Level / Semester / CT-or-Final**, type the **subject** (existing subjects
   autocomplete) and the paper **title** (optional — auto-named if left blank).
3. Enter your **admin key** (it's remembered on your device) → **Upload to Google Drive**.
4. Click **"Refresh the list now"** — the paper is already live. ✅

Files land in a Drive folder named **"Vet-Archive Question Papers"**, auto-shared as *anyone with link =
viewer*, and a row is appended to your sheet automatically. File size limit: **25 MB** per paper.

---

## PART 2 — Adding papers via the Google Sheet (alternative)

You can also just open the sheet and type a row:

| Column | Example | Notes |
|---|---|---|
| `level` | `1` | 1–5 |
| `semester` | `2` | 1 or 2 |
| `type` | `CT` | `CT` or `FINAL` ("Final" also works) |
| `subject` | `Pharmacology` | |
| `title` | `CT-1 Question Paper (2025)` | blank = auto-named |
| `driveLink` | `https://drive.google.com/file/d/.../view?usp=sharing` | the Drive share link |
| `uploadDate` | `2026-08-30` | can be left blank |

The site re-reads the sheet on every visit. Delete a row to remove a paper.

---

## Project files

| File | What it is | Do you edit it? |
|---|---|---|
| `apps-script/Code.gs` | The upload receiver — paste into Extensions → Apps Script | Once, at setup (set SECRET_KEY) |
| `config.json` | Sheet ID + Apps Script URL | Once, at setup |
| Your Google Sheet | Auto-managed list of papers | You can also edit directly |
| `data.json` | Offline fallback list | Normally no |
| `papers-template.csv` | Template to start the sheet | Optional import |
| `index.html`, `styles.css`, `app.js` | The website | No |
| `.nojekyll` | GitHub Pages helper | No |

---

## Deploy on GitHub Pages

1. Upload all files to a **public** GitHub repo (**Add file → Upload files**).
2. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **`main` / `/ (root)`** → Save.
3. Live at `https://<your-username>.github.io/<repo-name>/` after ~1 minute.

Papers added via the Upload button or the sheet need **no redeploy** — refresh the site and they appear.

## Previewing locally

The site fetches data files, so double-clicking `index.html` (`file://` address) won't work. Run:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Site structure

```
Home (level cards + search + recently added + Upload button)
  └─ Level 1 … 5
       └─ Semester 1 / 2
            ├─ Tab: CT Questions      → papers → "Open in Drive" (new tab)
            └─ Tab: Semester Final    → papers → "Open in Drive" (new tab)
```

Search filters by subject or paper title across all levels. Empty categories show a friendly message.
