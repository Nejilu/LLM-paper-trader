# Web app

## API proxy configuration

The web app proxies all requests through same-origin routes:

- `GET /api/*` → `${API_ORIGIN}/api/*`
- `GET /healthz` → `${API_ORIGIN}/healthz`

Set `API_ORIGIN` in your environment to point at the backend.

### Local development

Create `apps/web/.env.local` with:

```
API_ORIGIN=http://localhost:4000
```

### Vercel (Preview/Prod)

In the Vercel project for `apps/web`, set:

```
API_ORIGIN=https://<backend>.vercel.app
```

Use different values for Preview/Production if needed.

### Debugging routing on Vercel

If a rewrite isn't working, check the deployment logs in the Vercel dashboard
for the `apps/web` project and look at the request/response headers. You can
also run `vercel dev --debug` locally to inspect rewrite behavior.
