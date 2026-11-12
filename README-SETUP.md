# SpendWise invitation email integration

## Included files
- `supabase/functions/send-workspace-invite/index.ts`
- `src/context/WorkspaceContext.jsx`
- `src/pages/dashboard/Dashboard.jsx`

Replace the two React files at the matching paths in your project. Copy the Edge Function into the matching Supabase function folder.

## Supabase Edge Function secrets
Set these in Supabase → Edge Functions → Secrets:
- `BREVO_API_KEY` = your Brevo API key (already configured)
- `BREVO_SENDER_EMAIL` = `vinithuiux@gmail.com` (must exactly match your verified Brevo sender)
- `BREVO_SENDER_NAME` = `SpendWise`
- `APP_URL` = `https://vinithrexton.github.io/spendwise/login`

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically in standard projects. Do not put the service role key in React, `.env`, or GitHub Actions.

## Deploy
From your project root, with Supabase CLI linked to the correct project:

```bash
supabase functions deploy send-workspace-invite
```

Then in the app:
1. Create a new invitation.
2. Confirm the owner sees a success message that the email was sent.
3. Check recipient Inbox and Spam.
4. Use `Resend email` on a still-pending invitation to retry.

## Important
This implementation sends a link to the existing login page. The recipient must sign in or register with the exact invited email, then accept the invitation shown in Shared Mode. It does not use an Auth admin invite link or automatically create an account.
