import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { type = 'dark_question', category = 'Dark & Sensual Taboos' } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    let prompt = '';

    if (type === 'wyr') {
      prompt = `You are the AI game master for LuraTalk, an anonymous real-time voice chat app.
Generate a single, high-stakes, seductive, and thrilling "Would You Rather" dark fantasy or sensual dilemma between two deeply tempting, sexy, or morally taboo choices.
Output strictly raw JSON without markdown code blocks, backticks, or extra text in this exact format:
{"optionA": "string", "optionB": "string"}`;
    } else {
      prompt = `You are the AI game master for LuraTalk, an anonymous real-time voice chat app.
Generate a single, deeply provocative, dark fantasy, seductive, sexy, taboo, and unfiltered truth question.
Make it exciting, spicy, psychologically thrilling, and suitable for late-night intimate stranger conversations.
Output strictly raw JSON without markdown code blocks, backticks, or extra text in this exact format:
{"category": "Dark Fantasy & Sexy", "question": "string", "tag": "short 2-3 word tag"}`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[Gemini API Error]', response.status, errText);
      return NextResponse.json({ error: 'Gemini API failed', details: errText }, { status: 502 });
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON between any codeblocks or braces
    let cleanedText = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }
    const parsed = JSON.parse(cleanedText);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.warn('[Gemini Route Error]', err);
    return NextResponse.json({ error: 'Generation failed', message: err?.message }, { status: 500 });
  }
}
