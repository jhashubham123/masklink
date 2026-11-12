import crypto from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { isAuthed } from '../lib/auth.js';

const SLUG_RE = /^[a-z0-9_-]{3,40}$/;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomSlug(len = 7) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const campaign = String(body.campaign_name || '').trim();
  const destination = String(body.destination_url || '').trim();
  const customSlug = String(body.slug || '').trim().toLowerCase();

  if (!campaign || campaign.length > 100) {
    return res.status(400).json({ error: 'Campaign name is required (max 100 characters).' });
  }

  let parsed;
  try {
    parsed = new URL(destination);
  } catch {
    return res.status(400).json({ error: 'Affiliate link is not a valid URL.' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Affiliate link must start with http:// or https://' });
  }
  if (parsed.host === req.headers.host) {
    return res.status(400).json({ error: 'Destination cannot point back to this site.' });
  }
  if (customSlug && !SLUG_RE.test(customSlug)) {
    return res.status(400).json({ error: 'Slug must be 3-40 characters: a-z, 0-9, - or _.' });
  }

  const attempts = customSlug ? 1 : 5;
  for (let i = 0; i < attempts; i++) {
    const slug = customSlug || randomSlug();
    const { data, error } = await supabase
      .from('links')
      .insert({ slug, campaign_name: campaign, destination_url: destination })
      .select('id, slug, campaign_name, destination_url, is_active, created_at')
      .single();

    if (!error) return res.status(201).json({ link: data });

    if (error.code === '23505') {
      if (customSlug) return res.status(409).json({ error: 'That slug is already taken.' });
      continue; // random slug collided, try another
    }
    console.error('create link failed:', error.message);
    return res.status(500).json({ error: 'Could not create link.' });
  }
  return res.status(500).json({ error: 'Could not generate a unique slug, try again.' });
}
