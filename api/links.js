import { supabase } from '../lib/supabase.js';
import { isAuthed } from '../lib/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // List links with stats
    if (req.method === 'GET') {
      const [linksRes, statsRes] = await Promise.all([
        supabase
          .from('links')
          .select('id, slug, campaign_name, destination_url, is_active, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('link_stats').select('id, clicks, conversions, revenue'),
      ]);
      if (linksRes.error) throw linksRes.error;
      if (statsRes.error) throw statsRes.error;

      const stats = new Map(statsRes.data.map((s) => [s.id, s]));
      const links = linksRes.data.map((l) => {
        const s = stats.get(l.id) || {};
        return {
          ...l,
          clicks: Number(s.clicks || 0),
          conversions: Number(s.conversions || 0),
          revenue: Number(s.revenue || 0),
        };
      });
      return res.status(200).json({ links });
    }

    // Pause / resume or delete need a valid id
    const id = String(req.query.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid id.' });

    if (req.method === 'PATCH') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      if (typeof body.is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be true or false.' });
      }
      const { error } = await supabase.from('links').update({ is_active: body.is_active }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('links').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('links api error:', err.message || err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
