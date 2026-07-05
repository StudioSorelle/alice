require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Replicate = require('replicate');
const db = require('./db');
const migrate = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

migrate();

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

let replicate = null;
if (process.env.REPLICATE_API_TOKEN) {
  replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
}

// ── Admin auth ──
function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Code generation ──
var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode() {
  var code = '';
  for (var i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// ── Seasonal context ──
function getSeasonalContext() {
  var now = new Date();
  var month = now.getMonth() + 1;
  var day = now.getDate();

  var holidays = [
    { month: 2,  day: 14, en: "Valentine's Day is coming up — consider romantic or heartfelt themes.",    nl: 'Valentijnsdag komt eraan — overweeg romantische of hartelijke thema\'s.' },
    { month: 10, day: 31, en: 'Halloween is just around the corner — consider spooky, mysterious, or festive autumn themes.', nl: 'Halloween is vlakbij — overweeg spookachtige, mysterieuze of herfstfeestthema\'s.' },
    { month: 12, day: 25, en: 'Christmas is approaching — consider cosy, wintery, or festive themes.',   nl: 'Kerstmis nadert — overweeg gezellige, winterse of feestelijke thema\'s.' },
  ];

  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var holDate = new Date(now.getFullYear(), hol.month - 1, hol.day);
    var diff = (holDate - now) / (1000 * 60 * 60 * 24);
    if (diff >= 0 && diff <= 7) return { en: hol.en, nl: hol.nl };
  }

  if (month >= 3 && month <= 5) return { en: 'It is spring.', nl: 'Het is lente.' };
  if (month >= 6 && month <= 8) return { en: 'It is summer.', nl: 'Het is zomer.' };
  if (month >= 9 && month <= 11) return { en: 'It is autumn.', nl: 'Het is herfst.' };
  return { en: 'It is winter.', nl: 'Het is winter.' };
}

// ── Auth ──
var MASTER_CODE = 'AK14050303';

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, reason: 'missing' });
    const upper = String(code).trim().toUpperCase();

    if (upper === MASTER_CODE) {
      return res.json({ valid: true, expiresAt: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() });
    }

    const result = await db.query('SELECT * FROM codes WHERE code = ?', [upper]);
    if (result.rows.length === 0) return res.json({ valid: false, reason: 'invalid' });
    const row = result.rows[0];
    const now = new Date().toISOString();
    if (row.expires_at && row.expires_at < now) return res.json({ valid: false, reason: 'expired' });
    if (!row.first_used_at) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.query('UPDATE codes SET first_used_at = ?, expires_at = ? WHERE code = ?', [now, expiresAt, upper]);
      return res.json({ valid: true, expiresAt });
    }
    return res.json({ valid: true, expiresAt: row.expires_at });
  } catch (err) {
    console.error('/api/auth/verify error:', err.message);
    res.status(500).json({ valid: false, reason: 'error' });
  }
});

// ── Products ──
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM products ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// ── Occasions ──
app.get('/api/occasions', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM occasions ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// ── Inspire ──
app.post('/api/inspire', async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI features not yet configured on this server.' });
  const { answers, lang } = req.body;
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: buildInspirePrompt(answers, lang) }]
    });
    res.json({ idea: message.content[0].text });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Could not generate inspiration right now. Please try again.' });
  }
});

// ── Spark ──
app.post('/api/spark', async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI features not yet configured on this server.' });
  const { answers, lang } = req.body;
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: buildSparkPrompt(answers, lang) }]
    });
    res.json({ text: message.content[0].text });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Could not generate activities right now. Please try again.' });
  }
});

// ── Generate image ──
app.post('/api/generate-image', async (req, res) => {
  if (!replicate) return res.status(503).json({ error: 'Image generation not configured. Set REPLICATE_API_TOKEN.' });
  const { idea } = req.body;
  if (!idea) return res.status(400).json({ error: 'No idea provided.' });
  try {
    const imagePrompt = 'Oil painting on canvas, impressionist style, ' +
      String(idea).slice(0, 220) +
      ', warm earth tones, soft brushstrokes, four canvas panels, beautiful composition, studio art';
    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: { prompt: imagePrompt, num_outputs: 1, output_format: 'webp', output_quality: 80 }
    });
    const raw = output[0];
    const imageUrl = (raw && typeof raw.url === 'function') ? raw.url().href : String(raw);
    res.json({ imageUrl });
  } catch (err) {
    console.error('Replicate error:', err.message);
    res.status(500).json({ error: 'Could not generate an image right now. Please try again.' });
  }
});

// ── Admin: products ──
app.post('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await db.query('INSERT INTO products (name) VALUES (?)', [name.trim()]);
    res.json({ id: Number(r.lastInsertRowid), name: name.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: occasions ──
app.post('/api/admin/occasions', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await db.query('INSERT INTO occasions (name) VALUES (?)', [name.trim()]);
    res.json({ id: Number(r.lastInsertRowid), name: name.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/occasions/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM occasions WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: codes ──
app.get('/api/admin/codes', adminAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const result = await db.query('SELECT * FROM codes ORDER BY created_at DESC');
    const codes = result.rows.map(function (row) {
      var status = !row.first_used_at ? 'unused' : (row.expires_at > now ? 'active' : 'expired');
      return { id: row.id, code: row.code, created_at: row.created_at, first_used_at: row.first_used_at, expires_at: row.expires_at, status };
    });
    res.json(codes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/admin/codes/generate', adminAuth, async (req, res) => {
  try {
    const count = Math.min(parseInt(req.body.count) || 10, 200);
    const generated = [];
    let failures = 0;
    while (generated.length < count && failures < 100) {
      const code = generateCode();
      try {
        await db.query('INSERT INTO codes (code) VALUES (?)', [code]);
        generated.push(code);
      } catch (e) { failures++; }
    }
    res.json({ codes: generated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/codes/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM codes WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Prompt builders ──
function buildInspirePrompt(answers, lang) {
  const seasonal = getSeasonalContext();
  const seasonHint = lang === 'nl' ? seasonal.nl : seasonal.en;
  const lines = answers.map(function (a) {
    return (a.question ? a.question + '\n→ ' : '') + a.answer;
  }).join('\n\n');
  const parts = [
    'You are a warm, creative painting guide for Studio Sorelle, a painting kit company.',
    '', 'A group just opened their painting kit and answered a few questions:', '', lines, '',
    'Seasonal context: ' + seasonHint, '',
    'Generate a short, specific painting idea for them.',
    'They have 4 small canvases — one per person — that physically combine into one large unified piece.',
    'Include:',
    '- A theme or subject (2-4 evocative words)',
    '- One sentence for each of the 4 canvases (what that person paints, positioned top-left / top-right / bottom-left / bottom-right)',
    '- One sentence on how the four pieces connect into the full image', '',
    'Under 180 words. Warm, specific, encouraging. Flowing prose — no bullet points or headers.'
  ];
  if (lang === 'nl') parts.push('Respond entirely in Dutch.');
  return parts.join('\n');
}

function buildSparkPrompt(answers, lang) {
  const lines = answers.map(function (a) {
    return (a.question ? a.question + '\n→ ' : '') + a.answer;
  }).join('\n\n');
  const parts = [
    'You are a fun, energetic activity host for Studio Sorelle, a painting kit company.',
    '', 'A group is about to start a painting session and answered these questions:', '', lines, '',
    'Generate exactly 7 short painting session activities or mini-games.',
    'Tailor the complexity and duration of activities to match the available time.',
    'Each activity should be playful, creative, and fit the group\'s context.',
    'Format: number each activity (1. 2. 3. etc.), one line each, max 2 sentences per activity.',
    'Make them diverse — not all the same type. Be warm, energetic, and fun.',
    'Under 300 words total.'
  ];
  if (lang === 'nl') parts.push('Respond entirely in Dutch.');
  return parts.join('\n');
}

// ── SPA fallback ──
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function () {
  console.log('alice listening on port ' + PORT);
});
