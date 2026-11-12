import { NextRequest, NextResponse } from 'next/server';

// Players are anonymous strangers of unknown age: prompts must be safe to hear from someone
// you just met. Bold and fun is good; sexual, hateful, self-harm or identifying content is not.
const SAFETY_RULES = `Rules:
- Suitable for two strangers of any age meeting in a voice chat.
- No sexual or romantic-intimacy content, no drugs, violence, self-harm, politics, religion or hate.
- Never ask for personal identifying details (real name, address, workplace, school, socials).
- Max 160 characters per text field. Plain text, no emojis in the question.`;

const PROMPTS = {
  wyr: `You write "Would You Rather" cards for LuraTalk, an anonymous voice chat app.
Write ONE fun, surprising dilemma where both options are tempting and easy to debate.
${SAFETY_RULES}
Return only JSON: {"optionA": "string", "optionB": "string"}`,
  question: `You write conversation questions for LuraTalk, an anonymous voice chat app.
Write ONE bold, curious question that gets two strangers sharing stories: deep, funny or a hot take.
${SAFETY_RULES}
Return only JSON: {"category": "Deep Talk | Hot Takes | Confessions | What If | Dilemmas | Dreams", "question": "string", "tag": "2-3 word tag"}`,
} as const;

// Blocklist safety net in case the model ignores instructions
const BLOCKED = /\b(sex|sexual|kink|fetish|nude|naked|erotic|porn|horny|bed ?room|hook ?up|lingerie|seduc|drug|suicide|self-harm|kill)/i;

// Simple per-IP rate limit (per server instance): 20 requests / minute
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Client falls back to the curated deck
    return NextResponse.json({ error: 'AI questions are not configured' }, { status: 503 });
  }

  let type: 'wyr' | 'question' = 'question';
  try {
    const body = await req.json();
    if (body?.type === 'wyr') type = 'wyr';
  } catch {
    // default to a question
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPTS[type] }] }],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      console.warn('[AI questions] Gemini error', response.status);
      return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
    }

    const data = await response.json();
    let text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1) throw new Error('No JSON in model output');
    const parsed = JSON.parse(text.substring(first, last + 1));

    const result =
      type === 'wyr'
        ? { optionA: clean(parsed.optionA), optionB: clean(parsed.optionB) }
        : { category: clean(parsed.category, 30), question: clean(parsed.question), tag: clean(parsed.tag, 30) };

    const values = Object.values(result).join(' ');
    const complete = type === 'wyr' ? result.optionA && (result as any).optionB : (result as any).question;
    if (!complete || BLOCKED.test(values)) {
      return NextResponse.json({ error: 'Generation rejected' }, { status: 422 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.warn('[AI questions] generation failed', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
