require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

// ── Seasonal context ──
function getSeasonalContext() {
  var now = new Date();
  var month = now.getMonth() + 1;
  var day = now.getDate();

  var holidays = [
    { month: 2,  day: 14, en: "Valentine's Day is coming up — consider romantic or heartfelt themes.",    nl: 'Valentijnsdag komt eraan — overweeg romantische of hartelijke thema\'s.' },
    { month: 4,  day: 20, en: 'Easter is approaching — consider spring renewal, pastel colours, and new beginnings.', nl: 'Pasen nadert — overweeg lentehernieuwing, pastelkleuren en nieuwe beginnen.' },
    { month: 10, day: 31, en: 'Halloween is just around the corner — consider spooky, mysterious, or festive autumn themes.', nl: 'Halloween is vlakbij — overweeg spookachtige, mysterieuze of herfstfeestthema\'s.' },
    { month: 12, day: 25, en: 'Christmas is approaching — consider cosy, wintery, or festive themes.',   nl: 'Kerstmis nadert — overweeg gezellige, winterse of feestelijke thema\'s.' },
  ];

  for (var h = 0; h < holidays.length; h++) {
    var hol = holidays[h];
    var holDate = new Date(now.getFullYear(), hol.month - 1, hol.day);
    var diff = (holDate - now) / (1000 * 60 * 60 * 24);
    if (diff >= 0 && diff <= 10) return { en: hol.en, nl: hol.nl };
  }

  if (month >= 3 && month <= 5) return { en: 'It is spring — consider fresh colours, blossoms, and new energy.', nl: 'Het is lente — overweeg frisse kleuren, bloesem en nieuwe energie.' };
  if (month >= 6 && month <= 8) return { en: 'It is summer — consider warm light, vibrant colours, and outdoor scenes.', nl: 'Het is zomer — overweeg warm licht, levendige kleuren en buitenscènes.' };
  if (month >= 9 && month <= 10) return { en: 'It is autumn — consider earthy tones, falling leaves, and warm amber light.', nl: 'Het is herfst — overweeg aardse tinten, vallende bladeren en warm amberkleurig licht.' };
  if (month >= 11) return { en: 'The festive season is here — consider warm, cosy, or sparkling winter themes.', nl: 'Het feestseizoen is aangebroken — overweeg warme, gezellige of fonkelende winterthema\'s.' };
  return { en: 'It is winter — consider stark, quiet, or magical winter scenes.', nl: 'Het is winter — overweeg stille, kale of magische winterscènes.' };
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
  'Abstract':           'abstract expressionist canvas, fluid shapes and colour fields',
  'Simplistic':         'minimalist canvas, clean simple forms, flat colour areas',
  'Detailed':           'highly detailed oil painting, intricate fine brushwork',
  'Playful':            'playful whimsical painting, bright warm palette, joyful energy',
  'Geometric':          'geometric painting, angular structured forms, bold outlines',
  'Bold & Expressive':  'bold expressive impasto painting, thick visible brushstrokes',
  'Girly / Pastel':     'soft pastel painting, blush pinks, lavenders, and mints, gentle dreamy aesthetic',
  'Tumblr / Aesthetic': 'moody aesthetic painting, vintage tones, soft grunge, muted palette with one accent colour'
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

// ── Inspire: template-based idea builder (no AI) ──
var STYLE_ADJECTIVES = {
  en: {
    'Abstract': 'abstract', 'Simplistic': 'simple and clean',
    'Detailed': 'richly detailed', 'Playful': 'playful',
    'Geometric': 'geometric', 'Bold & Expressive': 'bold and expressive',
    'Girly / Pastel': 'soft pastel', 'Tumblr / Aesthetic': 'moody aesthetic'
  },
  nl: {
    'Abstract': 'abstract', 'Simplistic': 'eenvoudig en helder',
    'Detailed': 'rijk gedetailleerd', 'Playful': 'speels',
    'Geometric': 'geometrisch', 'Bold & Expressive': 'gedurfd en expressief',
    'Girly / Pastel': 'zacht pastel', 'Tumblr / Aesthetic': 'moodige esthetiek'
  }
};

var SUBJECT_TEMPLATES = {
  en: {
    'Nature': {
      theme: 'A {style} landscape',
      canvases: [
        'Top-left: a broad sky — clouds, light, and the mood of the day.',
        'Top-right: rolling hills or treetops fading softly to the horizon.',
        'Bottom-left: lush foreground — branches, roots, grass, or wildflowers.',
        'Bottom-right: a close detail — a single leaf, stone, or drop of water.'
      ],
      connection: 'Together the four panels form one sweeping outdoor scene, from open sky down to rich earth.'
    },
    'Animals': {
      theme: 'A {style} animal portrait',
      canvases: [
        'Top-left: the animal\'s face — expressive, close, and full of character.',
        'Top-right: its body — fur, feathers, or scales caught in the light.',
        'Bottom-left: its paws or feet — grounded, in motion, or at rest.',
        'Bottom-right: a glimpse of its natural habitat — the world it belongs to.'
      ],
      connection: 'Step back and the full creature emerges, alive in its own world.'
    },
    'Food & Drink': {
      theme: 'A {style} still life of food and drink',
      canvases: [
        'Top-left: a generous spread — fruits, bread, or ingredients in abundance.',
        'Top-right: something to drink — a glass, a cup, steam rising, or foam settling.',
        'Bottom-left: a close-up of texture — crumbs, drips, a cut surface, or a peel.',
        'Bottom-right: the quiet aftermath — an empty plate or the very last sip.'
      ],
      connection: 'Together the four panels tell a small story, from first sight to the satisfied last bite.'
    },
    'Party': {
      theme: 'A {style} celebration',
      canvases: [
        'Top-left: colour and movement — balloons, streamers, or confetti mid-air.',
        'Top-right: faces and raised glasses — the people who make the moment.',
        'Bottom-left: a table full of light and food, glowing with the occasion.',
        'Bottom-right: a quiet detail — a gift, a handwritten note, or a single lit candle.'
      ],
      connection: 'Together the panels capture everything that makes a celebration worth remembering — the noise and the stillness.'
    },
    'City': {
      theme: 'A {style} urban scene',
      canvases: [
        'Top-left: a skyline — silhouettes against a dusk or dawn sky.',
        'Top-right: a busy street — movement, colour, and the hum of life.',
        'Bottom-left: a storefront or doorway — an invitation or a glimpse inside.',
        'Bottom-right: a quiet corner — an alley, a bench, or a plant growing through the pavement.'
      ],
      connection: 'The four panels form one city, from the grand view down to the small details that give it soul.'
    },
    'Fantasy': {
      theme: 'A {style} fantasy world',
      canvases: [
        'Top-left: a dramatic sky — twin moons, aurora, or light from an unknown source.',
        'Top-right: a creature or figure in motion — mythical, strange, and alive.',
        'Bottom-left: an enchanted landscape — ancient forest, floating ruins, or glowing water.',
        'Bottom-right: a magical object or portal — the detail that holds the whole world together.'
      ],
      connection: 'The four panels reveal a world beyond the ordinary — strange and beautiful, from sky to secret.'
    },
    'People': {
      theme: 'A {style} portrait of people together',
      canvases: [
        'Top-left: a face — close, warm, and full of expression.',
        'Top-right: hands — reaching, holding, creating, or simply resting.',
        'Bottom-left: a shared moment — laughter mid-breath or quiet focus.',
        'Bottom-right: the space between people — a shared object, a table, or something that belongs to everyone.'
      ],
      connection: 'Together the panels form a portrait of connection — the people and the world they make together.'
    },
    'default': {
      theme: 'A {style} composition',
      canvases: [
        'Top-left: the big picture — your subject, the mood, the setting.',
        'Top-right: a key element — the heart of what you want to paint.',
        'Bottom-left: texture and detail — move in close and look deeper.',
        'Bottom-right: a quiet counterpoint — a contrast, a pause, or a small surprise.'
      ],
      connection: 'The four panels work together as one — each unique, each part of something larger.'
    }
  },
  nl: {
    'Nature': {
      theme: 'Een {style} landschapsscène',
      canvases: [
        'Linksboven: een uitgestrekte lucht — wolken, licht en de sfeer van de dag.',
        'Rechtsboven: glooiende heuvels of boomtoppen die zacht vervagen naar de horizon.',
        'Linksonder: weelderig voorplan — takken, wortels, gras of wilde bloemen.',
        'Rechtsonder: een close-up detail — één blad, steen of waterdruppel.'
      ],
      connection: 'Samen vormen de vier panelen één weids buitenlandschap, van de open lucht bovenaan tot de rijke aarde onderaan.'
    },
    'Animals': {
      theme: 'Een {style} dierenportret',
      canvases: [
        'Linksboven: het gezicht van het dier — expressief, dichtbij, vol karakter.',
        'Rechtsboven: zijn lichaam — vacht, veren of schubben in het licht gevangen.',
        'Linksonder: zijn poten of klauwen — gegrond, in beweging of in rust.',
        'Rechtsonder: een glimp van zijn habitat — de wereld waartoe het behoort.'
      ],
      connection: 'Stap achteruit en het volledige dier verschijnt, levend in zijn eigen wereld.'
    },
    'Food & Drink': {
      theme: 'Een {style} stilleven van eten en drinken',
      canvases: [
        'Linksboven: een overvloedige tafel — fruit, brood of ingrediënten in overvloed.',
        'Rechtsboven: iets om van te drinken — een glas, een kopje, stoom of schuim.',
        'Linksonder: een close-up van textuur — kruimels, druppels, een gesneden oppervlak.',
        'Rechtsonder: de stille nasleep — een leeg bord of de laatste slok.'
      ],
      connection: 'Samen vertellen de vier panelen een klein verhaal van eerste blik tot tevreden laatste hap.'
    },
    'Party': {
      theme: 'Een {style} feestscène',
      canvases: [
        'Linksboven: kleur en beweging — ballonnen, slingers of confetti in de lucht.',
        'Rechtsboven: gezichten en geheven glazen — de mensen die het moment maken.',
        'Linksonder: een tafel vol licht en eten, stralend van de gelegenheid.',
        'Rechtsonder: een stil detail — een cadeau, een handgeschreven kaartje of één brandende kaars.'
      ],
      connection: 'Samen vangen de panelen alles wat een feest de moeite waard maakt — het lawaai én de stilte.'
    },
    'City': {
      theme: 'Een {style} stadsscène',
      canvases: [
        'Linksboven: een skyline — silhouetten tegen een avond- of ochtendlucht.',
        'Rechtsboven: een drukke straat — beweging, kleur en het ruisen van het leven.',
        'Linksonder: een etalage of deuropening — een uitnodiging of een glimp naar binnen.',
        'Rechtsonder: een rustig hoekje — een steeg, een bankje of een plant door het plaveisel.'
      ],
      connection: 'De vier panelen vormen samen één stad, van het grote overzicht tot de kleine details die haar ziel geven.'
    },
    'Fantasy': {
      theme: 'Een {style} fantasiewereld',
      canvases: [
        'Linksboven: een dramatische lucht — twee manen, aurora of licht van een onbekende bron.',
        'Rechtsboven: een wezen of figuur in beweging — mythisch, vreemd en levend.',
        'Linksonder: een betoverd landschap — oud woud, zwevende ruïnes of gloeiend water.',
        'Rechtsonder: een magisch voorwerp of portaal — het detail dat alles bij elkaar houdt.'
      ],
      connection: 'De vier panelen onthullen een wereld voorbij het gewone — vreemd en mooi, van lucht tot geheim.'
    },
    'People': {
      theme: 'Een {style} portret van mensen samen',
      canvases: [
        'Linksboven: een gezicht — dichtbij, warm en vol uitdrukking.',
        'Rechtsboven: handen — reikend, vasthoudend, creërend of rustend.',
        'Linksonder: een gedeeld moment — lach gevangen in de vlucht of stille focus.',
        'Rechtsonder: de ruimte ertussen — een gedeeld voorwerp, een tafel of iets van iedereen.'
      ],
      connection: 'Samen vormen de panelen een portret van verbinding — de mensen en de wereld die ze samen maken.'
    },
    'default': {
      theme: 'Een {style} compositie',
      canvases: [
        'Linksboven: het grote geheel — je onderwerp, de sfeer, de setting.',
        'Rechtsboven: een sleutelelement — het hart van wat je wilt schilderen.',
        'Linksonder: textuur en detail — kom dichterbij en kijk dieper.',
        'Rechtsonder: een rustig tegenwicht — contrast, kalmte of een kleine verrassing.'
      ],
      connection: 'De vier panelen werken samen als één geheel — elk uniek, elk deel van iets groters.'
    }
  }
};

var TIME_HINTS = {
  en: {
    '30 minutes': {
      'Relaxed':  'Keep it loose — colour and energy matter more than precision. A few confident marks go a long way.',
      'Balanced': 'Work quickly but intentionally. Pick one thing per canvas to finish properly.',
      'Ambitious': 'Bold strokes, strong contrast. Commit to each mark and keep moving.'
    },
    '1 hour': {
      'Relaxed':  'Let the painting breathe — not every area needs to be filled. Enjoy the process.',
      'Balanced': 'Lay in the big shapes first, then add detail where it matters most.',
      'Ambitious': 'Work in layers — build up gradually and don\'t be afraid to push further.'
    },
    '2+ hours': {
      'Relaxed':  'Take your time. A slow, meditative session — let each panel develop at its own pace.',
      'Balanced': 'Plenty of time to explore. Try a colour or technique you haven\'t used before.',
      'Ambitious': 'Go for it — refine edges, build texture, and don\'t hesitate to paint over and start again.'
    }
  },
  nl: {
    '30 minutes': {
      'Relaxed':  'Hou het los — kleur en energie tellen meer dan precisie. Enkele zekere streken doen wonderen.',
      'Balanced': 'Werk snel maar doelgericht. Kies per paneel één ding dat je goed afwerkt.',
      'Ambitious': 'Krachtige streken, sterk contrast. Zet je in voor elke streek en blijf bewegen.'
    },
    '1 hour': {
      'Relaxed':  'Laat het schilderij ademen — niet elk deel hoeft gevuld te zijn. Geniet van het proces.',
      'Balanced': 'Begin met de grote vormen en voeg dan detail toe waar het het meeste telt.',
      'Ambitious': 'Werk in lagen — bouw geleidelijk op en wees niet bang om verder te gaan.'
    },
    '2+ hours': {
      'Relaxed':  'Neem je tijd. Een trage, meditatieve sessie — laat elk paneel op zijn eigen tempo groeien.',
      'Balanced': 'Genoeg tijd om te verkennen. Probeer een kleur of techniek die je nog niet eerder hebt gebruikt.',
      'Ambitious': 'Ga er volledig voor — verfijn randen, bouw textuur op en aarzel niet om over te schilderen.'
    }
  }
};

function buildInspireIdea(answers, lang) {
  var l = lang === 'nl' ? 'nl' : 'en';
  // answers[0]=group, answers[1]=product, answers[2]=style, answers[3]=subject,
  // answers[4]=time, answers[5]=ambition
  var style = answers[2] ? answers[2].answer : '';
  var subject = answers[3] ? answers[3].answer : 'Nature';
  var time = answers[4] ? answers[4].answer : '1 hour';
  var ambition = answers[5] ? answers[5].answer : 'Balanced';

  var adj = (STYLE_ADJECTIVES[l] && STYLE_ADJECTIVES[l][style]) || style.toLowerCase() || 'beautiful';
  var templates = SUBJECT_TEMPLATES[l] || SUBJECT_TEMPLATES['en'];
  var tpl = templates[subject] || templates['default'];

  var theme = tpl.theme.replace('{style}', adj);
  var canvasLines = tpl.canvases.join('\n');

  var timeHints = (TIME_HINTS[l] && TIME_HINTS[l][time]) || TIME_HINTS['en']['1 hour'];
  var hint = timeHints[ambition] || timeHints['Balanced'];

  var seasonal = getSeasonalContext();
  var seasonalNote = seasonal ? seasonal[l] : '';

  return theme + '\n\n' + canvasLines + '\n\n' + tpl.connection + '\n\n' + hint + (seasonalNote ? '\n\n' + seasonalNote : '');
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
