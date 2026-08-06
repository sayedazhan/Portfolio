'use strict';

const knowledge = require('../../assets/azhan-knowledge.json');

const STOP_WORDS = new Set(
  'a an and are as at be by can do for from has have how i in is it me my of on or our should that the this to what when where which who why with you your'.split(' ')
);

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function clean(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9&+.# -]/g, ' ');
}

function terms(value) {
  return [
    ...new Set(
      clean(value)
        .split(/\s+/)
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    ),
  ];
}

function retrieve(question) {
  const queryTerms = terms(question);
  const normalizedQuestion = clean(question);

  return knowledge.entries
    .map((entry) => {
      const title = clean(entry.title);
      const series = clean(entry.series);
      const body = clean([
        entry.summary,
        ...(entry.topics || []),
        entry.searchText,
      ].join(' '));

      let score = 0;
      for (const term of queryTerms) {
        if (title.includes(term)) score += 8;
        if (series.includes(term)) score += 5;
        if (body.includes(term)) score += 2;
      }

      if (/who is azhan|about azhan|experience|skills|projects|portfolio/.test(normalizedQuestion) && entry.type === 'profile') score += 25;
      if (/agent/.test(normalizedQuestion) && entry.series === 'AI Agent Builder') score += 4;
      if (/work|copilot|productivity|meeting|email/.test(normalizedQuestion) && entry.series === 'AI at Work') score += 4;
      if (/data|power bi|sql|fabric|analyst/.test(normalizedQuestion) && entry.series === 'AI & Data Mastery') score += 4;

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ entry }) => entry);
}

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
}

exports.handler = async function handler(event) {
  // The model is deliberately defined inside the handler so it cannot be
  // removed or lose scope during Netlify's function bundling process.
  const modelName = String(process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
  const buildVersion = 'ask-azhan-fresh-v3-2026-08-07';

  if (event.httpMethod === 'OPTIONS') return reply(204, {});

  if (event.httpMethod === 'GET') {
    return reply(200, {
      ok: true,
      service: 'Ask Azhan AI',
      runtime: 'Node.js Netlify Function',
      apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      model: modelName,
      buildVersion,
    });
  }

  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return reply(503, {
      error: 'Ask Azhan AI is not configured. Add GEMINI_API_KEY in Netlify and redeploy.',
      code: 'MISSING_GEMINI_KEY',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { error: 'Invalid request body.' });
  }

  const question = String(payload.question || '').trim();
  if (!question || question.length > 600) {
    return reply(400, { error: 'Enter a question of up to 600 characters.' });
  }

  const matches = retrieve(question);
  const context = matches.length
    ? matches
        .map((entry, index) =>
          [
            `SOURCE ${index + 1}`,
            `Title: ${entry.title}`,
            `Series: ${entry.series || 'Portfolio'}`,
            entry.episode ? `Episode: ${entry.episode}` : '',
            `Summary: ${entry.summary}`,
            `Topics: ${(entry.topics || []).join(', ')}`,
            `URL: ${entry.url}`,
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n')
    : 'No closely matching source was found.';

  const history = Array.isArray(payload.history)
    ? payload.history
        .slice(-6)
        .map((item) => `${item.role}: ${String(item.text || '').slice(0, 700)}`)
        .join('\n')
    : 'None';

  const prompt = `You are Ask Azhan AI, the helpful guide for Syed Azhan Hassan's professional portfolio.
Answer only from the supplied context. Be concise, practical, and friendly.
Never invent credentials, jobs, projects, or episode details.
If the context does not support an answer, say the portfolio does not cover it yet.
Mention the exact series and episode when relevant.
Do not print raw URLs because the interface adds source buttons.

PORTFOLIO CONTEXT
${context}

RECENT CONVERSATION
${history || 'None'}

VISITOR QUESTION
${question}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
        },
      }),
    });

    const data = await geminiResponse.json().catch(() => ({}));

    if (!geminiResponse.ok) {
      console.error('Gemini API error', geminiResponse.status, JSON.stringify(data));
      const upstreamMessage = data?.error?.message || '';
      let publicMessage = 'Gemini could not answer right now. Please try again shortly.';

      if (geminiResponse.status === 400 || geminiResponse.status === 404) {
        publicMessage = `The configured Gemini model is unavailable: ${modelName}.`;
      }
      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        publicMessage = 'Gemini rejected the API key. Update GEMINI_API_KEY in Netlify.';
      }
      if (geminiResponse.status === 429) {
        publicMessage = 'The Gemini quota has been reached. Please try again later.';
      }

      return reply(502, {
        error: publicMessage,
        code: 'GEMINI_API_ERROR',
        details: upstreamMessage.slice(0, 240),
        model: modelName,
      });
    }

    const answer = extractText(data);
    if (!answer) {
      return reply(502, { error: 'Gemini returned an empty response.' });
    }

    const sources = matches.slice(0, 4).map((entry) => ({
      label:
        entry.type === 'episode'
          ? `${entry.series} · Episode ${entry.episode}`
          : 'About Azhan',
      url: entry.url,
    }));

    return reply(200, { answer, sources, model: modelName });
  } catch (error) {
    console.error('Ask Azhan error', error);
    return reply(500, {
      error: 'The server could not reach Gemini. Please try again shortly.',
      code: 'FUNCTION_ERROR',
    });
  }
};
