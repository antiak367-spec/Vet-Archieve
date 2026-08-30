# Question Paper Archive

A simple static website that archives **class test (CT)** and **semester final** question papers for the
**Faculty of Veterinary, Animal and Biomedical Sciences**.

- Files (PDFs) are **not stored on the site** — they live in **Google Drive**. The site only stores links.
- All content lives in a single file: **`data.json`**. To add or remove a paper, you only edit that one file.
- No backend, no database, no login. 100% free to host on **GitHub Pages** or **Vercel**.

Maintained by **Md. Maruf Islam**.

---

## Project files

| File           | What it is                                                        | Do you edit it? |
|----------------|-------------------------------------------------------------------|-----------------|
| `data.json`    | The list of all question papers (the only file with content)     | **Yes — always**|
| `index.html`   | The page shell                                                    | No              |
| `styles.css`   | All styling/colors                                                | No (unless you want to change the look) |
| `app.js`       | Reads `data.json` and builds the navigation/lists/search          | No              |
| `.nojekyll`    | Tiny helper file for GitHub Pages                                 | No              |

---

## How to add a new question paper

1. **Upload the PDF to Google Drive** (any folder in your Drive).
2. Right-click the file → **Share** → under "General access" choose **"Anyone with the link"** → role **Viewer** → **Copy link**.
   - The link looks like: `https://drive.google.com/file/d/1AbCdEf.../view?usp=sharing`
3. Open **`data.json`** in the GitHub website (click the pencil ✏️ "Edit this file" button).
4. Add a new entry inside the square brackets, following this exact shape:

```json
{
  "level": 1,
  "semester": 1,
  "type": "CT",
  "subject": "Anatomy",
  "title": "CT-1 Question Paper",
  "driveLink": "https://drive.google.com/file/d/PASTE-THE-LINK-HERE/view?usp=sharing",
  "uploadDate": "2026-08-30"
}
```

Field rules:

- `"level"`: `1`, `2`, `3`, `4`, or `5`
- `"semester"`: `1` or `2`
- `"type"`: `"CT"` for class tests, `"FINAL"` for semester final questions
- `"subject"`: subject name, e.g. `"Pharmacology"`
- `"title"`: paper name, e.g. `"CT-2 Question Paper"` or `"Semester Final Question Paper"`
- `"driveLink"`: the full Google Drive share link (must start with `https://`)
- `"uploadDate"`: today's date as `YYYY-MM-DD`

5. **Commas matter:** every entry `{ ... }` must end with a comma `,` *except* the last one before the closing `]`.
6. Scroll down → **Commit changes**. The site updates automatically in about 1 minute.

> To **remove** a paper: delete its whole `{ ... }` block (and the trailing comma) and commit.
> To **fix a broken link**: replace the `driveLink` value and commit.

---

## Deploy for free — option A: GitHub Pages (recommended)

1. Create a free account at [github.com](https://github.com) and create a new **repository**, e.g. `question-archive` (public).
2. Upload all the files in this folder to the repository
   (either drag-and-drop on the **"Add file → Upload files"** page, or use `git push`).
3. In the repository, go to **Settings → Pages**.
4. Under **"Build and deployment"**:
   - Source: **Deploy from a branch**
   - Branch: **`main`**, folder: **`/ (root)`** → click **Save**.
5. Wait ~1 minute. Your site goes live at:

   **`https://<your-username>.github.io/question-archive/`**

   (No custom domain needed — this address is free forever.)

Future updates: just edit `data.json` on GitHub and commit. Nothing else to do.

## Deploy for free — option B: Vercel

1. Push these files to a GitHub repository (steps 1–2 above).
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import the repository.
3. Leave all build settings at their defaults (there is no build step) → **Deploy**.
4. Your site goes live at `https://<project-name>.vercel.app`.

---

## Previewing locally on your computer

Because the site reads `data.json`, opening `index.html` by double-clicking it won't work
(browsers block that for security reasons). Instead, run a tiny local server:

```bash
# from inside this folder:
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser. (Or use the VS Code "Live Server" extension.)

---

## How the site is organized

```
Home (5 level cards)
  └─ Level 1 … Level 5
       └─ Semester 1 / Semester 2
            ├─ Tab: CT Questions        → list of papers → "Open in Drive" (new tab)
            └─ Tab: Semester Final      → list of papers → "Open in Drive" (new tab)
```

A search box in the top bar filters across every level/semester by subject name or paper title.
Empty categories show a friendly "no papers yet" message automatically — you don't need to do anything special.
