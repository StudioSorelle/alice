const db = require('./index');

var PRODUCTS_SEED = [
  'Our Signature Canvas Moment',
  'Our Mini Signature Canvas Moment',
  'Our Faithful Tote Moment'
];

var OCCASIONS_SEED = [
  "Date night", "Girls' night", 'Baby shower',
  'Bachelorette party', 'Family gathering', 'Birthday party'
];

// Studio Games — 44 activities (SG01–SG44) from "Spark Your Moments" document
var V3_STUDIO_GAMES = [
  // SG01
  { min_players: 2, duration: 'long', tags: 'herhaalbaar_lang',
    nl: 'Elke 15 minuten kiest iemand een willekeurig woord (bv. oceaan, muziek, herinnering) en verwerkt dit in het schilderij. Laat je volledig gaan. Leg na afloop uit hoe je het woord verwerkt hebt.',
    en: 'Every 15 minutes, someone picks a random word (e.g. ocean, music, memory) and works it into their painting. Let yourself go completely. Explain afterwards how you incorporated it.' },
  // SG02
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Maak één grote fout in je schilderij en verwerk die creatief.',
    en: 'Make one big mistake in your painting and incorporate it creatively.' },
  // SG03
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Geef je schilderij een titel voordat het af is.',
    en: 'Give your painting a title before it is finished.' },
  // SG04
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder op het ritme van de muziek.',
    en: 'Paint to the rhythm of the music.' },
  // SG05
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Wissel van plaats, maar neem je schilderij niet mee.',
    en: 'Swap seats, but don\'t take your painting with you.' },
  // SG06
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder 5 minuten met je penseel achterstevoren.',
    en: 'Paint for 5 minutes with your brush held backwards.' },
  // SG07
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Voeg een onverwachte kleur toe die nog niet in je schilderij zit.',
    en: 'Add an unexpected colour that isn\'t in your painting yet.' },
  // SG08
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder 5 minuten zonder te praten.',
    en: 'Paint for 5 minutes without talking.' },
  // SG09
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Jij mag één minuut aan het schilderij van iemand anders werken. De oudste kiest wanneer.',
    en: 'You get one minute to work on someone else\'s painting. The oldest person decides when.' },
  // SG10
  { min_players: 2, duration: 'round', tags: 'ondergrond_niet_tote',
    nl: 'Schilder 3 minuten met je vingers.',
    en: 'Paint for 3 minutes using your fingers.' },
  // SG11
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder zonder je penseel op te tillen (zoveel mogelijk).',
    en: 'Paint without lifting your brush off the canvas (as much as possible).' },
  // SG12
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder een deel van je werk met gesloten ogen.',
    en: 'Paint part of your work with your eyes closed.' },
  // SG13
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Voeg een onverwacht detail toe aan je schilderij.',
    en: 'Add an unexpected detail to your painting.' },
  // SG14
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder zonder zwart te gebruiken.',
    en: 'Paint without using black.' },
  // SG15
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder zonder wit te gebruiken.',
    en: 'Paint without using white.' },
  // SG16
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Gebruik enkel de primaire kleuren.',
    en: 'Use only the primary colours.' },
  // SG17
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder enkel met stippen.',
    en: 'Paint using only dots.' },
  // SG18
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder enkel met lijnen.',
    en: 'Paint using only lines.' },
  // SG19
  { min_players: 3, duration: 'long', tags: 'mechanisme_groep;herhaalbaar_lang',
    nl: 'Geef je schilderij om de 5 minuten door aan je buur.',
    en: 'Pass your painting to your neighbour every 5 minutes.' },
  // SG20
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Schilder 5 minuten met je niet-dominante hand. De jongste beslist wanneer.',
    en: 'Paint for 5 minutes with your non-dominant hand. The youngest person decides when.' },
  // SG21
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Geef enkel je verfpalet door aan je buur (niet je schilderij).',
    en: 'Pass only your paint palette to your neighbour (not your painting).' },
  // SG22
  { min_players: 2, duration: 'round', tags: 'mechanisme_paar',
    nl: 'Je buur kiest jouw kleurenpalet; gebruik enkel die kleuren.',
    en: 'Your neighbour chooses your colour palette; use only those colours.' },
  // SG23
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Trek 3 willekeurige kleuren en gebruik enkel die.',
    en: 'Pick 3 random colours and use only those.' },
  // SG24
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Iedereen mag één kleur verbieden voor de rest van de opdracht.',
    en: 'Everyone can ban one colour for the rest of the activity.' },
  // SG25
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Houd je penseel 5 minuten volledig achterstevoren vast. Wie het dichtst bij 14 mei jarig is, kiest wanneer.',
    en: 'Hold your brush completely backwards for 5 minutes. The person with a birthday closest to 14 May decides when.' },
  // SG26
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Schilder 5 minuten enkel vanuit je arm, zonder je pols te bewegen. Wie het dichtst bij 3 april jarig is, kiest wanneer.',
    en: 'Paint for 5 minutes using only your arm, without moving your wrist. The person with a birthday closest to 3 April decides when.' },
  // SG27
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder met twee penselen tegelijk.',
    en: 'Paint with two brushes at the same time.' },
  // SG28
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder 10 seconden met je ogen dicht.',
    en: 'Paint for 10 seconds with your eyes closed.' },
  // SG29
  { min_players: 2, duration: 'round', tags: 'mechanisme_paar',
    nl: 'De persoon tegenover jou zet de eerste 5 penseelstreken op jouw canvas.',
    en: 'The person across from you makes the first 5 brushstrokes on your canvas.' },
  // SG30
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder je onderwerp alsof het zich onderwater bevindt.',
    en: 'Paint your subject as if it were underwater.' },
  // SG31
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Voeg een dier toe aan je schilderij, ook al past het er niet echt bij.',
    en: 'Add an animal to your painting, even if it doesn\'t really fit.' },
  // SG32
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Vertel een klein verhaal over wat je schildert, terwijl je verder schildert.',
    en: 'Tell a little story about what you\'re painting as you continue to paint.' },
  // SG33
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Meng twee kleuren die je normaal nooit samen zou gebruiken.',
    en: 'Mix two colours you would never normally use together.' },
  // SG34
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Draai je schilderij ondersteboven en werk het zo verder af.',
    en: 'Turn your painting upside down and keep working on it that way.' },
  // SG35
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder 3 minuten enkel met je pink tegen het penseel.',
    en: 'Paint for 3 minutes using only your little finger against the brush.' },
  // SG36
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Schilder iets dat je blij maakt, zonder het te benoemen. Laat de anderen raden wat het is.',
    en: 'Paint something that makes you happy without naming it. Let the others guess what it is.' },
  // SG37
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Verstop een klein hartje ergens in je schilderij.',
    en: 'Hide a small heart somewhere in your painting.' },
  // SG38
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder 2 minuten in volledige stilte, zonder muziek. Beschrijf nadien wat je voelde.',
    en: 'Paint for 2 minutes in complete silence, without music. Describe how you felt afterwards.' },
  // SG39
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Kies een geur (koffie, zee, vers gras...) en probeer die te schilderen.',
    en: 'Choose a scent (coffee, sea, fresh grass...) and try to paint it.' },
  // SG40
  { min_players: 2, duration: 'round', tags: 'mechanisme_paar',
    nl: 'Werk 5 minuten samen aan één canvas, zonder vooraf te overleggen wat jullie schilderen.',
    en: 'Work together on one canvas for 5 minutes, without agreeing beforehand on what to paint.' },
  // SG41
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder met een sponsje in plaats van je penseel.',
    en: 'Paint with a sponge instead of your brush.' },
  // SG42
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Voeg een woord of korte tekst toe aan je schilderij.',
    en: 'Add a word or short text to your painting.' },
  // SG43
  { min_players: 2, duration: 'round', tags: '',
    nl: 'Schilder je stemming van vandaag, volledig abstract.',
    en: 'Paint your mood today, completely abstract.' },
  // SG44
  { min_players: 3, duration: 'round', tags: 'mechanisme_groep',
    nl: 'Ruil na 10 minuten je schilderij met iemand anders en maak het samen verder af.',
    en: 'After 10 minutes, swap your painting with someone else and finish it together.' }
];

// Sorelle Talks — 154 activities (ST01–ST154) from "Spark Your Moments" document
var V3_SORELLE_TALKS = [
  // ST01
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie',
    nl: 'Deel een herinnering die je nog nooit met de ander(en) hebt gedeeld.',
    en: 'Share a memory you\'ve never told the other person/people before.' },
  // ST02
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_vriendinnen;sfeer_mannen;sfeer_familie;sfeer_feestelijk',
    nl: 'Wat is het grappigste dat je deze maand hebt meegemaakt?',
    en: 'What\'s the funniest thing that happened to you this month?' },
  // ST03
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_vriendinnen;sfeer_mannen;sfeer_familie;sfeer_feestelijk',
    nl: 'Als je morgen naar eender welke stad kon verhuizen, welke kies je en waarom?',
    en: 'If you could move to any city tomorrow, which would you choose and why?' },
  // ST04
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie',
    nl: 'Vertel over een moment waarop je echt trots was op jezelf.',
    en: 'Tell us about a moment when you were truly proud of yourself.' },
  // ST05
  { occasion: 'any', min_players: 3, duration: 'long', tags: 'sfeer_familie;sfeer_vriendinnen;sfeer_feestelijk;sfeer_mannen;sfeer_feestelijk_vriendinnen;mechanisme_groep;herhaalbaar_lang',
    nl: 'Elke 15 minuten kiest de jongste een nieuw woord (bv. vrijheid, avontuur, thuis). Iedereen deelt om beurt wat het woord voor hen betekent.',
    en: 'Every 15 minutes the youngest person picks a new word (e.g. freedom, adventure, home). Everyone takes turns sharing what the word means to them.' },
  // ST06
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie',
    nl: 'Wat was je grootste angst als kind, en ben je daar nu nog steeds een beetje bang voor?',
    en: 'What was your biggest fear as a child, and are you still a little afraid of it now?' },
  // ST07
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_speels;sfeer_feestelijk;sfeer_mannen;sfeer_familie;sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Doe een korte impressie van iemand aan tafel. De rest raadt wie je nadoet.',
    en: 'Do a quick impression of someone at the table. The rest guess who you\'re imitating.' },
  // ST08
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;inhoud_volwassen',
    nl: 'Vertel over de eerste keer dat je echt verliefd was.',
    en: 'Tell us about the first time you were truly in love.' },
  // ST09
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_familie;sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Als je één superkracht mocht kiezen, welke en waarom?',
    en: 'If you could choose one superpower, which would it be and why?' },
  // ST10
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_speels;sfeer_vriendinnen;sfeer_mannen;sfeer_familie;sfeer_feestelijk;sfeer_feestelijk_vriendinnen;mechanisme_groep;herhaalbaar_kort',
    nl: 'Buurman kiest: jouw buur bepaalt 2 minuten lang waarover jij praat.',
    en: 'Neighbour picks: your neighbour decides for 2 minutes what you talk about.' },
  // ST11
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie',
    nl: 'Deel het beste advies dat je ooit hebt gekregen.',
    en: 'Share the best advice you\'ve ever received.' },
  // ST12
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_speels;sfeer_vriendinnen;sfeer_feestelijk;sfeer_mannen;sfeer_familie;mechanisme_groep',
    nl: 'Iedereen schrijft een gênant momentje op een briefje. Meng ze en raad wie bij welk briefje hoort.',
    en: 'Everyone writes an embarrassing moment on a piece of paper. Mix them up and guess who each one belongs to.' },
  // ST13
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie;sfeer_vriendinnen',
    nl: 'Wat zou je tegen je 16-jarige zelf zeggen?',
    en: 'What would you say to your 16-year-old self?' },
  // ST14
  { occasion: 'any', min_players: 3, duration: 'long', tags: 'sfeer_vriendinnen;sfeer_feestelijk;sfeer_mannen;sfeer_familie;sfeer_feestelijk_vriendinnen;mechanisme_groep;herhaalbaar_lang',
    nl: 'Doorgeven om de 5 minuten: geef het gespreksonderwerp door aan wie links van je zit.',
    en: 'Pass it on every 5 minutes: pass the conversation topic to the person on your left.' },
  // ST15
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;inhoud_volwassen',
    nl: 'Wat is een gewoonte van je partner die je stiekem bewondert?',
    en: 'What is a habit of your partner that you secretly admire?' },
  // ST16
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;sfeer_mannen;sfeer_feestelijk;sfeer_intiem_familie',
    nl: 'Deel een reis of ervaring die jouw kijk op het leven veranderd heeft.',
    en: 'Share a trip or experience that changed your perspective on life.' },
  // ST17
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_familie;sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Beschrijf je perfecte zondag, van \'s ochtends tot \'s avonds.',
    en: 'Describe your perfect Sunday, from morning to evening.' },
  // ST18
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;inhoud_volwassen',
    nl: 'Vertel het verhaal van hoe jullie elkaar voor het eerst ontmoet hebben.',
    en: 'Tell the story of how you first met each other.' },
  // ST19
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk_vriendinnen;sfeer_vriendinnen;sfeer_mannen;sfeer_feestelijk;sfeer_familie_lief',
    nl: 'Wat is het beste cadeau dat je ooit hebt gekregen, en waarom?',
    en: 'What\'s the best gift you\'ve ever received, and why?' },
  // ST20
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie;sfeer_vriendinnen',
    nl: 'Deel een droom of doel dat je nog altijd hebt, groot of klein.',
    en: 'Share a dream or goal you still have, big or small.' },
  // ST21
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_feestelijk;sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Iedereen deelt in één woord wat vandaag speciaal maakt. Verzamel de woorden tot een klein \'gedicht\' voor de eregast.',
    en: 'Everyone shares in one word what makes today special. Collect the words into a short poem for the guest of honour.' },
  // ST22 — explicitly about moeder/dochter
  { occasion: 'Mother-daughter date', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem',
    nl: 'Vertel een herinnering met je moeder/dochter die je nooit zal vergeten.',
    en: 'Share a memory with your mother/daughter that you\'ll never forget.' },
  // ST23
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_mannen',
    nl: 'Wat maakt jullie vriendschap uniek volgens jou?',
    en: 'What makes your friendship unique, in your opinion?' },
  // ST24
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_feestelijk;sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Elk om de beurt: geef de eregast een compliment dat ze nog nooit gehoord heeft.',
    en: 'Take turns: give the guest of honour a compliment they\'ve never heard before.' },
  // ST25
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_familie;sfeer_mannen;sfeer_feestelijk;sfeer_feestelijk_vriendinnen',
    nl: 'Wat is je favoriete herinnering met dit gezelschap?',
    en: 'What is your favourite memory with this group?' },
  // ST26
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_mannen;sfeer_vriendinnen;sfeer_familie;sfeer_feestelijk',
    nl: 'Als je morgen een volledig vrije dag had, hoe zou die eruitzien?',
    en: 'If you had a completely free day tomorrow, what would it look like?' },
  // ST27
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie;sfeer_vriendinnen',
    nl: 'Welke eigenschap van jezelf werd vroeger niet gewaardeerd, maar nu wel?',
    en: 'Which quality of yours was underappreciated before but is valued now?' },
  // ST28
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_familie;sfeer_mannen;sfeer_feestelijk',
    nl: 'Noem een liedje dat je meteen terugbrengt naar een bepaalde tijd, en vertel waarom.',
    en: 'Name a song that instantly takes you back to a specific time, and explain why.' },
  // ST29
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;sfeer_mannen;sfeer_familie;sfeer_feestelijk;sfeer_intiem_familie',
    nl: 'Wat is het beste compliment dat je ooit hebt gekregen?',
    en: 'What\'s the best compliment you\'ve ever received?' },
  // ST30
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;sfeer_intiem_familie',
    nl: 'Als je een boek zou schrijven over je leven, wat zou de titel zijn?',
    en: 'If you wrote a book about your life, what would the title be?' },
  // ST31
  { occasion: 'any', min_players: 3, duration: 'long', tags: 'sfeer_vriendinnen;sfeer_feestelijk;sfeer_mannen;sfeer_familie;sfeer_feestelijk_vriendinnen;mechanisme_groep;herhaalbaar_lang',
    nl: 'Elke 15 minuten stelt de oudste een \'zou je liever\'-vraag. Iedereen kiest en licht kort toe.',
    en: 'Every 15 minutes the oldest person asks a \'would you rather\' question. Everyone chooses and briefly explains.' },
  // ST32
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie;sfeer_vriendinnen',
    nl: 'Wat is iets waar je stiekem heel goed in bent, maar nooit over praat?',
    en: 'What is something you\'re secretly really good at but never talk about?' },
  // ST33
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;sfeer_familie',
    nl: 'Deel een moment waarop iemand anders jouw dag helemaal goedmaakte.',
    en: 'Share a moment when someone else completely made your day.' },
  // ST34
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_intiem_familie',
    nl: 'Wat zou je doen als angst voor een moment geen rol speelde?',
    en: 'What would you do if fear played no role for a moment?' },
  // ST35
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie;sfeer_familie_lief;sfeer_feestelijk',
    nl: 'Vertel over een familietraditie die je koestert.',
    en: 'Tell us about a family tradition you cherish.' },
  // ST36
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_feestelijk;sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Iedereen deelt om de beurt een wens voor de eregast.',
    en: 'Everyone takes turns sharing a wish for the guest of honour.' },
  // ST37
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;inhoud_volwassen',
    nl: 'Wat is de grootste les die deze vriendschap of relatie je heeft geleerd?',
    en: 'What is the biggest lesson this friendship or relationship has taught you?' },
  // ST38
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem;sfeer_vriendinnen;sfeer_mannen;sfeer_familie',
    nl: 'Noem een plek waar je je het meest jezelf voelt, en waarom.',
    en: 'Name a place where you feel most yourself, and explain why.' },
  // ST39
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_speels;sfeer_familie;sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Als je een dier was, welk dier zou je zijn en waarom?',
    en: 'If you were an animal, which would you be and why?' },
  // ST40
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat is de stomste weddenschap die je ooit hebt verloren?',
    en: 'What is the dumbest bet you\'ve ever lost?' },
  // ST41
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie;sfeer_feestelijk',
    nl: 'Welke film kan je bijna woord voor woord meespelen?',
    en: 'Which film can you recite almost word for word?' },
  // ST42
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat was je slechtste haarstijl of outfit ooit?',
    en: 'What was your worst hairstyle or outfit ever?' },
  // ST43
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_feestelijk',
    nl: 'Welk sportmoment zou je willen herbeleven als je een tijdmachine had?',
    en: 'Which sports moment would you want to relive if you had a time machine?' },
  // ST44
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wie van de groep zou het langst overleven in een zombie-apocalyps, en waarom?',
    en: 'Who in the group would survive longest in a zombie apocalypse, and why?' },
  // ST45
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen',
    nl: 'Wat is het grootste risico dat je ooit hebt genomen?',
    en: 'What is the biggest risk you\'ve ever taken?' },
  // ST46
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie',
    nl: 'Welke hobby zou je oppikken als geld geen rol speelde?',
    en: 'Which hobby would you pick up if money were no object?' },
  // ST47
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat is de gekste uitdaging die je ooit hebt aangenomen?',
    en: 'What is the craziest challenge you\'ve ever accepted?' },
  // ST48
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen',
    nl: 'Wat zou je het meest missen als je morgen moest stoppen met werken?',
    en: 'What would you miss most if you had to stop working tomorrow?' },
  // ST49
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat is jouw guilty pleasure-nummer dat niemand van je verwacht?',
    en: 'What is your guilty pleasure song that nobody would expect from you?' },
  // ST50
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wie in de groep zou de beste undercoveragent zijn, en waarom?',
    en: 'Who in the group would make the best undercover agent, and why?' },
  // ST51
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie;sfeer_intiem_familie',
    nl: 'Wie was je grootste jeugdheld?',
    en: 'Who was your biggest childhood hero?' },
  // ST52
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie',
    nl: 'Als je één regel in de wereld mocht veranderen, welke zou het zijn?',
    en: 'If you could change one rule in the world, which would it be?' },
  // ST53
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_familie;sfeer_intiem_familie',
    nl: 'Wat is het beste advies dat een vaderfiguur je ooit gaf?',
    en: 'What is the best advice a father figure ever gave you?' },
  // ST54
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie',
    nl: 'Welke serie of film heb je stiekem al minstens 5 keer bekeken?',
    en: 'Which series or film have you secretly watched at least 5 times?' },
  // ST55
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat zou je doen met 1 miljoen euro, te besteden binnen 24 uur?',
    en: 'What would you do with 1 million euros, to be spent within 24 hours?' },
  // ST56
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk;sfeer_familie',
    nl: 'Wie in de groep maakt de beste grappen, en waarom?',
    en: 'Who in the group makes the best jokes, and why?' },
  // ST57
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_familie',
    nl: 'Wat is jouw grootste sportprestatie, groot of klein?',
    en: 'What is your greatest sporting achievement, big or small?' },
  // ST58
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Als je een rol in een actiefilm mocht spelen, welke rol zou je kiezen?',
    en: 'If you could play a role in an action film, which role would you choose?' },
  // ST59
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk',
    nl: 'Wat is de beste reis die je ooit met vrienden hebt gemaakt?',
    en: 'What is the best trip you\'ve ever taken with friends?' },
  // ST60
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_mannen;sfeer_vriendinnen;sfeer_feestelijk;sfeer_familie',
    nl: 'Wat is het meest bizarre dat je ooit hebt gegeten, en zou je het opnieuw doen?',
    en: 'What is the strangest thing you\'ve ever eaten, and would you do it again?' },
  // ST61 — Bachelorette only
  { occasion: 'Bachelorette party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Wat is het gekste dat de bruid ooit heeft gedaan voor de liefde?',
    en: 'What is the craziest thing the bride has ever done for love?' },
  // ST62
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Deel je favoriete herinnering met de bruid.',
    en: 'Share your favourite memory with the bride.' },
  // ST63
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Wat voorspel je over het huwelijksleven van de bruid?',
    en: 'What do you predict about the bride\'s married life?' },
  // ST64
  { occasion: 'Bachelorette party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Iedereen deelt één woord dat de bruid beschrijft; verzamel ze tot een korte toost.',
    en: 'Everyone shares one word that describes the bride; collect them into a short toast.' },
  // ST65
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Wat is het beste huwelijksadvies dat je aan de bruid zou geven?',
    en: 'What is the best marriage advice you would give to the bride?' },
  // ST66 — Bachelorette + Girls' night
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen;mechanisme_groep',
    nl: 'Vertel het grappigste datingverhaal dat je van iemand in de groep kent.',
    en: 'Tell the funniest dating story you know about someone in the group.' },
  // ST67
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen',
    nl: 'Wat was jullie wildste avontuur samen als vriendinnengroep?',
    en: 'What was your wildest adventure together as a group of friends?' },
  // ST68
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Als de bruid een liedje zou zijn, welk liedje is ze dan?',
    en: 'If the bride were a song, which song would she be?' },
  // ST69
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Deel een compliment voor de bruid dat ze nog nooit gehoord heeft.',
    en: 'Share a compliment for the bride that she\'s never heard before.' },
  // ST70
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Wat is jouw beste tip om het feest van vanavond onvergetelijk te maken?',
    en: 'What is your best tip to make tonight\'s party unforgettable?' },
  // ST71
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Vertel over de eerste keer dat je de bruid ontmoette.',
    en: 'Tell us about the first time you met the bride.' },
  // ST72
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Welke gewoonte van de bruid gaat haar partner nooit kunnen veranderen?',
    en: 'Which habit of the bride will her partner never be able to change?' },
  // ST73
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Wat denk je dat de bruid het meest gaat missen aan het vrijgezellenleven?',
    en: 'What do you think the bride will miss most about being single?' },
  // ST74
  { occasion: 'Bachelorette party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;mechanisme_groep',
    nl: 'Iedereen raadt: hoeveel jaar kennen de bruid en haar partner elkaar al?',
    en: 'Everyone guesses: how many years have the bride and her partner known each other?' },
  // ST75
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Deel een voorspelling voor het huwelijksfeest zelf.',
    en: 'Share a prediction for the wedding celebration itself.' },
  // ST76 — Bachelorette + Girls' night
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen',
    nl: 'Wat is de beste vriendinnenherinnering die je met deze groep hebt?',
    en: 'What is the best friends\' memory you have with this group?' },
  // ST77
  { occasion: 'Bachelorette party', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen',
    nl: 'Als je één ding tegen de bruid mag zeggen voor haar grote dag, wat is het?',
    en: 'If you could say one thing to the bride before her big day, what would it be?' },
  // ST78 — Bachelorette + Girls' night
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen',
    nl: 'Wat is het meest romantische gebaar dat je ooit hebt gezien?',
    en: 'What is the most romantic gesture you\'ve ever seen?' },
  // ST79
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen;sfeer_familie',
    nl: 'Vertel over een moment waarop deze groep elkaar enorm heeft gesteund.',
    en: 'Tell us about a moment when this group really supported each other.' },
  // ST80
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_feestelijk_vriendinnen;sfeer_vriendinnen',
    nl: 'Wat hoop je dat de bruid nooit zal veranderen aan zichzelf?',
    en: 'What do you hope the bride will never change about herself?' },
  // ST81 — Baby shower
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Wat is het beste advies dat je zou geven aan een nieuwe ouder?',
    en: 'What is the best advice you would give to a new parent?' },
  // ST82
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_vriendinnen',
    nl: 'Deel je grappigste \'ouders-verhaal\', van jezelf of iemand die je kent.',
    en: 'Share your funniest parenting story, about yourself or someone you know.' },
  // ST83
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Als de baby een dier was, welk dier zou het zijn?',
    en: 'If the baby were an animal, which would it be?' },
  // ST84
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Wat hoop je dat de baby erft van de aanstaande ouder(s)?',
    en: 'What do you hope the baby inherits from the parent(s)-to-be?' },
  // ST85
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_feestelijk;mechanisme_groep',
    nl: 'Iedereen raadt: hoe laat wordt de baby geboren?',
    en: 'Everyone guesses: what time will the baby be born?' },
  // ST86
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_vriendinnen',
    nl: 'Deel een babynaam die je grappig of mooi vindt, gewoon voor de fun.',
    en: 'Share a baby name you find funny or beautiful, just for fun.' },
  // ST87
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_intiem_familie;sfeer_familie',
    nl: 'Wat is jouw favoriete kinderherinnering met je eigen moeder of vader?',
    en: 'What is your favourite childhood memory with your own mother or father?' },
  // ST88
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Welke eigenschap van de aanstaande ouder(s) zal de baby zeker overnemen?',
    en: 'Which quality of the parent(s)-to-be will the baby definitely pick up?' },
  // ST89
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Deel in één zin een wens voor de baby.',
    en: 'Share a wish for the baby in one sentence.' },
  // ST90
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_feestelijk',
    nl: 'Wat was het beste cadeau dat jij ooit als kind kreeg?',
    en: 'What was the best gift you ever received as a child?' },
  // ST91
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_intiem_familie',
    nl: 'Als je één levensles zou meegeven aan de baby, welke zou het zijn?',
    en: 'If you could pass one life lesson on to the baby, what would it be?' },
  // ST92
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_vriendinnen',
    nl: 'Vertel het grappigste dat je ooit hebt meegemaakt met een baby of peuter.',
    en: 'Tell the funniest thing you\'ve ever experienced with a baby or toddler.' },
  // ST93
  { occasion: 'Baby shower', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;mechanisme_groep',
    nl: 'Wat denk je dat het eerste woordje van de baby wordt?',
    en: 'What do you think the baby\'s first word will be?' },
  // ST94
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_intiem_familie',
    nl: 'Deel een herinnering aan toen jij, of iemand die je kent, net ouder werd.',
    en: 'Share a memory of when you, or someone you know, first became a parent.' },
  // ST95
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Wat is jouw beste tip tegen slaaptekort?',
    en: 'What is your best tip for dealing with sleep deprivation?' },
  // ST96
  { occasion: 'Baby shower', min_players: 3, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;mechanisme_groep',
    nl: 'Iedereen deelt in één woord hoe ze zich voelen bij deze nieuwe fase.',
    en: 'Everyone shares in one word how they feel about this new chapter.' },
  // ST97
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Wat hoop je het meest voor de aanstaande ouder(s)?',
    en: 'What do you hope most for the parent(s)-to-be?' },
  // ST98
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie;sfeer_vriendinnen',
    nl: 'Wat is het grappigste babyproduct dat je ooit hebt gezien of gekregen?',
    en: 'What is the funniest baby product you\'ve ever seen or received?' },
  // ST99
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Welke eigenschap hoop je dat de baby van beide ouders meekrijgt?',
    en: 'Which quality do you hope the baby gets from both parents?' },
  // ST100
  { occasion: 'Baby shower', min_players: 2, duration: 'round', tags: 'sfeer_familie_lief;sfeer_familie',
    nl: 'Deel een klein stukje advies dat je zelf graag had gekregen als kersverse ouder.',
    en: 'Share a small piece of advice you wish someone had given you when you first became a parent.' },
  // ST101 — Mother-daughter context (multiple sfeer tags → any)
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat is jullie mooiste jeugdherinnering samen?',
    en: 'What is your most beautiful shared childhood memory?' },
  // ST102
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Welke eigenschap van elkaar bewonderen jullie het meest?',
    en: 'Which quality do you admire most in each other?' },
  // ST103
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat is een gewoonte die je van elkaar hebt overgenomen?',
    en: 'What is a habit you have picked up from each other?' },
  // ST104
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Deel een moment waarop je enorm trots was op elkaar.',
    en: 'Share a moment when you were enormously proud of each other.' },
  // ST105
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat zou je tegen elkaar zeggen als je maar één zin had?',
    en: 'What would you say to each other if you only had one sentence?' },
  // ST106
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_familie',
    nl: 'Welke traditie willen jullie zeker doorgeven aan de volgende generatie?',
    en: 'Which tradition do you definitely want to pass on to the next generation?' },
  // ST107
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat is het beste advies dat je van elkaar hebt gekregen?',
    en: 'What is the best advice you\'ve received from each other?' },
  // ST108
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Deel een herinnering die jullie allebei nog altijd doet lachen.',
    en: 'Share a memory that still makes you both laugh.' },
  // ST109
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat hoop je dat jullie band later zal zijn?',
    en: 'What do you hope your bond will be like in the future?' },
  // ST110
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_familie;sfeer_vriendinnen',
    nl: 'Vertel een verhaal dat je al vaak hebt gehoord, maar nog eens wil horen.',
    en: 'Tell a story you\'ve heard many times but still want to hear again.' },
  // ST111
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_familie',
    nl: 'Wat is iets dat je pas als volwassene bent gaan waarderen aan elkaar?',
    en: 'What is something you only came to appreciate about each other as adults?' },
  // ST112
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_vriendinnen;sfeer_familie',
    nl: 'Welke droom hadden jullie allebei als kind?',
    en: 'What dream did you both have as children?' },
  // ST113
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Deel een moment waarop jullie elkaar echt nodig hadden.',
    en: 'Share a moment when you really needed each other.' },
  // ST114
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat maakt jullie band uniek volgens jou?',
    en: 'What makes your bond unique, in your opinion?' },
  // ST115
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen;sfeer_familie',
    nl: 'Wat is jullie favoriete activiteit om samen te doen?',
    en: 'What is your favourite activity to do together?' },
  // ST116
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Als jullie samen op reis zouden gaan, waar zou die naartoe gaan?',
    en: 'If you were to travel together, where would you go?' },
  // ST117
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_vriendinnen;sfeer_familie',
    nl: 'Wat is de grappigste ruzie die jullie ooit hadden, achteraf gezien?',
    en: 'What is the funniest argument you\'ve ever had, looking back?' },
  // ST118
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Deel iets waar je dankbaar voor bent tussen jullie.',
    en: 'Share something you\'re grateful for between you.' },
  // ST119
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Wat is het beste compliment dat je ooit van elkaar hebt gekregen?',
    en: 'What is the best compliment you\'ve ever received from each other?' },
  // ST120
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_intiem_familie;sfeer_intiem;sfeer_vriendinnen',
    nl: 'Welke herinnering zou je het liefst opnieuw beleven met elkaar?',
    en: 'Which memory would you most like to relive together?' },
  // ST121 — Birthday party
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;mechanisme_groep',
    nl: 'Iedereen deelt zijn/haar beste verjaardagsherinnering met de jarige.',
    en: 'Everyone shares their best birthday memory with the birthday person.' },
  // ST122
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;sfeer_vriendinnen',
    nl: 'Wat is het beste verjaardagscadeau dat je ooit hebt gekregen?',
    en: 'What is the best birthday gift you\'ve ever received?' },
  // ST123
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie',
    nl: 'Deel een wens voor de jarige voor het komende jaar.',
    en: 'Share a wish for the birthday person for the coming year.' },
  // ST124
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;sfeer_vriendinnen',
    nl: 'Wat denk je dat de jarige over 10 jaar aan het doen is?',
    en: 'What do you think the birthday person will be doing in 10 years?' },
  // ST125
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;mechanisme_groep',
    nl: 'Iedereen deelt in één woord wat de jarige speciaal maakt.',
    en: 'Everyone shares in one word what makes the birthday person special.' },
  // ST126 — too broad (mannen + vriendinnen + feestelijk + familie)
  { occasion: 'any', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;sfeer_vriendinnen;sfeer_mannen',
    nl: 'Wat is de gekste verjaardag die je ooit hebt gevierd?',
    en: 'What is the craziest birthday you\'ve ever celebrated?' },
  // ST127
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;sfeer_vriendinnen',
    nl: 'Vertel het verhaal van hoe jij de jarige leerde kennen.',
    en: 'Tell the story of how you first met the birthday person.' },
  // ST128
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie',
    nl: 'Wat is jouw favoriete traditie op verjaardagen?',
    en: 'What is your favourite birthday tradition?' },
  // ST129
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;sfeer_vriendinnen',
    nl: 'Als de jarige een taart was, welke smaak zou die zijn en waarom?',
    en: 'If the birthday person were a cake, what flavour would they be and why?' },
  // ST130
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie',
    nl: 'Deel een compliment voor de jarige dat nog niemand heeft gezegd.',
    en: 'Share a compliment for the birthday person that nobody has said yet.' },
  // ST131
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie',
    nl: 'Wat hoop je dat de jarige dit jaar gaat meemaken?',
    en: 'What do you hope the birthday person will experience this year?' },
  // ST132
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie',
    nl: 'Welke eigenschap van de jarige zorgt ervoor dat iedereen hier is vandaag?',
    en: 'Which quality of the birthday person is the reason everyone is here today?' },
  // ST133
  { occasion: 'Birthday party', min_players: 3, duration: 'round', tags: 'sfeer_feestelijk;sfeer_familie;mechanisme_groep',
    nl: 'Iedereen raadt: wat was het beste moment van de jarige dit jaar?',
    en: 'Everyone guesses: what was the birthday person\'s best moment this year?' },
  // ST134 — Family gathering context (spans birthday + baby shower + family)
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk;sfeer_familie_lief',
    nl: 'Wat is een familietraditie waar je graag aan terugdenkt?',
    en: 'What is a family tradition you love to think back on?' },
  // ST135
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk',
    nl: 'Deel een grappig verhaal dat vaak wordt verteld op familiefeesten.',
    en: 'Share a funny story that\'s often told at family gatherings.' },
  // ST136
  { occasion: 'Family gathering', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie',
    nl: 'Wat is het beste advies dat een familielid je ooit gaf?',
    en: 'What is the best advice a family member ever gave you?' },
  // ST137
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk',
    nl: 'Als jullie gezin een tv-serie was, welke zou het zijn?',
    en: 'If your family were a TV series, which would it be?' },
  // ST138
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie;sfeer_familie_lief',
    nl: 'Wat hoop je dat de volgende generatie van deze familie overneemt?',
    en: 'What do you hope the next generation of this family will carry on?' },
  // ST139
  { occasion: 'Family gathering', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie',
    nl: 'Deel een herinnering met een grootouder die je koestert.',
    en: 'Share a memory with a grandparent that you cherish.' },
  // ST140
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk',
    nl: 'Wat is jullie favoriete gezamenlijke activiteit als familie?',
    en: 'What is your family\'s favourite activity to do together?' },
  // ST141
  { occasion: 'Family gathering', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie',
    nl: 'Vertel over een moment waarop de familie je enorm steunde.',
    en: 'Tell us about a moment when the family really supported you.' },
  // ST142
  { occasion: 'Family gathering', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie',
    nl: 'Wat maakt jullie familie uniek volgens jou?',
    en: 'What makes your family unique, in your opinion?' },
  // ST143
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk',
    nl: 'Deel een droom die je met de familie zou willen realiseren.',
    en: 'Share a dream you\'d like to fulfil together as a family.' },
  // ST144
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_feestelijk',
    nl: 'Wat is de grappigste eigenschap die \'door de familie gaat\'?',
    en: 'What is the funniest trait that runs in the family?' },
  // ST145
  { occasion: 'Family gathering', min_players: 2, duration: 'round', tags: 'sfeer_familie;sfeer_intiem_familie',
    nl: 'Iedereen deelt in één woord wat familie voor hen betekent.',
    en: 'Everyone shares in one word what family means to them.' },
  // ST146 — Girls' night + Bachelorette
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen',
    nl: 'Wat is de beste vriendinnentrip die je ooit hebt gemaakt?',
    en: 'What is the best girls\' trip you\'ve ever been on?' },
  // ST147
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen',
    nl: 'Wat is het beste stijladvies dat je ooit van een vriendin kreeg?',
    en: 'What is the best style advice you\'ve ever received from a friend?' },
  // ST148
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen;sfeer_mannen',
    nl: 'Als jullie vriendinnengroep een girlband was, welke rol zou jij spelen?',
    en: 'If your group of friends were a girl band, what role would you play?' },
  // ST149
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen;sfeer_mannen',
    nl: 'Wat is de grappigste dating-ervaring die je ooit hebt gehad?',
    en: 'What is the funniest dating experience you\'ve ever had?' },
  // ST150
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen',
    nl: 'Deel het beste compliment dat je deze week van een vriendin kreeg.',
    en: 'Share the best compliment you received from a friend this week.' },
  // ST151
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen;sfeer_mannen',
    nl: 'Wat waardeer je het meest aan deze vriendengroep?',
    en: 'What do you appreciate most about this group of friends?' },
  // ST152
  { occasion: 'any', min_players: 2, duration: 'round', tags: 'sfeer_vriendinnen;sfeer_feestelijk_vriendinnen',
    nl: 'Wat is een klein geheimpje dat alleen deze groep van je mag weten?',
    en: 'What is a little secret that only this group is allowed to know?' },
  // ST153 — Date night only
  { occasion: 'Date night', min_players: 2, duration: 'round', tags: 'sfeer_intiem;inhoud_volwassen',
    nl: 'Wat maakt je nog altijd een beetje verlegen bij mij?',
    en: 'What still makes you a little shy around me?' },
  // ST154
  { occasion: 'Date night', min_players: 2, duration: 'round', tags: 'sfeer_intiem;inhoud_volwassen',
    nl: 'Wat is jouw favoriete klein gebaar dat ik vaak doe?',
    en: 'What is your favourite small gesture that I often do?' }
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
    try { await db.query('ALTER TABLE moments ADD COLUMN approved INTEGER DEFAULT 0'); } catch (e) {}
    try { await db.query('ALTER TABLE moments ADD COLUMN quote TEXT'); } catch (e) {}
    try { await db.query('ALTER TABLE moments ADD COLUMN email_sent INTEGER DEFAULT 0'); } catch (e) {}
    try { await db.query('ALTER TABLE activities ADD COLUMN tags TEXT'); } catch (e) {}

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

    // v2: legacy migration marker (superseded by v3 — kept for backward compatibility)
    var v2 = await db.query("SELECT version FROM migration_versions WHERE version = 'v2_studio_games'");
    if (v2.rows.length === 0) {
      await db.query("INSERT INTO migration_versions (version) VALUES ('v2_studio_games')");
    }

    // v3: full activity overhaul — 44 Studio Games + 154 Sorelle Talks from document
    var v3 = await db.query("SELECT version FROM migration_versions WHERE version = 'v3_spark_overhaul'");
    if (v3.rows.length === 0) {
      await db.query('DELETE FROM activities');

      for (var m = 0; m < V3_STUDIO_GAMES.length; m++) {
        var sg = V3_STUDIO_GAMES[m];
        await db.query(
          'INSERT INTO activities (type, occasion, description_nl, description_en, duration, min_players, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['studio_games', 'any', sg.nl, sg.en, sg.duration || 'round', sg.min_players || 2, sg.tags || '']
        );
      }

      for (var n = 0; n < V3_SORELLE_TALKS.length; n++) {
        var st = V3_SORELLE_TALKS[n];
        await db.query(
          'INSERT INTO activities (type, occasion, description_nl, description_en, duration, min_players, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['sorelle_talks', st.occasion, st.nl, st.en, st.duration || 'round', st.min_players || 2, st.tags || '']
        );
      }

      await db.query("INSERT INTO migration_versions (version) VALUES ('v3_spark_overhaul')");
      console.log('v3 migration: replaced all activities — 44 Studio Games + 154 Sorelle Talks');
    }

    console.log('DB migration complete');
  } catch (err) {
    console.error('DB migration error:', err.message);
  }
}

module.exports = migrate;
