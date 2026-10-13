<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Cursor Cloud specific instructions

- Node.js 22 is required. `database.js` uses the built-in `node:sqlite` module. `.nvmrc` pins 22.
- Install with `npm ci`. The dev server is `npm run dev` and listens on `0.0.0.0:3000`. `GET /health` returns `{"status":"ok"}`.
- `GEMINI_API_KEY` is optional. When it is unset, `POST /api/goals` still saves a local 12-week fallback plan. Copy `.env.example` to `.env` and set the key only when Gemini should generate the plan.
- SQLite is created at `data/growth.db` on first run. That directory is gitignored.
