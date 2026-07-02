require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

app.post('/api/inspire', async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI features not yet configured on this server.' });
  }

  const { answers } = req.body;
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'Please answer the questions first.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(answers) }]
    });

    res.json({ idea: message.content[0].text });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Could not generate inspiration right now. Please try again.' });
  }
});

function buildPrompt(answers) {
  const lines = answers.map(function(a) {
    return (a.question ? a.question + '\n→ ' : '') + a.answer;
  }).join('\n\n');

  return [
    'You are a warm, creative painting guide for Studio Sorelle, a painting kit company.',
    '',
    'A group just opened their painting kit and answered a few questions:',
    '',
    lines,
    '',
    'Generate a short, specific painting idea for them.',
    'They have 4 small canvases — one per person — that physically combine into one large unified piece.',
    'Include:',
    '- A theme or subject (2-4 evocative words)',
    '- One sentence for each of the 4 canvases (what that person paints, positioned top-left / top-right / bottom-left / bottom-right)',
    '- One sentence on how the four pieces connect into the full image',
    '',
    'Under 180 words. Warm, specific, encouraging. Flowing prose — no bullet points or headers.'
  ].join('\n');
}

// SPA fallback — all unmatched routes serve index.html
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, function() {
  console.log('alice listening on port ' + PORT);
});
