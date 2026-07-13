require('dotenv').config();
const express = require('express');
const path = require('path');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cron = require('node-cron');
const { Resend } = require('resend');
const db = require('./db');
const migrate = require('./db/migrate');
const PROMPTS = require('./prompts.json');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ verify: function (req, res, buf) { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

migrate();

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

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// ── Admin auth ──
function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── User auth gate (for gallery) ──
async function authGate(req, res, next) {
  var code = (req.headers['x-access-code'] || '').trim().toUpperCase();
  if (!code) return res.status(401).json({ error: 'Access code required' });
  if (code === MASTER_CODE) return next();
  try {
    var result = await db.query('SELECT * FROM codes WHERE code = ?', [code]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid code' });
    var row = result.rows[0];
    var now = new Date().toISOString();
    if (row.expires_at && row.expires_at < now) return res.status(401).json({ error: 'Code expired' });
    next();
  } catch (err) { res.status(500).json({ error: 'Auth error' }); }
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
  var paintTogether = req.body.paintTogether; // true | false | null (not applicable)
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  res.json({ idea: buildInspireIdea(answers, lang, paintTogether) });
});

// ── Spark (DB-based randomizer, no AI) ──
app.post('/api/spark', async (req, res) => {
  const { answers, lang } = req.body;
  if (!answers || !Array.isArray(answers) || !answers.length)
    return res.status(400).json({ error: 'Please answer the questions first.' });
  try {
    // answers[1] = player count ('1','2','3','4','5+')
    // answers[2] = time ('30 min','1 hour','2+ hours')
    // answers[3] = occasion
    // answers[4] = activity type
    var playersRaw  = answers[1] ? answers[1].answer : '2';
    var playerCount = playersRaw === '5+' ? 5 : (parseInt(playersRaw, 10) || 2);
    var timeAnswer  = answers[2] ? answers[2].answer : '1 hour';
    var occasion    = answers[3] ? answers[3].answer : 'any';
    var actType     = answers[4] ? answers[4].answer : 'mix';

    // Number of activities scales with available time (document spec)
    var actCount = timeAnswer === '30 min' ? 2 : timeAnswer === '1 hour' ? 3 : 5;

    // Exclude long-format activities (e.g. "every 15 minutes") for short sessions
    var durationClause = timeAnswer === '30 min' ? " AND duration != 'long'" : '';

    function fisherYates(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    var activities;
    if (actType === 'mix') {
      var gamesRes = await db.query(
        "SELECT * FROM activities WHERE type = 'studio_games' AND (occasion = 'any' OR occasion = ?) AND min_players <= ?" + durationClause,
        [occasion, playerCount]
      );
      var talksRes = await db.query(
        "SELECT * FROM activities WHERE type = 'sorelle_talks' AND (occasion = 'any' OR occasion = ?) AND min_players <= ?" + durationClause,
        [occasion, playerCount]
      );
      var gamesPool = fisherYates(gamesRes.rows.slice());
      var talksPool = fisherYates(talksRes.rows.slice());
      var gi = 0, ti = 0;
      var result = [];
      // Start with a random type
      var currentType = Math.random() < 0.5 ? 'games' : 'talks';
      while (result.length < actCount && (gi < gamesPool.length || ti < talksPool.length)) {
        var pool = currentType === 'games' ? gamesPool : talksPool;
        var idx  = currentType === 'games' ? gi : ti;
        if (idx >= pool.length) {
          // Switch to the other pool if current is exhausted
          currentType = currentType === 'games' ? 'talks' : 'games';
          continue;
        }
        var runSize = Math.min(
          Math.floor(Math.random() * 3) + 1,  // 1–3
          actCount - result.length,             // don't exceed target
          pool.length - idx                     // don't exceed remaining in pool
        );
        for (var k = 0; k < runSize; k++) {
          var row = currentType === 'games' ? gamesPool[gi++] : talksPool[ti++];
          result.push(row);
        }
        currentType = currentType === 'games' ? 'talks' : 'games';
      }
      activities = result.map(function (row) {
        return { id: row.id, type: row.type, description: lang === 'nl' ? row.description_nl : row.description_en };
      });
    } else {
      var result = await db.query(
        "SELECT * FROM activities WHERE type = ? AND (occasion = 'any' OR occasion = ?) AND min_players <= ?" + durationClause,
        [actType, occasion, playerCount]
      );
      var rows = fisherYates(result.rows.slice());
      activities = rows.slice(0, actCount).map(function (row) {
        return { id: row.id, type: row.type, description: lang === 'nl' ? row.description_nl : row.description_en };
      });
    }
    res.json({ activities: activities });
  } catch (err) {
    console.error('Spark DB error:', err.message);
    res.status(500).json({ error: 'Could not load activities. Please try again.' });
  }
});

// ── Generate image ──
// Visual style prompts — describe HOW the painting looks (not what it depicts)
var STYLE_IMAGE_PROMPTS = {
  'Abstract':         'abstract expressionist style, sweeping fluid colour fields with bold gestural brushstrokes, loosely abstracted forms that reference the subject through colour and gesture rather than literal depiction, rich layered paint texture, expressive and vibrant',
  'Minimalist':       'minimalist style, clean composition with at most 2 or 3 shapes, generous empty space on the canvas, flat colour areas with crisp outlines, strong through simplicity',
  'Realistic':        'realistic painting style, accurate proportions and lifelike rendering, clear light source casting soft shadows, multiple tones of each colour creating depth and volume',
  'Impressionistic':  'impressionist painting style, loose visible dabs and strokes of colour, soft blended edges, capturing light and atmosphere rather than sharp detail, warm luminous palette',
  'Surreal':          'surrealist style, dreamlike impossible scene combining recognisable objects in unexpected ways, painted with realism but depicting something that cannot exist in reality',
  'Geometric':        'geometric style, subject built from flat geometric shapes like triangles, circles, and rectangles, strong colour blocks with sharp contrasts, stained-glass or Mondrian-inspired',
  'Expressive':       'expressionist style, large energetic brushstrokes conveying strong emotion, bold saturated colour used for emotional impact rather than accuracy, visible layered gestural marks',
  'Colorful':         'vibrant colorful style, maximum colour saturation and variety, complementary colour pairs placed side by side for visual vibration, joyful and exuberant composition',
  'Monochromatic':    'monochromatic style, painted entirely in one colour family from nearly white to nearly black, depth created through value contrast alone, harmonious and refined',
  'Soft and dreamy':  'soft dreamy style, pastel tones blending gently into each other with no hard edges, romantic and ethereal atmosphere, hazy luminous quality as if veiled in soft mist'
};

// Visual topic prompts — describe WHAT the painting depicts
var TOPIC_IMAGE_PROMPTS = {
  'Landschappen': 'landscape scene, open sky above a clear horizon line, natural elements like trees, sea, or mountains, atmospheric depth, peaceful vista',
  'Stilleven':    'still life, everyday objects grouped on a table including fruit, warm directional light casting soft shadows, calm and composed',
  'Dranken':      'drinks and glassware such as a cocktail, wine glass, or coffee cup, condensation droplets, citrus slice or ice cube accent, atmospheric light',
  'Dieren':       'cute chibi-style animal, one adorable animal such as a fox or kitten or duckling, large round head and small body, two shiny oval eyes with white highlight, rosy cheek blush marks, thick dark outline like sticker art, solid soft pastel background',
  'Fantasie':     'fantasy scene, magical enchanted starry sky or swirling galaxy, unicorn or dragon silhouette or magical forest, deep blues and purples with gold and silver accents, glowing magical light source',
  'Natuur':       'nature scene, botanical elements with flowers or trees or a flower field, close-up botanical composition, calm and meditative, soft greens and blues',
  'Mensen':       'human silhouettes or simplified figures without facial detail, such as a dancing couple or a figure watching a sunset, focus on posture and emotion, warm tones',
  'Party':        'celebration scene, confetti and streamers and champagne and dancing silhouettes and party lights, bold energetic colours in pink and gold and bright blue, dynamic composition',
  'Stad':         'urban cityscape, skyline silhouette against a dark sky, glowing street lamps, rainy street reflections, night atmosphere with warm light points against dark background',
  'Vlakken':      'flat geometric shapes and pure colour fields, Mondrian or Malevich-inspired composition of squares, circles, rectangles and stripes, bold colour blocks with clean outlines, no representational figures'
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
  const { idea, style, topic, box, group, paintTogether } = req.body;
  try {
    const boxKey    = getBoxKey(box || '');
    const groupVal  = group || 'Alone';
    const count     = groupVal === 'Alone' ? 1 : (groupVal === '5+' ? 5 : (parseInt(groupVal, 10) || 1));

    // Build product intro: exact number of physical items must appear in the image
    var productIntro;

    if (boxKey === 'mini') {
      // Mini: every person gets 2 canvases → total = count × 2
      const total = count * 2;
      if (count === 1) {
        productIntro = 'Studio Sorelle mini canvas painting kit. Generate a photorealistic flat-lay image showing exactly TWO small square 10×10 cm acrylic canvases side by side. Each canvas has a different simple motif in a matching style. Motifs must be extremely simple — at most 1 shape per canvas — because the canvases are tiny. Both canvases must be clearly and fully visible in the image.';
      } else {
        productIntro = 'Studio Sorelle mini canvas painting kit for ' + count + ' people. Generate a photorealistic flat-lay image showing exactly ' + total + ' small square 10×10 cm acrylic canvases arranged in a neat group (' + count + ' people × 2 canvases each = ' + total + ' canvases total). Every single canvas must be clearly visible. Each canvas has a different but stylistically consistent motif. Motifs must be extremely simple — at most 1 shape per canvas — because the canvases are tiny.';
      }
    } else if (boxKey === 'tote') {
      // Tote: 1 per person
      if (count === 1) {
        productIntro = 'Studio Sorelle tote bag painting kit. Generate a photorealistic flat-lay image of a finished acrylic design painted by hand on a white square cotton tote bag (approximately 20×20 cm paintable surface). The design must be bold, simple, and clearly readable on fabric.';
      } else {
        productIntro = 'Studio Sorelle tote bag painting kit for ' + count + ' people. Generate a photorealistic flat-lay image showing exactly ' + count + ' white cotton tote bags arranged together in one image. Every tote bag must be clearly visible. Each bag has a different but stylistically consistent acrylic design painted on it (approximately 20×20 cm surface). The designs must be bold and simple enough to work on fabric.';
      }
    } else {
      // Canvas 30×30 cm
      if (count === 1) {
        productIntro = 'Studio Sorelle signature canvas painting kit. Generate a photorealistic image of a finished acrylic painting on a single square 30×30 cm canvas. The composition should be clear and simple enough that a first-time painter can feasibly recreate it. Show the canvas straight-on so its square format and composition are fully visible.';
      } else if (paintTogether === false) {
        // Separate: one idea generated per person — show a single canvas
        productIntro = 'Generate a photorealistic flat-lay image of a single square 30×30 cm canvas with a standalone acrylic painting. Each painter receives their own separate idea.';
      } else {
        // Together: polyptych where canvases combine into one image
        var panelWord = count === 2 ? 'diptych (2 panels)' : count === 3 ? 'triptych (3 panels)' : (count + '-panel polyptych');
        productIntro = 'Studio Sorelle signature canvas painting kit for ' + count + ' people painting one connected image together. Generate a photorealistic image showing a ' + panelWord + ' — exactly ' + count + ' separate square 30×30 cm canvases arranged side by side to form ONE single connected painting. Every canvas panel must be clearly visible. The colours, shapes, and light must flow continuously across all ' + count + ' panels as one unified composition.';
      }
    }

    // Style + topic visual descriptors
    const styleVisual = STYLE_IMAGE_PROMPTS[style] || '';
    const topicClean  = (topic || '').trim();
    const topicVisual = (topicClean && topicClean !== '__any__')
      ? (TOPIC_IMAGE_PROMPTS[topicClean] || ('subject: ' + topicClean))
      : '';

    // If we have the full idea text, use it directly (it is already the authoritative description)
    // Otherwise build from style + topic visuals
    const ideaText = idea ? String(idea).trim() : '';
    const styleContent = ideaText
      || [styleVisual, topicVisual].filter(Boolean).join(', ')
      || 'acrylic painting, simple beginner-friendly composition';

    // Presentation suffix: how the output photo should look
    const presentationSuffix = boxKey === 'tote' ? TOTE_PROMPT_SUFFIX
      : boxKey === 'mini' && count > 1 ? 'acrylic paint on small square canvases with clearly visible loose brushstrokes, photographed as a clean flat-lay on a light neutral surface, all canvases fully visible in the frame, very simple motifs a beginner can paint in under an hour, Studio Sorelle mini kit reference image'
      : boxKey === 'mini' ? MINI_PROMPT_SUFFIX
      : CANVAS_PROMPT_SUFFIX;

    const imagePrompt = productIntro + '\n\nThe painting shows: ' + styleContent + '\n\n' + presentationSuffix;

    console.log('[generate-image] model: flux-dev | prompt:\n' + imagePrompt);

    // Multi-panel canvases side-by-side need wider aspect ratio
    var aspectRatio;
    if (paintTogether === false) {
      aspectRatio = '1:1';  // separate painting: always show one square canvas
    } else if (boxKey === 'tote') {
      aspectRatio = '2:3';
    } else if (boxKey === 'canvas' && count >= 3 && paintTogether !== false) {
      aspectRatio = '16:9';   // 3+ polyptych panels are very wide
    } else if ((boxKey === 'canvas' && count === 2) || (boxKey === 'mini' && count >= 2) || (boxKey === 'tote' && count >= 2)) {
      aspectRatio = '4:3';    // 2 items or small group: slightly wider than square
    } else {
      aspectRatio = '1:1';
    }

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

// ── Moments: upload image via backend proxy (avoids browser CORS to R2) ──
app.post('/api/moments/upload', express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
  if (!s3) return res.status(503).json({ error: 'Image storage not configured. Add Cloudflare R2 env vars.' });
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0)
    return res.status(400).json({ error: 'No image data received. Please try again.' });
  const contentType = (req.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
  const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = 'moments/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      Key: key,
      Body: req.body,
      ContentType: contentType
    }));
    res.json({ key });
  } catch (err) {
    console.error('R2 upload error:', err.message);
    res.status(500).json({ error: 'Could not upload image. Please try again.' });
  }
});

// ── Moments: save metadata ──
app.post('/api/moments', async (req, res) => {
  const { product, occasion, quote, description, name, imageKey, socialConsent } = req.body;
  if (!product || !imageKey) return res.status(400).json({ error: 'product and imageKey required' });
  const base = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  const imageUrl = base + '/' + imageKey;
  try {
    await db.query(
      "INSERT INTO moments (product, occasion, quote, description, name, image_url, social_consent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [product, occasion || null, quote || null, description || null, name || null, imageUrl, socialConsent ? 1 : 0]
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

function buildInspireIdea(answers, lang, paintTogether) {
  var l = lang === 'nl' ? 'nl' : 'en';
  // answers[0]=group, answers[1]=product, answers[2]=style, answers[3]=topic, answers[4]=time, answers[5]=level
  var group  = answers[0] ? answers[0].answer : 'Alone';
  var box    = answers[1] ? answers[1].answer : '';
  var style  = answers[2] ? answers[2].answer : '';
  var topic  = answers[3] ? answers[3].answer : '';
  var time   = answers[4] ? answers[4].answer : '1 hour';
  var level  = answers[5] ? answers[5].answer : 'Balanced';

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
    // Canvas: 1 canvas per person (30×30 cm)
    var boxFrag = PROMPTS.box.canvas;
    if (boxFrag && boxFrag[l]) parts.push(boxFrag[l]);

    if (group === 'Alone') {
      var af = PROMPTS.group.Alone;
      if (af && af[l]) parts.push(af[l]);
    } else if (paintTogether === false) {
      // Separate: each person paints their own standalone canvas
      var csf = PROMPTS.canvas_separate;
      if (csf && csf[l]) parts.push(csf[l].replace(/\{count\}/g, group));
    } else {
      // Together (default): canvases combine into a polyptych
      var mf = PROMPTS.group.multiple;
      if (mf && mf[l]) parts.push(mf[l].replace(/\{count\}/g, group));
      var splitKey = (group === '5+' || parseInt(group, 10) >= 5) ? '5+' : group;
      var sf = PROMPTS.canvas_splits[splitKey];
      if (sf && sf[l]) parts.push(sf[l]);
    }
  }

  // 2. Style (how to paint)
  if (style === 'Seizoensgebonden') {
    var seasonalStyle = getActiveSeasonal(l);
    if (seasonalStyle) parts.push(seasonalStyle);
    // Seasonal is both style and topic — skip separate topic/overlay below
  } else {
    var styleDef = PROMPTS.styles[style];
    if (styleDef && styleDef[l]) {
      parts.push(styleDef[l]);
    } else if (style) {
      parts.push(l === 'nl'
        ? 'Schilderstijl: ' + style + '.'
        : 'Painting style: ' + style + '.');
    }

    // 3. Topic (what to paint)
    var topicClean = (topic || '').trim();
    if (topicClean && topicClean !== '__any__') {
      var topicDef = PROMPTS.topics && PROMPTS.topics[topicClean];
      if (topicDef && topicDef[l]) {
        parts.push(topicDef[l]);
      } else {
        parts.push(l === 'nl'
          ? 'Onderwerp: ' + topicClean + '.'
          : 'Subject: ' + topicClean + '.');
      }
    }

    // Seasonal overlay always applied on top (except when Seizoensgebonden is the style)
    var seasonal = getActiveSeasonal(l);
    if (seasonal) parts.push(seasonal);
  }

  // 4. Level
  var levelFrag = PROMPTS.level[level];
  if (levelFrag && levelFrag[l]) parts.push(levelFrag[l]);

  // 5. Time
  var timeFrag = PROMPTS.time[time];
  if (timeFrag && timeFrag[l]) parts.push(timeFrag[l]);

  return parts.join('\n\n');
}

// ── Config ──
app.get('/api/config', function (req, res) {
  res.json({ feedbackUrl: process.env.FEEDBACK_URL || null });
});

// ── Gallery: public approved moments ──
app.get('/api/moments/public', authGate, async (req, res) => {
  try {
    var clauses = ['approved = 1'];
    var params = [];
    if (req.query.occasion) { clauses.push('occasion = ?'); params.push(req.query.occasion); }
    var sql = 'SELECT id, product, occasion, quote, name, image_url, created_at FROM moments WHERE ' + clauses.join(' AND ') + ' ORDER BY created_at DESC';
    var result = await db.query(sql, params);
    var rows = result.rows;
    if (req.query.box) {
      var boxFilter = req.query.box.toLowerCase();
      rows = rows.filter(function (r) { return getBoxKey(r.product) === boxFilter; });
    }
    res.json(rows);
  } catch (err) {
    console.error('Public gallery error:', err.message);
    res.status(500).json({ error: 'Could not load gallery.' });
  }
});

// ── Admin: approve / reject moments ──
app.patch('/api/admin/moments/:id/approve', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE moments SET approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch('/api/admin/moments/:id/reject', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE moments SET approved = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin: gallery UI ──
app.get('/admin/gallery', function (req, res) {
  res.send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Gallery — Studio Sorelle</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f5f5f5;color:#222;padding:24px}h1{font-size:1.4rem;margin-bottom:4px}.sub{color:#666;font-size:.85rem;margin-bottom:24px}.section-title{font-size:1rem;font-weight:600;margin:24px 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.card{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}.card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}.card-body{padding:10px 12px 12px}.card-meta{font-size:.75rem;color:#888;margin-bottom:4px}.card-quote{font-size:.8rem;color:#444;font-style:italic;margin-bottom:8px;word-break:break-word}.card-actions{display:flex;gap:8px}.btn{padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:.8rem;font-weight:600}.btn-approve{background:#22c55e;color:#fff}.btn-reject{background:#ef4444;color:#fff}.btn-revoke{background:#f59e0b;color:#fff}.btn:disabled{opacity:.5;cursor:not-allowed}.empty{color:#999;font-size:.9rem;padding:16px 0}#pw-screen{max-width:320px;margin:60px auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1)}#pw-screen input{width:100%;padding:10px;margin:12px 0;border:1px solid #ddd;border-radius:6px;font-size:1rem}#pw-screen button{width:100%;padding:10px;background:#222;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer}</style></head><body><div id="pw-screen"><h2>Admin Login</h2><input type="password" id="pw-input" placeholder="Admin password" autocomplete="current-password"><button onclick="login()">Login</button><p id="pw-err" style="color:#ef4444;font-size:.85rem;margin-top:8px"></p></div><div id="main" style="display:none"><h1>Studio Sorelle — Admin Gallery</h1><p class="sub">Approve moments to make them visible in the public gallery.</p><button class="btn" style="background:#6366f1;color:#fff;margin-bottom:20px" onclick="sendDigest()">Send digest email now</button><span id="digest-msg" style="margin-left:12px;font-size:.85rem;color:#555"></span><p class="section-title">Pending approval</p><div class="grid" id="pending-grid"><p class="empty">Loading…</p></div><p class="section-title">Approved</p><div class="grid" id="approved-grid"><p class="empty">Loading…</p></div></div><script>var PW="";function h(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}function login(){PW=document.getElementById("pw-input").value;fetch("/api/admin/moments",{headers:{"x-admin-password":PW}}).then(function(r){if(r.status===401)throw new Error("wrong");return r.json();}).then(function(rows){document.getElementById("pw-screen").style.display="none";document.getElementById("main").style.display="";render(rows);}).catch(function(){document.getElementById("pw-err").textContent="Incorrect password.";});}document.getElementById("pw-input").addEventListener("keydown",function(e){if(e.key==="Enter")login();});function load(){fetch("/api/admin/moments",{headers:{"x-admin-password":PW}}).then(function(r){return r.json();}).then(render).catch(function(){});}function render(rows){var pending=rows.filter(function(r){return!r.approved;});var approved=rows.filter(function(r){return r.approved;});renderGrid("pending-grid",pending,false);renderGrid("approved-grid",approved,true);}function renderGrid(id,rows,isApproved){var el=document.getElementById(id);if(!rows.length){el.innerHTML="<p class=\\"empty\\">None.</p>";return;}el.innerHTML=rows.map(function(r){return"<div class=\\"card\\" id=\\"card-"+r.id+"\\"><img src=\\""+h(r.image_url)+"\\" alt=\\"\\" loading=\\"lazy\\"><div class=\\"card-body\\"><div class=\\"card-meta\\">"+h(r.product)+(r.occasion?" \xb7 "+h(r.occasion):"")+" \xb7 "+h((r.created_at||"").slice(0,10))+(r.name?" \xb7 "+h(r.name):"")+"</div>"+(r.quote?"<div class=\\"card-quote\\">\\u201c"+h(r.quote)+"\\u201d</div>":"")+"<div class=\\"card-actions\\">"+((!isApproved)?"<button class=\\"btn btn-approve\\" onclick=\\"approve("+r.id+")\\">Approve</button>":"")+(isApproved?"<button class=\\"btn btn-revoke\\" onclick=\\"reject("+r.id+")\\">Revoke</button>":"<button class=\\"btn btn-reject\\" onclick=\\"reject("+r.id+")\\">Reject</button>")+"</div></div></div>";}).join("");}function sendDigest(){var msg=document.getElementById("digest-msg");msg.textContent="Sending...";fetch("/api/admin/send-digest",{method:"POST",headers:{"x-admin-password":PW}}).then(function(r){return r.json();}).then(function(d){msg.textContent=d.ok?"Sent to "+d.count+" pending moment(s).":d.message;}).catch(function(){msg.textContent="Error - check Render logs.";});}function approve(id){act(id,"/approve");}function reject(id){act(id,"/reject");}function act(id,action){var btns=document.querySelectorAll("#card-"+id+" .btn");btns.forEach(function(b){b.disabled=true;});fetch("/api/admin/moments/"+id+action,{method:"PATCH",headers:{"x-admin-password":PW}}).then(function(r){return r.json();}).then(function(){load();}).catch(function(){btns.forEach(function(b){b.disabled=false;});});}</script></body></html>');
});

// ── Shopify order webhook — generate and email access code ──
app.post('/api/shopify/order', async function (req, res) {
  var secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) { console.error('[shopify] SHOPIFY_WEBHOOK_SECRET not set'); return res.status(500).send('Webhook secret not configured'); }

  var crypto = require('crypto');
  var hmac = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  var sig  = req.headers['x-shopify-hmac-sha256'] || '';
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig))) return res.status(401).send('Invalid signature');

  var order = req.body; // already parsed by express.json()

  var customerEmail = order.email;
  var customerName  = (order.customer && order.customer.first_name) || '';

  if (!customerEmail) {
    console.log('[shopify] Order', order.order_number, '— no customer email, skipping');
    return res.status(200).send('No email');
  }

  var code = null;
  for (var i = 0; i < 10; i++) {
    var candidate = generateCode();
    try { await db.query('INSERT INTO codes (code) VALUES (?)', [candidate]); code = candidate; break; }
    catch (e) {}
  }
  if (!code) {
    console.error('[shopify] Could not generate unique code for order', order.order_number);
    return res.status(500).send('Code generation failed');
  }

  if (resend) {
    var appUrl = (process.env.APP_URL || 'https://creationlab.studiosorelle.be').replace(/\/$/, '');
    var greeting = customerName ? 'Hoi ' + customerName + ',' : 'Hoi,';
    var emailHtml = '<style>body{margin:0;padding:0;background:#f4e9dd;font-size:15px;}*{box-sizing:border-box;}.wrapper{width:600px;max-width:100%;margin:0 auto;padding:3em 2.5em;font-family:"Noto Sans",Arial,sans-serif;font-weight:400;background:#f4e9dd;color:#2b1a17;}.shop-logo{height:80px;width:auto;display:block;}hr{height:2px;border:none;background:#6A1F2A;margin:0;}.body{padding:2em 0;line-height:1.7;}.body p{margin:0 0 1em;}.code-box{margin:1.5em 0;text-align:center;background:#fff;border:2px solid #6A1F2A;border-radius:6px;padding:1.2em 2em;}.code-label{font-size:0.78em;text-transform:uppercase;letter-spacing:0.08em;color:#6A1F2A;font-weight:bold;margin-bottom:0.5em;}.code-value{font-family:monospace;font-size:2.4em;font-weight:bold;letter-spacing:0.2em;color:#2b1a17;}.cta-link{color:#6A1F2A;font-weight:bold;}.note{font-size:0.88em;color:#5a3a33;line-height:1.6;}.footer{margin-top:2em;text-align:center;color:#2b1a17;line-height:1.6;}.footer p{margin:0 0 0.8em;}.footer-logo{height:56px;width:auto;display:block;margin:1.4em auto 0.6em;}.footer-tagline{font-family:Georgia,"Times New Roman",serif;font-style:italic;color:#6A1F2A;font-size:1.1em;}</style>' +
      '<div class="wrapper">' +
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:1.5em"><tr>' +
          '<td style="vertical-align:middle;padding-right:16px;width:1%"><img class="shop-logo" src="https://creationlab.studiosorelle.be/assets/logo.png" alt="Studio Sorelle"></td>' +
          '<td style="vertical-align:middle;"><span style="font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-size:1.7em;color:#6A1F2A;">Studio Sorelle</span></td>' +
        '</tr></table>' +
        '<hr>' +
        '<div class="body">' +
          '<p>' + greeting + '</p>' +
          '<p>Bedankt voor je bestelling! Je hebt nu toegang tot de Studio Sorelle Creation Lab.</p>' +
          '<p>De Studio Sorelle Creation Lab brengt jouw moment tot leven. Gebruik onze kleurengenerator om elke kleur te maken uit je verfkit, laat je inspireren, spark je avond met Studio Games (uitdagingen voor jouw specifieke box) en Sorelle Talks (gespreksstarters) en zet de sfeer met de perfecte playlists. Alles wat je nodig hebt om te creëren, verbinden en genieten.</p>' +
          '<p>Je persoonlijke toegangscode:</p>' +
          '<div class="code-box"><div class="code-label">Toegangscode</div><div class="code-value">' + code + '</div></div>' +
          '<p>Ga naar <a class="cta-link" href="' + appUrl + '">' + appUrl + '</a> en voer de code in om te starten.</p>' +
          '<p class="note">Je code is <strong>30 dagen geldig vanaf het moment dat je hem voor het eerst activeert</strong>. Iedereen aan tafel kan dezelfde code gebruiken.</p>' +
        '</div>' +
        '<hr>' +
        '<div class="footer">' +
          '<img class="footer-logo" src="https://creationlab.studiosorelle.be/assets/logo.png" alt="Studio Sorelle">' +
          '<p class="footer-tagline">create moments</p>' +
          '<p>Bedankt voor je aankoop!</p>' +
          '<p><strong>Studio Sorelle</strong><br>info@studiosorelle.be<br>studiosorelle.be</p>' +
        '</div>' +
      '</div>';
    try {
      await resend.emails.send({
        from: 'Studio Sorelle <info@studiosorelle.be>',
        to: customerEmail,
        subject: 'Je toegangscode voor de Studio Sorelle Creation Lab',
        html: emailHtml
      });
    } catch (err) {
      console.error('[shopify] Email failed for order', order.order_number, ':', err.message);
    }
  } else {
    console.warn('[shopify] Resend not configured — code', code, 'generated but not emailed');
  }

  console.log('[shopify] Code', code, 'generated for order', order.order_number, '→', customerEmail);
  res.status(200).send('OK');
});

// ── SPA fallback ──
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function () {
  console.log('alice listening on port ' + PORT);
});

// ── Moderation digest email ──
async function sendModerationDigest() {
  var result = await db.query('SELECT id FROM moments WHERE approved = 0 AND email_sent = 0');
  var pending = result.rows;
  if (!pending.length) return { sent: false, reason: 'no_pending' };
  if (!resend) return { sent: false, reason: 'no_resend_key' };
  var notifyEmail = process.env.NOTIFY_EMAIL || 'info@studiosorelle.be';
  var appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  var count = pending.length;
  var subject = count === 1
    ? "1 nieuwe foto wacht op goedkeuring — Studio Sorelle Creation Lab"
    : count + " nieuwe foto's wachten op goedkeuring — Studio Sorelle Creation Lab";
  var bodyHtml = '<p>Er ' + (count === 1 ? 'staat' : 'staan') + ' <strong>' + count + '</strong> nieuwe foto' + (count === 1 ? '' : "'s") + ' klaar voor goedkeuring.</p>' +
    '<p style="margin-top:12px"><a href="' + appUrl + '/admin/gallery">Bekijk en keur goed via de beheerpagina →</a></p>';
  await resend.emails.send({
    from: 'Studio Sorelle <noreply@studiosorelle.be>',
    to: notifyEmail,
    subject: subject,
    html: bodyHtml
  });
  for (var i = 0; i < pending.length; i++) {
    await db.query('UPDATE moments SET email_sent = 1 WHERE id = ?', [pending[i].id]);
  }
  return { sent: true, count: count };
}

// ── Admin: manually trigger digest ──
app.post('/api/admin/send-digest', adminAuth, async (req, res) => {
  try {
    var result = await sendModerationDigest();
    if (result.reason === 'no_pending') return res.json({ ok: false, message: 'No pending moments without email.' });
    if (result.reason === 'no_resend_key') return res.json({ ok: false, message: 'RESEND_API_KEY not configured.' });
    console.log('[admin] Manual digest sent for ' + result.count + ' moment(s)');
    res.json({ ok: true, count: result.count });
  } catch (err) {
    console.error('[admin] send-digest error:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ── Daily moderation email (07:00 server time) ──
cron.schedule('0 7 * * *', async function () {
  try {
    var r = await sendModerationDigest();
    if (r.sent) console.log('[cron] Sent moderation email for ' + r.count + ' pending moment(s)');
    else console.log('[cron] Digest skipped: ' + r.reason);
  } catch (err) {
    console.error('[cron] Notification email error:', err.message);
  }
});
