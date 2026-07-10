require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const db = require('./db');
const migrate = require('./db/migrate');
const PROMPTS = require('./prompts.json');

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

let s3 = null;
if (process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
  s3 = new S3Client({
    region: 'auto',
    endpoint: 'https://' + process.env.CLOUDFLARE_R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''
    }
  });
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

// ── Seasonal helpers ──
function getCurrentSeason() {
  var month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function getBoxKey(productName) {
  var lower = (productName || '').toLowerCase();
  if (lower.indexOf('mini') >= 0) return 'mini';
  if (lower.indexOf('tote') >= 0) return 'tote';
  return 'canvas';
}

function getActiveSeasonal(l) {
  var now = new Date();
  var month = now.getMonth() + 1;
  var day = now.getDate();
  var md = (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
  for (var i = 0; i < PROMPTS.seasonal.length; i++) {
    var s = PROMPTS.seasonal[i];
    var active = s.from <= s.to ? (md >= s.from && md <= s.to) : (md >= s.from || md <= s.to);
    if (active) return s[l] || null;
  }
  return null;
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

// ── Inspire (template-based, no AI) ──
app.post('/api/inspire', function (req, res) {
  var answers = req.body.answers;
  var lang = req.body.lang;
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  res.json({ idea: buildInspireIdea(answers, lang) });
});

// ── Spark (DB-based randomizer, no AI) ──
app.post('/api/spark', async (req, res) => {
  const { answers, lang } = req.body;
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  try {
    var occasion = answers[3] ? answers[3].answer : 'any';
    var actType = answers[4] ? answers[4].answer : 'mix';
    var result;
    if (actType === 'mix') {
      result = await db.query(
        "SELECT * FROM activities WHERE (occasion = 'any' OR occasion = ?)",
        [occasion]
      );
    } else {
      result = await db.query(
        "SELECT * FROM activities WHERE type = ? AND (occasion = 'any' OR occasion = ?)",
        [actType, occasion]
      );
    }
    var rows = result.rows.slice();
    for (var i = rows.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
    }
    var activities = rows.slice(0, 7).map(function (row) {
      return { id: row.id, type: row.type, description: lang === 'nl' ? row.description_nl : row.description_en };
    });
    res.json({ activities: activities });
  } catch (err) {
    console.error('Spark DB error:', err.message);
    res.status(500).json({ error: 'Could not load activities. Please try again.' });
  }
});

// ── Generate image ──
var STYLE_HINTS = {
  'Abstract':         'abstract expressionist canvas, fluid shapes and sweeping colour fields',
  'Simplistisch':     'minimalist canvas, clean simple forms, flat colour areas, generous negative space',
  'Landschappen':     'landscape oil painting, open sky, horizon line, earthy tones, sweeping vista',
  'Stilleven':        'still life oil painting, arranged objects, rich shadows and warm highlights',
  'Speels':           'playful whimsical painting, bright cheerful palette, fun shapes and characters',
  'Aesthetic':        'moody curated painting, muted palette, soft textures, atmospheric and considered',
  'Dranken':          'still life of drinks and glassware, warm light, condensation on glass, rich saturated colours',
  'Dieren':           'animal portrait, expressive eyes, detailed fur or feathers, natural habitat glimpse',
  'Fantasie':         'fantasy world painting, dramatic sky, mythical creatures, enchanted landscape, glowing magical light',
  'Natuur':           'close-up botanical nature study, leaves and flowers, dappled light, organic forms',
  'Mensen':           'portrait of people, warm expressions, hands and faces, intimate human connection',
  'Party':            'celebration painting, balloons and confetti, festive colours, joyful energy',
  'Stad':             'urban cityscape painting, skyline silhouettes, busy street life, architectural detail',
  'Seizoensgebonden': 'seasonal landscape painting, seasonal colours and atmosphere, time of year captured in paint'
};

function trimIdea(text, maxLen) {
  if (text.length <= maxLen) return text;
  var cut = text.slice(0, maxLen);
  var lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastSentence > maxLen * 0.5) return cut.slice(0, lastSentence + 1).trim();
  var lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

app.post('/api/generate-image', async (req, res) => {
  if (!replicate) return res.status(503).json({ error: 'Image generation not configured. Set REPLICATE_API_TOKEN.' });
  const { idea, style } = req.body;
  if (!idea) return res.status(400).json({ error: 'No idea provided.' });
  try {
    const styleDesc = STYLE_HINTS[style] || 'impressionist oil painting';
    const imagePrompt = styleDesc + ' on canvas, ' +
      trimIdea(String(idea), 220) +
      ', warm earth tones, four panel composition, beautiful studio art';
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

// ── Moments: presigned upload URL ──
app.post('/api/moments/upload-url', async (req, res) => {
  if (!s3) return res.status(503).json({ error: 'Image storage not configured. Add Cloudflare R2 env vars.' });
  const { filename, contentType } = req.body;
  if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = 'moments/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + (ext || 'jpg');
  try {
    const cmd = new PutObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    res.json({ url, key });
  } catch (err) {
    console.error('R2 presign error:', err.message);
    res.status(500).json({ error: 'Could not prepare upload. Please try again.' });
  }
});

// ── Moments: save metadata ──
app.post('/api/moments', async (req, res) => {
  const { product, occasion, description, name, imageKey, socialConsent } = req.body;
  if (!product || !imageKey) return res.status(400).json({ error: 'product and imageKey required' });
  const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  const imageUrl = base + '/' + imageKey;
  try {
    await db.query(
      "INSERT INTO moments (product, occasion, description, name, image_url, social_consent) VALUES (?, ?, ?, ?, ?, ?)",
      [product, occasion || null, description || null, name || null, imageUrl, socialConsent ? 1 : 0]
    );
    res.json({ ok: true, imageUrl });
  } catch (err) {
    console.error('Save moment error:', err.message);
    res.status(500).json({ error: 'Could not save your moment. Please try again.' });
  }
});

// ── Admin: moments ──
app.get('/api/admin/moments', adminAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM moments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

function buildInspireIdea(answers, lang) {
  var l = lang === 'nl' ? 'nl' : 'en';
  // answers[0]=group, answers[1]=product, answers[2]=style, answers[3]=time, answers[4]=level
  var group  = answers[0] ? answers[0].answer : 'Alone';
  var box    = answers[1] ? answers[1].answer : '';
  var style  = answers[2] ? answers[2].answer : '';
  var time   = answers[3] ? answers[3].answer : '1 hour';
  var level  = answers[4] ? answers[4].answer : 'Balanced';

  var boxKey = getBoxKey(box);
  var parts  = [];

  // 1. Box + group — logic differs per product type
  if (boxKey === 'mini') {
    // Mini: 2 small canvases (10×10 cm) per person, always separate, never grouped
    if (group === 'Alone') {
      var f = PROMPTS.mini_solo;
      if (f && f[l]) parts.push(f[l]);
    } else {
      var peopleCount = group === '5+' ? 5 : parseInt(group, 10);
      var total       = peopleCount * 2;
      var countLabel  = group === '5+' ? '5+' : String(peopleCount);
      var totalLabel  = group === '5+' ? '10+' : String(total);
      var f = PROMPTS.mini_group;
      if (f && f[l]) {
        parts.push(f[l].replace(/\{count\}/g, countLabel).replace(/\{total\}/g, totalLabel));
      }
    }

  } else if (boxKey === 'tote') {
    // Tote: each person paints their own separate tote bag (20×20 cm, textile), never grouped
    if (group === 'Alone') {
      var f = PROMPTS.tote_solo;
      if (f && f[l]) parts.push(f[l]);
    } else {
      var f = PROMPTS.tote_group;
      if (f && f[l]) {
        parts.push(f[l].replace(/\{count\}/g, group));
      }
    }

  } else {
    // Canvas: 1 canvas per person (30×30 cm); groups combine into a polyptych
    var boxFrag = PROMPTS.box.canvas;
    if (boxFrag && boxFrag[l]) parts.push(boxFrag[l]);

    if (group === 'Alone') {
      var af = PROMPTS.group.Alone;
      if (af && af[l]) parts.push(af[l]);
    } else {
      var mf = PROMPTS.group.multiple;
      if (mf && mf[l]) parts.push(mf[l].replace(/\{count\}/g, group));
      var splitKey = (group === '5+' || parseInt(group, 10) >= 5) ? '5+' : group;
      var sf = PROMPTS.canvas_splits[splitKey];
      if (sf && sf[l]) parts.push(sf[l]);
    }
  }

  // 2. Style / theme (applies to all box types)
  if (style === 'Seizoensgebonden') {
    var seasonalStyle = getActiveSeasonal(l);
    if (seasonalStyle) parts.push(seasonalStyle);
  } else {
    var styleDef = PROMPTS.styles[style];
    if (styleDef && styleDef[l]) {
      parts.push(styleDef[l]);
    } else if (style) {
      parts.push(l === 'nl'
        ? 'Schilder in de stijl of rond het thema: ' + style + '.'
        : 'Paint in the style or around the theme: ' + style + '.');
    }
    var seasonal = getActiveSeasonal(l);
    if (seasonal) parts.push(seasonal);
  }

  // 3. Level
  var levelFrag = PROMPTS.level[level];
  if (levelFrag && levelFrag[l]) parts.push(levelFrag[l]);

  // 4. Time
  var timeFrag = PROMPTS.time[time];
  if (timeFrag && timeFrag[l]) parts.push(timeFrag[l]);

  return parts.join('\n\n');
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
