export default async function handler(req, res) {
  // CORS headers - must be set before any response
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    firstName,
    lastName,
    currentRole,
    currentCompany,
    previousRole,
    previousCompany,
    yearsInIndustry,
    education,
    volunteerWork
  } = req.body;

  if (!firstName || !currentRole || !currentCompany) {
    return res.status(400).json({ error: "Missing required fields: firstName, currentRole, currentCompany" });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  // Build the personalization prompt
  const prompt = buildPersonalizationPrompt({
    firstName,
    lastName,
    currentRole,
    currentCompany,
    previousRole,
    previousCompany,
    yearsInIndustry,
    education,
    volunteerWork
  });

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const content = data.choices?.[0]?.message?.content;

    return res.status(200).json({ personalizationOpener: content });
  } catch (error) {
    console.error("Error calling Groq:", error);
    return res.status(500).json({ error: "Failed to generate personalization" });
  }
}

function buildPersonalizationPrompt({
  firstName,
  lastName,
  currentRole,
  currentCompany,
  previousRole,
  previousCompany,
  yearsInIndustry,
  education,
  volunteerWork
}) {
  // Build a strict, fact-based prompt that minimizes hallucination
  let dataPoints = [];

  if (currentRole && currentCompany) {
    dataPoints.push(`Currently: ${currentRole} at ${currentCompany}`);
  }

  if (previousRole && previousCompany && previousCompany !== currentCompany) {
    dataPoints.push(`Previously: ${previousRole} at ${previousCompany}`);
  }

  if (yearsInIndustry && yearsInIndustry > 0) {
    dataPoints.push(`Years in industry: ${yearsInIndustry}`);
  }

  if (education && education.school) {
    dataPoints.push(`Education: ${education.school}`);
  }

  if (volunteerWork && volunteerWork.org) {
    dataPoints.push(`Volunteer work: ${volunteerWork.role} at ${volunteerWork.org}`);
  }

  const dataSection = dataPoints.join('\n');

  return `
You are generating a personalized first-line opener for a LinkedIn outreach message targeting the employee benefits/insurance industry.

CRITICAL RULES:
- Use ONLY the facts provided below. Do NOT infer, assume, or hallucinate.
- Never mention years or tenure that isn't explicitly stated.
- Keep to 1-2 short sentences max.
- Start with "Hi ${firstName}," and end with a period.
- NEVER include filler like "happy to connect," "would love to," etc.
- React naturally to what you see. Be genuine.
- If there's a career pivot or interesting transition, lead with that.
- If data is sparse, just acknowledge what's there simply.

STRICT PROFILE DATA (use ONLY this information):
${dataSection}

TONE EXAMPLES (adapt but follow this style):
- "Hi Allan, your background in HVAC sales at Unique before making the jump to insurance at Allegiance - super differentiated and impressive!"
- "Hi Kelly, managing a missing children program at ADVO before building corporate insurance at Allegiance - impressive public service mindset carried over."
- "Hi Robert, 15 years building Diversified since 2008 - much respect to the depth on group health."

Generate ONE personalized opener using ONLY the facts above. Do not add details, years, companies, or context that isn't explicitly listed.

Output only the opener text, nothing else.
`;
}
