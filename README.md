# Keelkari Convent School website

## Run locally

```powershell
$env:KCS_ADMIN_PASSWORD = "use-a-unique-password-with-12-or-more-characters"
$env:KCS_ADMIN_USERNAME = "admin" # optional
node server.js
```

Open `http://localhost:3000`. Admissions enquiries and notices are saved in `data/store.json`, which is excluded from Git.

## Deployment

The included `render.yaml` is configured for a paid, always-on Render web service with persistent storage mounted at `data/`. It intentionally does not use the Free plan: Free Render web services sleep after 15 minutes of inactivity and cannot retain local admission data across restarts. Set `KCS_ADMIN_PASSWORD` as a secret during deployment. Do not deploy this server to static-only hosting, because admissions and notices need protected persistent storage.

## Before launch

- Deploy behind HTTPS and set `NODE_ENV=production`.
- Store `KCS_ADMIN_PASSWORD` in encrypted host environment settings, never in source code.
- Add approved school photos, verified contact details, calendar and official policies.
- Configure encrypted backups and a process to access/delete admissions records.
- Use a managed authentication/database provider for multiple staff accounts, password resets, audit logs or notifications.
