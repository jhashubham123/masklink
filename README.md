# Link Masker

Masked tracking links with click logging, built for Vercel + Supabase.

`yourdomain.com/r/<slug>` logs the click, then 302-redirects to your affiliate link
with a unique click id attached.

## Structure

```
public/          static dashboard (index.html, style.css, index.js)
api/go.js        /r/:slug -> logs click, redirects
api/create.js    create a link (admin only)
api/links.js     list / pause / delete links (admin only)
api/postback.js  optional conversion postback from the affiliate network
lib/             shared Supabase client + auth helper
vercel.json      rewrites /r/:slug to api/go.js and serves public/
```

## Setup

1. **Supabase:** run the SQL for the `links`, `clicks`, `conversions` tables and the
   `link_stats` view in the SQL Editor (also run
   `alter view public.link_stats set (security_invoker = true);`).
2. **Push this folder to GitHub** and import it in Vercel (Framework preset: Other).
3. **Environment variables** in Vercel (Project > Settings > Environment Variables),
   see `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`,
   `POSTBACK_SECRET`, `IP_SALT`, optional `CLICK_ID_PARAM`.
4. **Deploy**, then add your **custom domain** in Vercel (recommended over *.vercel.app).
5. Open the site, sign in with `ADMIN_TOKEN`, create a link.

## Affiliate URL format

Use `{click_id}` where the network expects your sub ID:

```
https://network.com/click?offer=123&aff_sub={click_id}
```

If the macro is missing, the click id is appended as `?sub1=<id>` (change the name with `CLICK_ID_PARAM`).

## Conversion postback (optional)

Give your network this URL (macro names differ per network):

```
https://YOUR-DOMAIN/api/postback?key=POSTBACK_SECRET&click_id={aff_sub}&payout={payout}&status={status}
```

One conversion is stored per click; repeated postbacks update it instead of duplicating.

## Local testing

```
npm install
npx vercel dev
```

## Notes

- Never expose the Supabase service role key in browser code. It is only used in `api/` and `lib/`.
- Bots are flagged by user-agent and excluded from click counts, but still redirected.
- Vercel's free Hobby plan is for non-commercial use; check plan terms for paid traffic.
