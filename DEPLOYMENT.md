# Deploying CFF to production

This is the checklist for putting CFF on the internet for real users. Steps marked **(you)** need your own
accounts, domain or credentials — the code can't do them for you.

## 1. Database (Supabase) — (you)
1. **Back up first** (see BACKUP.md).
2. Supabase → SQL Editor → run `supabase/setup.sql` (new or existing project). It never deletes data and can be re-run.
   Already on v2.1? Running only `supabase/migrations/006_production.sql` is enough.
3. Storage: the private bucket `cff-documents` is created automatically on first start. Keep it **private**
   (files are only served through the server after a permission check).

## 2. Supabase Authentication settings — (you)
| Setting | Where | Value |
|---|---|---|
| Site URL | Authentication → URL Configuration | `https://your-domain.com` |
| Redirect URLs | same page | `https://your-domain.com/auth-callback.html` (keep the localhost one only for testing) |
| Confirm email | Authentication → Providers → Email | **On** |
| Secure password change / email change | Providers → Email | On |
| Minimum password length | Providers → Email | 8 or more |
| Two-step verification (TOTP) | Authentication → Multi-Factor | **Enable "TOTP (App Authenticator)"** — needed for Account security → two-step verification |
| JWT expiry | Settings → JWT | 3600 seconds (default) is fine |
| Email templates | Authentication → Emails | paste the files from `email-templates/` |
| SMTP | Authentication → Emails → SMTP Settings | your provider (next section) |
| Rate limits | Authentication → Rate Limits | keep defaults; raise "emails per hour" once SMTP is set |

## 3. Email (SMTP) — (you)
Supabase's built-in email is for testing only (a few emails per hour). For real users:
1. Create an account with an email provider (Resend, Brevo, Postmark, Amazon SES, Zoho Mail…).
2. Verify your domain there and add the **SPF, DKIM (and DMARC)** DNS records it gives you.
3. Enter host, port, user, password and a sender like `CFF <no-reply@your-domain.com>` in Supabase → SMTP Settings.
4. Test: sign up with a new email, use "Forgot password", and invite a new person.

## 4. The server
Any Node.js 18+ host works (Render, Railway, a VPS, Azure App Service…).
```
npm install --omit=dev
npm start
```
Environment variables (copy from `.env.example`; on a host, set them in its dashboard instead of a file):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` — the server **refuses to start** if required settings are missing or not HTTPS |
| `APP_URL` | `https://your-domain.com` (must be https) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key — **server only, never in the website files** |
| `TRUST_PROXY` | `true` when behind a host/proxy that terminates HTTPS (Render, Railway, Nginx, Cloudflare) |
| `FORCE_HTTPS` | `true` (redirects http → https and sends HSTS) |
| `GEMINI_API_KEY`, `AI_MODEL`, `AI_FALLBACK_MODEL` | your Gemini key (billing enabled for real use) |
| `MAX_UPLOAD_MB` | 20 (default) |

On start the server prints what is configured and any warnings. Health check: `GET /api/health`.

### Behind Nginx (VPS example)
```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;
  ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;              # AI answers stream
  }
}
server { listen 80; server_name your-domain.com; return 301 https://$host$request_uri; }
```
Get the certificate with `certbot --nginx -d your-domain.com`. Keep the Node process running with `pm2` or systemd.

### CORS
The website and the API are served from the same address, so no cross-site access is needed and none is allowed:
the server sends no CORS headers and rejects changing requests (POST/PUT/PATCH/DELETE) that come from another website.

## 5. After going live
1. Create your owner account, then **My profile → Account security → Turn on two-step verification**.
2. **Settings → Company settings → Security policy**: require two-step verification for Owners, Founders and HR.
3. Invite managers, HR and employees from **Settings → Members & invitations**.
4. Set up backups (BACKUP.md) and try a restore once.
5. Watch the server log for `[CFF][security]` lines (failed logins, blocked requests, permission denials).

## 6. Updating later
Stop the server, replace the files (keep your `.env`), run any new file in `supabase/migrations/` (or all of `setup.sql`), `npm install`, start again.
