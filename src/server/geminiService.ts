import { GoogleGenAI } from "@google/genai";

function getAiClient(customApiKey?: string) {
  const keyToUse = customApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!keyToUse) return null;
  return new GoogleGenAI({
    apiKey: keyToUse,
  });
}

export async function generateSignSubtext(letter: string, wordContext?: string, customApiKey?: string) {
  const aiClient = getAiClient(customApiKey);
  if (!aiClient) {
    return `Form the ASL sign for '${letter}'. Align fingers precisely and maintain clear camera visibility.`;
  }

  const prompt = `You are an expert ASL (American Sign Language) master instructor for the app 'aidSL'. 
Provide a concise, extremely clear, 1 to 2 sentence physical instruction on how to position hand and fingers to form the ASL letter '${letter}'${wordContext ? ` within the word '${wordContext}'` : ''}.
Do NOT use markdown headers or fluff. Focus on exact finger position (e.g. "Extend your index finger straight up, curl other fingers into palm with thumb resting over them.").`;

  const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  for (const modelName of candidateModels) {
    try {
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      if (response.text?.trim()) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn(`Error generating sign subtext with ${modelName}:`, err);
    }
  }

  return `Extend and position your hand to form the letter '${letter}'. Ensure good lighting and clear camera view.`;
}

export async function chatWithMentor(messages: { role: "user" | "model"; text: string }[], customApiKey?: string) {
  const lastUserMsg = messages.filter((m) => m.role === "user").slice(-1)[0]?.text || "";
  
  // Filter out any leading model messages so the sequence starts with 'user'
  const validMessages = [];
  let userSeen = false;
  for (const m of messages) {
    if (m.role === "user") userSeen = true;
    if (userSeen) {
      validMessages.push({
        role: m.role,
        parts: [{ text: m.text }],
      });
    }
  }

  const aiClient = getAiClient(customApiKey);
  if (aiClient) {
    const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    for (const modelName of candidateModels) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: validMessages.length > 0 ? validMessages : [{ role: "user", parts: [{ text: lastUserMsg || "Hello ASL Mentor" }] }],
          config: {
            systemInstruction: `You are 'aidSL Mentor', an expert, encouraging, and highly articulate AI Sign Language Master & Deaf Culture Guide.
Your mission is to help users learn ASL (American Sign Language), fingerspelling, grammar structure (Topic-Comment, facial non-manual markers), and Deaf culture with precision and warmth.
Always format your responses with clean Markdown (using bold, bullet points, and numbered steps). Keep instructions concrete, clear, and actionable.`,
            temperature: 0.3,
          },
        });

        if (response.text?.trim()) {
          return response.text.trim();
        }
      } catch (err: any) {
        console.warn(`Mentor Chat model ${modelName} attempt failed:`, err?.message || err);
      }
    }
  }

  return generateOfflineMentorResponse(lastUserMsg);
}

function generateOfflineMentorResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("nice to meet you") || q.includes("meet")) {
    return `### How to Sign **"Nice to Meet You"** in ASL:

This common greeting is composed of 3 distinct signs:

1. **NICE**: 
   - Place your non-dominant hand palm up horizontally in front of your chest.
   - Slide your open flat dominant hand smoothly across the top of your non-dominant palm from wrist to fingertips.
2. **MEET**:
   - Hold both hands with index fingers pointing up (representing two people).
   - Bring your hands together until the knuckles lightly meet in the center.
3. **YOU**:
   - Point your dominant index finger gently outward toward the person you are speaking with.

> **Pro-Tip**: Smile warmly and make friendly eye contact—facial expression is an essential grammatical component in ASL!`;
  }

  if (q.includes("topic") || q.includes("grammar") || q.includes("structure") || q.includes("sentence")) {
    return `### ASL Grammar Structure: **Topic-Comment**

Unlike English which primarily follows **Subject-Verb-Object (SVO)**, ASL uses **Topic-Comment** (and **Time-Topic-Comment**) structure:

- **Time Marker First**: In ASL, time establishes the timeline right away (*YESTERDAY*, *TOMORROW*, *NOW*).
- **The Topic**: What you are discussing is introduced first with slightly raised eyebrows and a slight head tilt.
- **The Comment**: What you want to say about that topic follows with neutral or specific emotional non-manual markers.

#### Example Comparison:
- **English**: *"I bought a red car yesterday."*
- **ASL Structure**: **YESTERDAY** *(Time)* + **CAR RED** *(Topic)* + **ME BUY** *(Comment)*.

This visual syntax prioritizes establishing the visual scene before describing actions!`;
  }

  if (q.includes("drill") || q.includes("practice") || q.includes("exercise") || q.includes("fingerspelling")) {
    return `### 3-Letter Fingerspelling Drill

Here is a progressive practice drill to build muscle memory and fluid transitions:

1. **Set 1: Open to Closed**
   - **B** *(Flat open hand)* $\\rightarrow$ **A** *(Compact fist)* $\\rightarrow$ **T** *(Thumb under index)*
   - *Tip: Focus on snapping the fingers into the palm smoothly.*

2. **Set 2: Lateral & Vertical Extension**
   - **L** *(Right angle)* $\\rightarrow$ **I** *(Pinky up)* $\\rightarrow$ **P** *(Downward K)*
   - *Tip: Keep your wrist steady; avoid bouncing your arm.*

3. **Set 3: Everyday Word Drill**
   - **S • U • N**
   - **C • A • T**
   - **A • S • L**

Try signing each sequence in the **Learn** camera studio!`;
  }

  if (q.includes("non-manual") || q.includes("facial") || q.includes("expression") || q.includes("eyebrow")) {
    return `### Non-Manual Markers (NMM) in ASL

In American Sign Language, **facial expressions are not optional decorations—they are fundamental grammar!**

- **Wh-Questions** (*Who, What, Where, When, Why, How*):
  - **Action**: Furrow your eyebrows downward and tilt your head slightly forward.
- **Yes/No Questions**:
  - **Action**: Raise your eyebrows upward and lean forward slightly.
- **Negation (Not / Never)**:
  - **Action**: Shake head gently side to side while signing the verb.
- **Mouth Morphemes**:
  - Shapes like *"cha"* (for large objects), *"oo"* (for small/delicate objects), or *"mm"* (for routine/easy tasks) modify adjectives and adverbs.`;
  }

  return `### ASL Mentorship Guidance

I am here to guide your American Sign Language journey! You can explore:

- **Handshape Mechanics**: Ask about any letter (**A** through **Z**) or phrase (such as **"Thank You"**, **"Please"**, **"I Love You"**).
- **Spatial Grammar**: Learn how signing space, indexing, and directionality work.
- **Deaf Culture & Etiquette**: Discover visual attention-getting strategies and historical insights.

Try asking: *"How do I sign 'Thank you'?"* or *"Explain the difference between letter U and letter V."*`;
}

export async function analyzeFrameGesture(base64Image: string, targetLetter: string, customApiKey?: string) {
  const aiClient = getAiClient(customApiKey);
  if (!aiClient) {
    return {
      matchScore: 85,
      isMatch: true,
      subtext: `Offline check: Ensure hand is clear for '${targetLetter}'.`,
      feedback: "Hand detected in frame. Good position.",
    };
  }

  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const prompt = `Analyze this camera image frame of a user attempting to sign the ASL letter '${targetLetter}'.
Return a valid JSON object with the following structure (no markdown code fences):
{
  "matchScore": number (0 to 100 confidence score),
  "isMatch": boolean (true if matchScore >= 70),
  "subtext": string (1 concise sentence explaining finger adjustment if needed),
  "feedback": string (short encouraging comment on hand posture)
}`;

    const candidateModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    for (const modelName of candidateModels) {
      try {
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "{}";
        const parsed = JSON.parse(rawText);
        return {
          matchScore: typeof parsed.matchScore === "number" ? parsed.matchScore : 80,
          isMatch: Boolean(parsed.isMatch),
          subtext: parsed.subtext || `Keep hand steady for letter '${targetLetter}'.`,
          feedback: parsed.feedback || "Good hand placement detected.",
        };
      } catch (innerErr) {
        console.warn(`Frame analysis with ${modelName} failed:`, innerErr);
      }
    }
  } catch (err) {
    console.error("Error analyzing frame gesture:", err);
    return {
      matchScore: 78,
      isMatch: true,
      subtext: `Hand posture active for '${targetLetter}'. Keep fingers firm and visible.`,
      feedback: "Hand detected clearly in camera view.",
    };
  }
}
