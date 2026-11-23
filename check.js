const crypto = require('crypto');
// Add sites here. group = checkbox group in SETTINGS; {u} = username
const SITES = [
  { name: 'GITHUB', group: 'CODE', url: 'https://github.com/{u}' },
  { name: 'GITLAB', group: 'CODE', url: 'https://gitlab.com/{u}' },
  { name: 'CODEBERG', group: 'CODE', url: 'https://codeberg.org/{u}' },
  { name: 'DEV.TO', group: 'BLOG', url: 'https://dev.to/{u}' },
];
module.exports = async (req, res) => {
  if (req.query.list) return res.json(SITES.map(({ name, group }) => ({ name, group })));
  const q = String(req.query.q || '').trim().slice(0, 64);
  if (!/^[\w.@+-]+$/.test(q)) return res.status(400).json({ error: 'bad input' });
  let t;
  if (q.includes('@')) {
    t = { name: 'GRAVATAR', url: `https://gravatar.com/${crypto.createHash('sha256').update(q.toLowerCase()).digest('hex')}.json` };
  } else {
    const s = SITES.find(x => x.name === req.query.site);
    if (!s) return res.status(400).json({ error: 'bad site' });
    t = { name: s.name, url: s.url.replace('{u}', encodeURIComponent(q)) };
  }
  const t0 = Date.now();
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(5000), redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
    res.json({ ...t, status: r.status === 200 ? 'found' : r.status === 404 ? 'none' : 'fail', ms: Date.now() - t0 });
  } catch { res.json({ ...t, status: 'fail', ms: Date.now() - t0 }); }
};
