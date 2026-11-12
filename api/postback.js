import { supabase } from '../lib/supabase.js';
import { safeEqual } from '../lib/auth.js';

// Example postback URL to give your affiliate network (macros differ per network):
//   https://YOUR-DOMAIN/api/postback?key=POSTBACK_SECRET&click_id={sub1}&payout={payout}&status={status}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const q = { ...req.query, ...body };

  const expected = process.env.POSTBACK_SECRET;
  const key = q.key || req.headers['x-postback-key'];
  if (!expected || !key || !safeEqual(key, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const clickId = String(q.click_id || '').trim();
  if (!/^[a-zA-Z0-9]{8,64}$/.test(clickId)) {
    return res.status(400).json({ error: 'Invalid click_id.' });
  }

  let payout = Number(q.payout);
  if (!Number.isFinite(payout) || payout < 0) payout = 0;
  payout = Math.min(payout, 1e9);
  const status = String(q.status || 'approved').toLowerCase().slice(0, 30);

  try {
    const { data: click, error: clickErr } = await supabase
      .from('clicks')
      .select('click_id')
      .eq('click_id', clickId)
      .maybeSingle();
    if (clickErr) throw clickErr;
    if (!click) return res.status(404).json({ error: 'Unknown click_id.' });

    // One conversion per click: networks often retry postbacks, so update instead of duplicating.
    const { data: existing, error: exErr } = await supabase
      .from('conversions')
      .select('id')
      .eq('click_id', clickId)
      .maybeSingle();
    if (exErr) throw exErr;

    if (existing) {
      const { error } = await supabase.from('conversions').update({ payout, status }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('conversions').insert({ click_id: clickId, payout, status });
      if (error) throw error;
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('postback error:', err.message || err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
