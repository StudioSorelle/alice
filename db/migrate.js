const db = require('./index');

var ACTIVITIES_SEED = [
  // Studio Games — any occasion
  { type: 'studio_games', occasion: 'any', duration: '5min',
    en: 'Canvas rotation! Pass your canvas to the left. Keep painting — but now on your neighbour\'s canvas.',
    nl: 'Canvas rotatie! Geef je canvas door naar links. Blijf schilderen — maar nu op het canvas van je buur.' },
  { type: 'studio_games', occasion: 'any', duration: '5min',
    en: 'Mix a surprise colour palette for the person on your right using only the kit paints. They must use only those colours for 5 minutes.',
    nl: 'Mix een verrassingspalet voor de persoon rechts van je met enkel de kitverf. Die moet die kleuren 5 minuten lang gebruiken.' },
  { type: 'studio_games', occasion: 'any', duration: '5min',
    en: 'Switch to your non-dominant hand and paint for 5 minutes. No switching back!',
    nl: 'Schilder 5 minuten met je niet-dominante hand. Niet terugswitchen!' },
  { type: 'studio_games', occasion: 'any', duration: 'round',
    en: 'In complete silence, each person adds exactly one brushstroke to every other person\'s canvas.',
    nl: 'In stilte voegt iedereen precies één penseelstreek toe aan alle andere canvassen.' },
  { type: 'studio_games', occasion: 'any', duration: '3min',
    en: 'Speed round! You have exactly 3 minutes to cover as much of your canvas as possible. Go!',
    nl: 'Snelheidsronde! Je hebt precies 3 minuten om zo veel mogelijk van je canvas te bedekken. Ga!' },
  { type: 'studio_games', occasion: 'any', duration: 'round',
    en: 'Close your eyes and paint one shape or line. Open them — and work that happy accident into your painting.',
    nl: 'Sluit je ogen en schilder één vorm of lijn. Open ze — en werk dat toeval in je schilderij.' },
  // Sorelle Talks — any occasion
  { type: 'sorelle_talks', occasion: 'any', duration: '10min',
    en: 'What\'s the most spontaneous thing you\'ve ever done? Everyone shares one story.',
    nl: 'Wat is het meest spontane dat je ooit hebt gedaan? Iedereen vertelt een verhaal.' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round',
    en: 'Dilemma: Would you rather paint the same subject every day for a year, or never paint the same thing twice for the rest of your life?',
    nl: 'Dilemma: Zou je liever een jaar lang elke dag hetzelfde schilderen, of nooit meer twee keer hetzelfde in je hele leven?' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round',
    en: 'Put on your favourite song right now. Paint whatever the music makes you feel — no thinking, just feeling.',
    nl: 'Zet nu je favoriete liedje op. Schilder wat de muziek je doet voelen — niet nadenken, gewoon voelen.' },
  { type: 'sorelle_talks', occasion: 'any', duration: '10min',
    en: 'What\'s one thing you\'ve always wanted to learn but never started? Share and let the group encourage you.',
    nl: 'Wat is iets dat je altijd wilde leren maar nooit begon? Deel het en laat de groep je aanmoedigen.' },
  { type: 'sorelle_talks', occasion: 'any', duration: '10min',
    en: 'What\'s the best piece of advice you\'ve ever received? Share it with the group.',
    nl: 'Wat is het beste advies dat je ooit gekregen hebt? Deel het met de groep.' },
  // Date night
  { type: 'sorelle_talks', occasion: 'Date night', duration: '10min',
    en: 'Tell your partner one thing about them that still surprises you — even after all this time.',
    nl: 'Vertel je partner één ding aan hem/haar dat je nog steeds verrast — zelfs na al die tijd.' },
  { type: 'sorelle_talks', occasion: 'Date night', duration: 'round',
    en: 'Dilemma: Would you rather have a partner who is an amazing cook but leaves the kitchen a total mess, or a spotless cleaner who can\'t boil water?',
    nl: 'Dilemma: Zou je liever een partner hebben die geweldig kan koken maar de keuken een ramp achterlaat, of een perfecte opruimer die niet kan koken?' },
  { type: 'sorelle_talks', occasion: 'Date night', duration: '10min',
    en: 'What\'s your favourite memory of doing something creative together? Recreate that feeling on your canvas right now.',
    nl: 'Wat is je favoriete herinnering aan iets creatiefs dat jullie samen deden? Recreëer dat gevoel nu op je canvas.' },
  // Girls' night
  { type: 'sorelle_talks', occasion: "Girls' night", duration: '10min',
    en: 'What\'s the funniest or most embarrassing thing that happened to you this year? Go — no holding back.',
    nl: 'Wat is het grappigste of gênantste dat je dit jaar overkwam? Vertel — niets achterhouden.' },
  { type: 'sorelle_talks', occasion: "Girls' night", duration: 'round',
    en: 'Dilemma: Would you rather know everything about your friends\' lives, or keep a little mystery?',
    nl: 'Dilemma: Zou je liever alles weten over het leven van je vriendinnen, of liever een beetje mysterie bewaren?' },
  // Boys' night
  { type: 'studio_games', occasion: "Boys' night", duration: 'round',
    en: 'Secret challenge: Without saying a word, try to sneak the worst possible colour combination onto your canvas. The group votes on who nailed it.',
    nl: 'Geheime uitdaging: Probeer zonder iets te zeggen de slechtst mogelijke kleurencombinatie op je canvas te schilderen. De groep stemt wie het het beste deed.' },
  { type: 'sorelle_talks', occasion: "Boys' night", duration: 'round',
    en: 'Dilemma: Would you rather have a superpower that only works when no one is watching, or a regular skill that makes everyone stop and stare?',
    nl: 'Dilemma: Zou je liever een superkracht hebben die alleen werkt als niemand kijkt, of een gewone vaardigheid waarmee iedereen stopt en staart?' },
  // Birthday party
  { type: 'sorelle_talks', occasion: 'Birthday party', duration: '10min',
    en: 'Raise your brush if you\'ve known the birthday person for more than 5 years. Now share your favourite memory with them out loud.',
    nl: 'Steek je penseel op als je de jarige al meer dan 5 jaar kent. Deel nu je favoriete herinnering luidop met hen.' },
  { type: 'sorelle_talks', occasion: 'Birthday party', duration: '10min',
    en: 'Everyone share one word that best describes the birthday person. Then explain why you chose that word.',
    nl: 'Iedereen zegt één woord dat de jarige het beste omschrijft. Leg dan uit waarom je dat woord koos.' },
  // Bachelorette party
  { type: 'sorelle_talks', occasion: 'Bachelorette party', duration: '10min',
    en: 'Share your funniest or most embarrassing memory of the bride-to-be. The more stories, the better.',
    nl: 'Deel je grappigste of gênantste herinnering aan de bruid-in-spe. Hoe meer verhalen, hoe beter.' },
  { type: 'studio_games', occasion: 'Bachelorette party', duration: 'round',
    en: 'Everyone secretly paints one wish for the couple on their canvas. Reveal and explain at the end.',
    nl: 'Iedereen schildert in het geheim één wens voor het koppel op hun canvas. Onthul en verklaar aan het einde.' },
  // Baby shower
  { type: 'sorelle_talks', occasion: 'Baby shower', duration: '10min',
    en: 'Share one piece of advice for the parents-to-be — serious or silly, both are welcome.',
    nl: 'Deel één advies voor de aanstaande ouders — serieus of grappig, beide zijn welkom.' },
  { type: 'studio_games', occasion: 'Baby shower', duration: 'round',
    en: 'Paint something that represents a wish for the new baby. It can be abstract — anything goes.',
    nl: 'Schilder iets dat een wens voor de nieuwe baby vertegenwoordigt. Het mag abstract zijn — alles is goed.' },
  // Family gathering
  { type: 'sorelle_talks', occasion: 'Family gathering', duration: '10min',
    en: 'What\'s one family tradition you hope never disappears? Share the story behind it.',
    nl: 'Welke familietraditie hoop je dat nooit verdwijnt? Vertel het verhaal erachter.' },
  { type: 'sorelle_talks', occasion: 'Family gathering', duration: 'round',
    en: 'Dilemma: Would you rather all live in the same city as your family, or be spread out across the world?',
    nl: 'Dilemma: Zou je liever allemaal in dezelfde stad wonen als je familie, of verspreid over de wereld?' }
];

var PRODUCTS_SEED = [
  'Our Signature Canvas Moment',
  'Our Mini Signature Canvas Moment',
  'Our Faithful Tote Moment'
];

var OCCASIONS_SEED = [
  "Date night", "Girls' night", 'Baby shower',
  'Bachelorette party', 'Family gathering', 'Birthday party'
];

async function migrate() {
  if (!db.isConfigured()) {
    console.log('DB not configured — skipping migration');
    return;
  }
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS occasions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      first_used_at TEXT,
      expires_at TEXT
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS moments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      occasion TEXT,
      description TEXT,
      name TEXT,
      image_url TEXT NOT NULL,
      social_consent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      occasion TEXT NOT NULL DEFAULT 'any',
      description_nl TEXT NOT NULL,
      description_en TEXT NOT NULL,
      duration TEXT DEFAULT 'round'
    )`);
    try {
      await db.query('ALTER TABLE moments ADD COLUMN social_consent INTEGER DEFAULT 0');
    } catch (e) { /* column already exists */ }

    var prodCount = await db.query('SELECT COUNT(*) as c FROM products');
    if (Number(prodCount.rows[0].c) === 0) {
      for (var i = 0; i < PRODUCTS_SEED.length; i++) {
        await db.query('INSERT INTO products (name, sort_order) VALUES (?, ?)', [PRODUCTS_SEED[i], i]);
      }
    }

    var occCount = await db.query('SELECT COUNT(*) as c FROM occasions');
    if (Number(occCount.rows[0].c) === 0) {
      for (var j = 0; j < OCCASIONS_SEED.length; j++) {
        await db.query('INSERT INTO occasions (name, sort_order) VALUES (?, ?)', [OCCASIONS_SEED[j], j]);
      }
    }

    // Add Boys' night if not present (wasn't in original seed)
    var boysNight = await db.query("SELECT COUNT(*) as c FROM occasions WHERE name = ?", ["Boys' night"]);
    if (Number(boysNight.rows[0].c) === 0) {
      await db.query("INSERT INTO occasions (name, sort_order) VALUES (?, ?)", ["Boys' night", 7]);
    }

    // Seed activities
    var actCount = await db.query('SELECT COUNT(*) as c FROM activities');
    if (Number(actCount.rows[0].c) === 0) {
      for (var k = 0; k < ACTIVITIES_SEED.length; k++) {
        var act = ACTIVITIES_SEED[k];
        await db.query(
          'INSERT INTO activities (type, occasion, description_nl, description_en, duration) VALUES (?, ?, ?, ?, ?)',
          [act.type, act.occasion, act.nl, act.en, act.duration || 'round']
        );
      }
    }

    console.log('DB migration complete');
  } catch (err) {
    console.error('DB migration error:', err.message);
  }
}

module.exports = migrate;
