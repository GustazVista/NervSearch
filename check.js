const crypto = require('crypto'), dns = require('dns').promises, net = require('net');
const priv = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || /^(::1?$|f[cd]|fe80|::ffff:)/i.test(ip);
// SSRF guard: https only, no ports/credentials/IP literals, no private addresses
async function safe(u) {
  let x; try { x = new URL(u); } catch { return false; }
  if (x.protocol !== 'https:' || x.port || x.username || x.password) return false;
  if (x.hostname === 'localhost' || net.isIP(x.hostname.replace(/[[\]]/g, ''))) return false;
  try { const a = await dns.lookup(x.hostname, { all: true }); return a.length > 0 && a.every(r => !priv(r.address)); } catch { return false; }
}
module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 64);
  if (!/^[\w.@+-]+$/.test(q)) return res.status(400).json({ error: 'bad input' });
  let t;
  if (q.includes('@')) {
    t = { name: 'GRAVATAR', url: `https://gravatar.com/${crypto.createHash('sha256').update(q.toLowerCase()).digest('hex')}.json` };
  } else {
    const tpl = String(req.query.tpl || '').slice(0, 300), name = String(req.query.name || 'SITE').slice(0, 30);
    if (tpl.split('{u}').length !== 2) return res.status(400).json({ error: 'bad site' });
    t = { name, url: tpl.replace('{u}', encodeURIComponent(q)) };
  }
  if (!(await safe(t.url))) return res.status(400).json({ error: 'blocked url' });
  const t0 = Date.now();
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(5000), redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
    res.json({ ...t, status: r.status === 200 ? 'found' : r.status === 404 ? 'none' : 'fail', ms: Date.now() - t0 });
  } catch { res.json({ ...t, status: 'fail', ms: Date.now() - t0 }); }
};
