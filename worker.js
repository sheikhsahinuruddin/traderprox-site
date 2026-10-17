// Cloudflare Worker: keeps the RailKit key on the server. GET-only, allow-listed paths.
const ALLOWED_ORIGINS = ['https://traderprox.site'];
const D = '\\d{2}-\\d{2}-\\d{4}';
const ROUTES = [
  new RegExp(`^/api/v[12]/trains/\\d{5}/live/${D}$`),
  /^\/api\/v1\/trains\/\d{5}\/info$/, /^\/api\/v1\/trains\/\d{5}$/,
  /^\/api\/v1\/trains\/search$/, /^\/api\/v1\/stations\/search$/,
  /^\/api\/v1\/stations\/[A-Z]{1,5}$/, /^\/api\/v1\/stations\/[A-Z]{1,5}\/live$/,
];
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0], Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    const send = (st, o) => new Response(JSON.stringify(o), { status: st,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET') return send(405, { success: false, error: 'Method not allowed' });
    if (!ok) return send(403, { success: false, error: 'Origin not allowed' });
    const u = new URL(req.url);
    if (!ROUTES.some(r => r.test(u.pathname))) return send(400, { success: false, error: 'Unsupported path' });
    if (!env.RAILKIT_API_KEY) return send(500, { success: false, error: 'Server not configured' });
    const target = new URL((env.RAILKIT_BASE || 'https://railkit.in') + u.pathname);
    for (const [k, v] of u.searchParams) if (/^(name|hrs|date)$/.test(k) && v.length <= 40) target.searchParams.set(k, v);
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
    try {
      const hdr = env.RAILKIT_AUTH_HEADER || 'x-api-key';
      const val = hdr.toLowerCase() === 'authorization' ? 'Bearer ' + env.RAILKIT_API_KEY : env.RAILKIT_API_KEY;
      const r = await fetch(target, { headers: { [hdr]: val, Accept: 'application/json' }, signal: ac.signal });
      let body = null; try { body = await r.json(); } catch {}
      if (!body) return send(502, { success: false, error: 'Upstream returned non-JSON (HTTP ' + r.status + ')' });
      return send(r.status, body);
    } catch (e) {
      return send(504, { success: false, error: e.name === 'AbortError' ? 'Upstream timeout' : 'Upstream unreachable' });
    } finally { clearTimeout(t); }
  },
};
