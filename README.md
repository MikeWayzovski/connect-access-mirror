# Access Mirror

Trimble Connect for Browser **project extension** that copies project membership from a source user to a target user. Host it on Vercel (HTTPS) and load it in Connect’s Explorer iframe.

## Stack

- Next.js 15 App Router + TypeScript
- `trimble-connect-workspace-api` (postMessage to `window.parent`)
- Same-origin BFF routes under `/api/trimble/*` (Trimble REST APIs typically block browser CORS)

## Local development

```bash
npm install
npm run dev
```

Opening `http://localhost:3000` shows the **standalone debug** panel. Workspace API, tokens, and mirroring only work inside Trimble Connect over HTTPS.

## Deploy to Vercel

1. Push this repo and import it in Vercel (or `npx vercel`).
2. Optional: set `NEXT_PUBLIC_APP_URL` to the production origin (for example `https://your-app.vercel.app`).
3. Confirm iframe + CORS headers:
   - `curl -sI https://<app>/manifest.json`
   - Look for `Access-Control-Allow-Origin` and `Content-Security-Policy: frame-ancestors …connect.trimble.com`

For local HTTP, `x-forwarded-proto` is not required; the app uses `request.nextUrl.origin`. On Vercel this is HTTPS.

## Install in Trimble Connect

1. Open a project as a **project administrator**.
2. Go to **Settings → Apps & Capabilities → Add Custom**.
3. Paste `https://connect-access-mirror.vercel.app/manifest.json`.
4. Open **Access Mirror** from the left navigation.
5. Grant the extension access to the Trimble Identity token when Connect prompts you.

`extensionType` is `["project"]` so the app appears in Explorer (not only the 3D Viewer).

## How authentication works

Connect owns the session. The extension calls `extension.requestPermission("accesstoken")` and listens for `extension.accessToken` (including refresh). The token is kept in memory and sent to BFF routes as `Authorization: Bearer`. It is never written to `localStorage`.

## Mirroring behavior

1. **Account Admin path** (when eCom APIs succeed): list the source user’s account projects and batch `POST https://projects-api.connect.trimble.com/v1/projects/update-users` (max 30 projects per request).
2. **Fallback**: list projects the operator can see in each discovered region, keep those where the source is a member, and `POST {tcApi}/tc/api/2.0/projects/{id}/users`.

Roles copied: `USER` and `ADMIN` only. Folder ACLs and groups are out of scope.

## Architecture

```
Trimble Connect Web
  └── iframe (this app)
        ├── Workspace API → token + current project + members
        └── /api/trimble/* → Core 2.0 / eCom / projects-api
```
