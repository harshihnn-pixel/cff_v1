# CFF email templates

Branded templates for the emails Supabase sends. Supabase sends them (not the CFF server), so they are set up in your Supabase project:

1. Supabase → **Authentication → Emails → Templates**.
2. For each template below, set the **Subject** (written at the top of each file, inside the `<!-- -->` comment) and paste the whole file into **Message body (HTML)**.

| File | Supabase template |
|---|---|
| `invite.html` | Invite user |
| `confirm-signup.html` | Confirm signup |
| `reset-password.html` | Reset password |
| `change-email.html` | Change email address |

The `{{ .ConfirmationURL }}`, `{{ .Email }}` and `{{ .Data.invited_to }}` parts are filled in by Supabase — leave them as they are.

**Deliverability:** Supabase's built-in email service is limited to a few emails per hour and is meant for testing. For real use set up your own SMTP (Authentication → Emails → SMTP Settings) with a provider such as Resend, Brevo, Postmark, Amazon SES or Zoho, and add the SPF/DKIM DNS records the provider gives you for your domain. See `DEPLOYMENT.md`.
