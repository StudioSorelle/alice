const db = require('./index');

// Original sorelle_talks activities (kept — no PDF replacement provided for these)
var SORELLE_TALKS_SEED = [
  { type: 'sorelle_talks', occasion: 'any', duration: 'round', min_players: 2,
    en: 'What\'s the most spontaneous thing you\'ve ever done? Everyone shares one story.',
    nl: 'Wat is het meest spontane dat je ooit hebt gedaan? Iedereen vertelt een verhaal.' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round', min_players: 2,
    en: 'Dilemma: Would you rather paint the same subject every day for a year, or never paint the same thing twice for the rest of your life?',
    nl: 'Dilemma: Zou je liever een jaar lang elke dag hetzelfde schilderen, of nooit meer twee keer hetzelfde in je hele leven?' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round', min_players: 2,
    en: 'Put on your favourite song right now. Paint whatever the music makes you feel — no thinking, just feeling.',
    nl: 'Zet nu je favoriete liedje op. Schilder wat de muziek je doet voelen — niet nadenken, gewoon voelen.' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round', min_players: 2,
    en: 'What\'s one thing you\'ve always wanted to learn but never started? Share and let the group encourage you.',
    nl: 'Wat is iets dat je altijd wilde leren maar nooit begon? Deel het en laat de groep je aanmoedigen.' },
  { type: 'sorelle_talks', occasion: 'any', duration: 'round', min_players: 2,
    en: 'What\'s the best piece of advice you\'ve ever received? Share it with the group.',
    nl: 'Wat is het beste advies dat je ooit gekregen hebt? Deel het met de groep.' },
  { type: 'sorelle_talks', occasion: 'Date night', duration: 'round', min_players: 2,
    en: 'Tell your partner one thing about them that still surprises you — even after all this time.',
    nl: 'Vertel je partner één ding aan hem/haar dat je nog steeds verrast — zelfs na al die tijd.' },
  { type: 'sorelle_talks', occasion: 'Date night', duration: 'round', min_players: 2,
    en: 'Dilemma: Would you rather have a partner who is an amazing cook but leaves the kitchen a total mess, or a spotless cleaner who can\'t boil water?',
    nl: 'Dilemma: Zou je liever een partner hebben die geweldig kan koken maar de keuken een ramp achterlaat, of een perfecte opruimer die niet kan koken?' },
  { type: 'sorelle_talks', occasion: 'Date night', duration: 'round', min_players: 2,
    en: 'What\'s your favourite memory of doing something creative together? Recreate that feeling on your canvas right now.',
    nl: 'Wat is je favoriete herinnering aan iets creatiefs dat jullie samen deden? Recreëer dat gevoel nu op je canvas.' },
  { type: 'sorelle_talks', occasion: "Girls' night", duration: 'round', min_players: 2,
    en: 'What\'s the funniest or most embarrassing thing that happened to you this year? Go — no holding back.',
    nl: 'Wat is het grappigste of gênantste dat je dit jaar overkwam? Vertel — niets achterhouden.' },
  { type: 'sorelle_talks', occasion: "Girls' night", duration: 'round', min_players: 2,
    en: 'Dilemma: Would you rather know everything about your friends\' lives, or keep a little mystery?',
    nl: 'Dilemma: Zou je liever alles weten over het leven van je vriendinnen, of liever een beetje mysterie bewaren?' },
  { type: 'studio_games', occasion: "Boys' night", duration: 'round', min_players: 2,
    en: 'Secret challenge: Without saying a word, try to sneak the worst possible colour combination onto your canvas. The group votes on who nailed it.',
    nl: 'Geheime uitdaging: Probeer zonder iets te zeggen de slechtst mogelijke kleurencombinatie op je canvas te schilderen. De groep stemt wie het het beste deed.' },
  { type: 'sorelle_talks', occasion: "Boys' night", duration: 'round', min_players: 2,
    en: 'Dilemma: Would you rather have a superpower that only works when no one is watching, or a regular skill that makes everyone stop and stare?',
    nl: 'Dilemma: Zou je liever een superkracht hebben die alleen werkt als niemand kijkt, of een gewone vaardigheid waarmee iedereen stopt en staart?' },
  { type: 'sorelle_talks', occasion: 'Birthday party', duration: 'round', min_players: 2,
    en: 'Raise your brush if you\'ve known the birthday person for more than 5 years. Now share your favourite memory with them out loud.',
    nl: 'Steek je penseel op als je de jarige al meer dan 5 jaar kent. Deel nu je favoriete herinnering luidop met hen.' },
  { type: 'sorelle_talks', occasion: 'Birthday party', duration: 'round', min_players: 2,
    en: 'Everyone share one word that best describes the birthday person. Then explain why you chose that word.',
    nl: 'Iedereen zegt één woord dat de jarige het beste omschrijft. Leg dan uit waarom je dat woord koos.' },
  { type: 'sorelle_talks', occasion: 'Bachelorette party', duration: 'round', min_players: 2,
    en: 'Share your funniest or most embarrassing memory of the bride-to-be. The more stories, the better.',
    nl: 'Deel je grappigste of gênantste herinnering aan de bruid-in-spe. Hoe meer verhalen, hoe beter.' },
  { type: 'studio_games', occasion: 'Bachelorette party', duration: 'round', min_players: 2,
    en: 'Everyone secretly paints one wish for the couple on their canvas. Reveal and explain at the end.',
    nl: 'Iedereen schildert in het geheim één wens voor het koppel op hun canvas. Onthul en verklaar aan het einde.' },
  { type: 'sorelle_talks', occasion: 'Baby shower', duration: 'round', min_players: 2,
    en: 'Share one piece of advice for the parents-to-be — serious or silly, both are welcome.',
    nl: 'Deel één advies voor de aanstaande ouders — serieus of grappig, beide zijn welkom.' },
  { type: 'studio_games', occasion: 'Baby shower', duration: 'round', min_players: 2,
    en: 'Paint something that represents a wish for the new baby. It can be abstract — anything goes.',
    nl: 'Schilder iets dat een wens voor de nieuwe baby vertegenwoordigt. Het mag abstract zijn — alles is goed.' },
  { type: 'sorelle_talks', occasion: 'Family gathering', duration: 'round', min_players: 2,
    en: 'What\'s one family tradition you hope never disappears? Share the story behind it.',
    nl: 'Welke familietraditie hoop je dat nooit verdwijnt? Vertel het verhaal erachter.' },
  { type: 'sorelle_talks', occasion: 'Family gathering', duration: 'round', min_players: 2,
    en: 'Dilemma: Would you rather all live in the same city as your family, or be spread out across the world?',
    nl: 'Dilemma: Zou je liever allemaal in dezelfde stad wonen als je familie, of verspreid over de wereld?' },
  { type: 'sorelle_talks', occasion: 'Mother-daughter date', duration: 'round', min_players: 2,
    en: 'What\'s one thing you learned from each other that you\'ll carry with you forever?',
    nl: 'Wat is één ding dat je van elkaar hebt geleerd dat je voor altijd bijblijft?' },
  { type: 'sorelle_talks', occasion: 'Mother-daughter date', duration: 'round', min_players: 2,
    en: 'Describe each other\'s painting style in three words — then explain your choice.',
    nl: 'Beschrijf elkaars schilderstijl in drie woorden — en leg dan je keuze uit.' }
];

// PDF studio games — exact Dutch wording from "Prompts find your moment.pdf"
var PDF_STUDIO_GAMES = [
  // Works for couples (min_players=2) — solo-compatible challenges
  { type: 'studio_games', occasion: 'any', duration: 'long', min_players: 2,
    nl: 'Elke 15 minuten kiest iemand een willekeurig woord en verwerk dit in je schilderij. Je eerste woord kan bijvoorbeeld "oceaan", "muziek" of "herinnering" zijn. Laat je volledig gaan. Nadat jullie kunstwerken zijn afgewerkt, kan je uitleggen hoe je dit hebt verwerkt.',
    en: 'Every 15 minutes someone picks a random word — incorporate it into your painting. Your first word could be "ocean", "music" or "memory". Let yourself go completely. Once your artworks are finished, explain how you worked it in.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Maak één grote fout en verwerk die creatief.',
    en: 'Make one big mistake on purpose — then turn it into something creative.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Geef je schilderij een titel voordat het af is.',
    en: 'Give your painting a title before it is finished.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder op het ritme van de muziek.',
    en: 'Paint to the rhythm of the music.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Wissel van plaats maar neem je schilderij niet mee.',
    en: 'Switch seats — but leave your painting behind.' },
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 2,
    nl: 'Schilder 5 minuten met je penseel achterstevoren.',
    en: 'Paint for 5 minutes holding your brush the wrong way around.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Voeg een onverwachte kleur toe.',
    en: 'Add one unexpected colour.' },
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 2,
    nl: 'Schilder 5 minuten zonder te praten.',
    en: 'Paint for 5 minutes without speaking.' },
  { type: 'studio_games', occasion: 'any', duration: '1min', min_players: 2,
    nl: 'Jij mag één minuut aan het schilderij van iemand anders werken. De oudste kiest wanneer.',
    en: 'You get to work on someone else\'s painting for one minute. The oldest person decides when.' },
  { type: 'studio_games', occasion: 'any', duration: '3min', min_players: 2,
    nl: 'Schilder 3 minuten met je vingers.',
    en: 'Paint for 3 minutes using only your fingers.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder zonder je penseel op te tillen (zoveel mogelijk).',
    en: 'Paint without lifting your brush from the canvas (as much as possible).' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder een deel met gesloten ogen.',
    en: 'Paint one section with your eyes closed.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Voeg een verborgen detail toe.',
    en: 'Hide a secret detail somewhere in your painting.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder zonder zwart.',
    en: 'Paint without using any black.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder zonder wit.',
    en: 'Paint without using any white.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Gebruik alleen primaire kleuren.',
    en: 'Use only primary colours.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder alleen met stippen.',
    en: 'Paint using only dots.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder alleen met lijnen.',
    en: 'Paint using only lines.' },
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 2,
    nl: 'Schilder 5 minuten met je niet-dominante hand. De jongste beslist wanneer.',
    en: 'Paint for 5 minutes with your non-dominant hand. The youngest person decides when.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Trek 3 willekeurige kleuren en gebruik alleen die.',
    en: 'Pick 3 random colours and use only those for the rest of the session.' },
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 2,
    nl: 'Houd je penseel helemaal achteraan vast gedurende 5 minuten. Degene die het dichtst bij 14 mei is geboren mag kiezen wanneer.',
    en: 'Hold your brush at the very end for 5 minutes. The person born closest to 14 May decides when.' },
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 2,
    nl: 'Schilder zonder je pols te bewegen (alleen vanuit je arm) gedurende 5 minuten. Degene die het dichtst bij 3 april is geboren mag kiezen wanneer.',
    en: 'Paint for 5 minutes without moving your wrist — paint only from your arm. The person born closest to 3 April decides when.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder met twee penselen tegelijk.',
    en: 'Paint holding two brushes at the same time.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'Schilder met je ogen 10 seconden dicht.',
    en: 'Paint with your eyes closed for 10 seconds.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 2,
    nl: 'De persoon tegenover je zet de eerste 5 penseelstreken op jouw canvas.',
    en: 'The person across from you makes the first 5 brushstrokes on your canvas.' },

  // Group mechanics — need 3+ players (min_players=3)
  { type: 'studio_games', occasion: 'any', duration: '5min', min_players: 3,
    nl: 'Schilderij om de 5 minuten doorgeven.',
    en: 'Pass your canvas to the left every 5 minutes.' },
  { type: 'studio_games', occasion: 'any', duration: '10min', min_players: 3,
    nl: 'Schilderij om de 10 minuten doorgeven.',
    en: 'Pass your canvas to the left every 10 minutes.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 3,
    nl: 'Geef alleen je verfpalet door aan de volgende persoon.',
    en: 'Pass only your paint palette to the person next to you.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 3,
    nl: 'Je buurman kiest jouw kleurenpalet — gebruik alleen die kleuren.',
    en: 'Your neighbour chooses your colour palette — you can only use those colours.' },
  { type: 'studio_games', occasion: 'any', duration: 'round', min_players: 3,
    nl: 'Iedereen mag één kleur verbieden. Niemand mag de verboden kleuren gebruiken.',
    en: 'Everyone bans one colour. No one may use the banned colours.' }
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
      duration TEXT DEFAULT 'round',
      min_players INTEGER DEFAULT 2
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS migration_versions (
      version TEXT PRIMARY KEY
    )`);

    // Non-destructive column additions
    try { await db.query('ALTER TABLE moments ADD COLUMN social_consent INTEGER DEFAULT 0'); } catch (e) {}
    try { await db.query('ALTER TABLE activities ADD COLUMN min_players INTEGER DEFAULT 2'); } catch (e) {}

    // Seed products if empty
    var prodCount = await db.query('SELECT COUNT(*) as c FROM products');
    if (Number(prodCount.rows[0].c) === 0) {
      for (var i = 0; i < PRODUCTS_SEED.length; i++) {
        await db.query('INSERT INTO products (name, sort_order) VALUES (?, ?)', [PRODUCTS_SEED[i], i]);
      }
    }

    // Seed occasions if empty
    var occCount = await db.query('SELECT COUNT(*) as c FROM occasions');
    if (Number(occCount.rows[0].c) === 0) {
      for (var j = 0; j < OCCASIONS_SEED.length; j++) {
        await db.query('INSERT INTO occasions (name, sort_order) VALUES (?, ?)', [OCCASIONS_SEED[j], j]);
      }
    }

    // Add Boys' night if missing
    var boysNight = await db.query("SELECT COUNT(*) as c FROM occasions WHERE name = ?", ["Boys' night"]);
    if (Number(boysNight.rows[0].c) === 0) {
      await db.query("INSERT INTO occasions (name, sort_order) VALUES (?, ?)", ["Boys' night", 7]);
    }

    // Add Mother-daughter date if missing
    var motherDaughter = await db.query("SELECT COUNT(*) as c FROM occasions WHERE name = ?", ["Mother-daughter date"]);
    if (Number(motherDaughter.rows[0].c) === 0) {
      await db.query("INSERT INTO occasions (name, sort_order) VALUES (?, ?)", ["Mother-daughter date", 8]);
    }

    // Seed sorelle_talks if empty
    var actCount = await db.query('SELECT COUNT(*) as c FROM activities');
    if (Number(actCount.rows[0].c) === 0) {
      for (var k = 0; k < SORELLE_TALKS_SEED.length; k++) {
        var act = SORELLE_TALKS_SEED[k];
        await db.query(
          'INSERT INTO activities (type, occasion, description_nl, description_en, duration, min_players) VALUES (?, ?, ?, ?, ?, ?)',
          [act.type, act.occasion, act.nl, act.en, act.duration || 'round', act.min_players || 2]
        );
      }
    }

    // v2: replace all studio_games with PDF activities
    var v2 = await db.query("SELECT version FROM migration_versions WHERE version = 'v2_studio_games'");
    if (v2.rows.length === 0) {
      await db.query("DELETE FROM activities WHERE type = 'studio_games'");
      for (var m = 0; m < PDF_STUDIO_GAMES.length; m++) {
        var sg = PDF_STUDIO_GAMES[m];
        await db.query(
          'INSERT INTO activities (type, occasion, description_nl, description_en, duration, min_players) VALUES (?, ?, ?, ?, ?, ?)',
          [sg.type, sg.occasion, sg.nl, sg.en, sg.duration || 'round', sg.min_players || 2]
        );
      }
      await db.query("INSERT INTO migration_versions (version) VALUES ('v2_studio_games')");
      console.log('v2 migration: replaced studio_games with PDF activities');
    }

    console.log('DB migration complete');
  } catch (err) {
    console.error('DB migration error:', err.message);
  }
}

module.exports = migrate;
