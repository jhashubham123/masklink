import crypto from 'node:crypto';

// Constant-time string comparison (hashes first so lengths don't leak).
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Dashboard/admin API auth: "Authorization: Bearer <ADMIN_TOKEN>"
export function isAuthed(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  return given.length > 0 && safeEqual(given, expected);
}
