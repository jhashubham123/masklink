import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { supabase } from '../lib/supabase.js';

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|python-requests|curl\/|wget|httpclient|monitor|scanner|lighthouse/i;

const CLICK_ID_PARAM = process.env.CLICK_ID_PARAM || 'sub1';

function buildDestination(dest, clickId) {
  // Preferred: the URL contains a {click_id} macro where the network wants the sub ID.
  if (/\{click_id\}/i.test(dest)) {
    return dest.replace(/\{click_id\}/gi, encodeURIComponent(clickId));
  }
  // Fallback: append the click id as a query parameter.
  try {
    const u = new URL(dest);
    u.searchParams.set(CLICK_ID_PARAM, clickId);
    return u.toString();
  } catch {
    return dest;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const slug = String(req.query.slug || '').toLowerCase();
  if (!/^[a-z0-9_-]{3,40}$/.test(slug)) {
    return res.status(404).send('Not found');
  }

  const { data: link, error } = await supabase
    .from('links')
    .select('id, destination_url, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !link || !link.is_active) {
    return res.status(404).send('Not found');
  }

  const clickId = crypto.randomUUID().replace(/-/g, '');
  const ua = String(req.headers['user-agent'] || '');
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipHash = ip
    ? crypto.createHash('sha256').update(ip + (process.env.IP_SALT || '')).digest('hex')
    : null;

  // Log the click in the background so the redirect isn't delayed.
  waitUntil(
    (async () => {
      const { error: insertError } = await supabase.from('clicks').insert({
        link_id: link.id,
        click_id: clickId,
        country: req.headers['x-vercel-ip-country'] || null,
        user_agent: ua.slice(0, 500),
        referrer: String(req.headers.referer || '').slice(0, 500) || null,
        ip_hash: ipHash,
        is_bot: BOT_RE.test(ua) || ua === '',
      });
      if (insertError) console.error('click insert failed:', insertError.message);
    })()
  );

  res.statusCode = 302;
  res.setHeader('Location', buildDestination(link.destination_url, clickId));
  res.end();
}
