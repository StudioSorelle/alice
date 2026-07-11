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
    // answers[1] = player count ('1','2','3','4','5+')
    // answers[2] = time ('45 minutes','1 hour','2+ hours')
    // answers[3] = occasion
    // answers[4] = activity type
    var playersRaw  = answers[1] ? answers[1].answer : '2';
    var playerCount = playersRaw === '5+' ? 5 : (parseInt(playersRaw, 10) || 2);
    var timeAnswer  = answers[2] ? answers[2].answer : '1 hour';
    var occasion    = answers[3] ? answers[3].answer : 'any';
    var actType     = answers[4] ? answers[4].answer : 'mix';

    // Number of activities scales with available time (PDF spec)
    var actCount = timeAnswer === '45 minutes' ? 3 : timeAnswer === '1 hour' ? 5 : 7;

    // Exclude long-format activities (e.g. "every 15 minutes") for short sessions
    var durationClause = timeAnswer === '45 minutes' ? " AND duration != 'long'" : '';

    var result;
    if (actType === 'mix') {
      result = await db.query(
        "SELECT * FROM activities WHERE (occasion = 'any' OR occasion = ?) AND min_players <= ?" + durationClause,
        [occasion, playerCount]
      );
    } else {
      result = await db.query(
        "SELECT * FROM activities WHERE type = ? AND (occasion = 'any' OR occasion = ?) AND min_players <= ?" + durationClause,
        [actType, occasion, playerCount]
      );
    }
    var rows = result.rows.slice();
    // Fisher-Yates shuffle
    for (var i = rows.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
    }
    var activities = rows.slice(0, actCount).map(function (row) {
      return { id: row.id, type: row.type, description: lang === 'nl' ? row.description_nl : row.description_en };
    });
    res.json({ activities: activities });
  } catch (err) {
    console.error('Spark DB error:', err.message);
    res.status(500).json({ error: 'Could not load activities. Please try again.' });
  }
});

// ── Generate image ──
// Visual image prompts per style — English only, descriptive of the final painting
var STYLE_IMAGE_PROMPTS = {
  'Abstract':         'abstract expressionist painting on canvas, sweeping fluid colour fields with bold gestural brushstrokes, no recognisable objects, rich layered paint texture, expressive and vibrant',
  'Simplistisch':     'minimalist painting on canvas, 1 to 3 clearly recognisable objects such as a mountain or a vase with flowers, flat colour areas with clean outlines, generous white space, simple and clean',
  'Landschappen':     'landscape painting on canvas, open sky above a clear horizon line, natural scene with trees or sea or mountains, atmospheric depth, earthy tones, sweeping peaceful vista',
  'Stilleven':        'still life painting on canvas, everyday objects grouped on a table including fruit, warm directional light casting clear soft shadows, rich warm colour palette, calm and composed',
  'Speels':           'playful whimsical painting on canvas, bright cheerful contrasting colours, fun loose shapes like drops or swirls or confetti, visible energetic brushstrokes, joyful and dynamic',
  'Aesthetic':        'cute aesthetic painting on canvas, one adorable central object such as a duck or cherry or mushroom, surrounded by small repeated decorative accents like daisies or stars, pastel or muted colour palette, flat simplified shapes with thin dark outline, sticker art style, solid pastel background',
  'Dranken':          'still life painting on canvas of drinks and glassware such as a cocktail or wine glass or coffee cup, condensation droplets on glass, citrus slice or ice cube accent, warm atmospheric light, rich saturated colours',
  'Dieren':           'cute chibi-style animal painting on canvas, one adorable animal such as a fox or kitten or duckling, large round head and small body, two small shiny oval eyes with white highlight, rosy cheek blush marks, thick dark outline around the whole animal like sticker art, flat colour areas without realistic shading, solid soft pastel background',
  'Fantasie':         'fantasy painting on canvas, dramatic deep-blue starry sky or swirling galaxy, unicorn or dragon silhouette or magical forest, deep blues and purples with gold and silver accents, glowing magical light source',
  'Natuur':           'nature painting on canvas, botanical scene with flowers or trees or a flower field, clear horizon line or central composition axis, calm and meditative, pastel greens and blues, peaceful',
  'Mensen':           'painting on canvas of human silhouettes or simplified figures without facial detail, such as a dancing couple or a figure watching a sunset, focus on posture and emotion, warm tones',
  'Party':            'celebration painting on canvas, confetti and streamers and champagne and dancing silhouettes and party lights, bold energetic colours in pink and gold and bright blue, dynamic and chaotic composition',
  'Stad':             'urban cityscape painting on canvas, skyline silhouette against a dark sky, glowing street lamps, rainy street reflections, night atmosphere with warm light points against dark background',
  'Seizoensgebonden': 'seasonal painting on canvas, seasonal colours and atmospheric mood, time of year captured in expressive paint, harmonious seasonal palette'
};

var NEGATIVE_PROMPT = 'text, words, letters, watermark, signature, realistic photograph, 3d render, digital illustration, vector art, blurry, distorted, ugly, low quality, ornate frame, thick border, mat board, unfinished sketch, people, hands, easel, paint tubes, palette knife in frame';

// Suffix tells the model exactly how the output should look and be presented
var CANVAS_PROMPT_SUFFIX = 'acrylic paint on canvas with clearly visible loose brushstrokes, photographed as a clean flat-lay on a light neutral or white surface, soft warm overhead lighting that shows the paint texture and slight impasto relief, the artwork fills the entire frame edge to edge, simple and clear composition that a complete beginner can follow and reproduce step by step, Studio Sorelle painting kit reference image';

var MINI_PROMPT_SUFFIX = 'acrylic paint on a small square canvas with clearly visible loose brushstrokes, photographed as a clean flat-lay on a light neutral surface, the small artwork fills the entire frame, very simple motif with at most two shapes, a beginner can paint this in under an hour, Studio Sorelle mini kit reference image';

var TOTE_PROMPT_SUFFIX = 'acrylic paint on a white cotton tote bag with clearly visible brushstrokes, fabric texture visible beneath the paint, photographed flat lay on a clean light background, bold simple graphic design that works on textile, a beginner can paint this on a tote bag, Studio Sorelle tote kit reference image';

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
  const { idea, style, box } = req.body;
  try {
    const boxKey = getBoxKey(box || '');

    // Opening sentence: tell the model exactly what object to render
    const productIntro = boxKey === 'tote'
      ? 'Generate an image of a finished painting on a 20 by 20 centimetre white cotton tote bag. The design is painted with acrylic paint on textile.'
      : boxKey === 'mini'
        ? 'Generate an image of finished paintings on small 10 by 10 centimetre acrylic canvases.'
        : 'Generate an image of a finished acrylic painting on a 30 by 30 centimetre canvas.';

    // Transition: connect the product to the style/idea
    const transition = boxKey === 'tote'
      ? 'The painted design on the tote bag is in the following style:'
      : 'The painting on the canvas is in the following style:';

    // Style/idea content: use the exact idea text shown on the site, fall back to style prompt
    const styleContent = idea
      ? String(idea).trim()
      : (STYLE_IMAGE_PROMPTS[style] || ('acrylic painting in the style: ' + (style || 'impressionist')));

    // Presentation suffix: how the output photo should look
    const presentationSuffix = boxKey === 'tote' ? TOTE_PROMPT_SUFFIX
      : boxKey === 'mini' ? MINI_PROMPT_SUFFIX
      : CANVAS_PROMPT_SUFFIX;

    const imagePrompt = productIntro + ' ' + transition + '\n\n' + styleContent + '\n\n' + presentationSuffix;

    console.log('[generate-image] model: flux-dev | prompt:\n' + imagePrompt);

    const aspectRatio = boxKey === 'tote' ? '2:3' : '1:1';

    const output = await replicate.run('black-forest-labs/flux-dev', {
      input: {
        prompt: imagePrompt,
        negative_prompt: NEGATIVE_PROMPT,
        num_outputs: 1,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        aspect_ratio: aspectRatio,
        output_format: 'webp',
        output_quality: 85
      }
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
