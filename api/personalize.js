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

  const apiKey = process.env.Claude;

  if (!apiKey) {
    return res.status(500).json({ error: "Claude API key not configured on server" });
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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const content = data.content?.[0]?.text;

    return res.status(200).json({ personalizationOpener: content });
  } catch (error) {
    console.error("Error calling Claude API:", error);
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
- React naturally to what you see. Be genuine and casual.
- Tone should be warm, friendly, like a smart friend glancing at their profile.
- Use simple, casual words: "cool," "neat," "wild," "super" over formal words like "compelling," "impressive," "notable."
- If there's a career pivot or interesting transition, lead with that.
- If data is sparse, just acknowledge what's there simply.

STRICT PROFILE DATA (use ONLY this information):
${dataSection}

TONE EXAMPLES (adapt but follow this style - casual & genuine):
- "Hi Rebecca, going from Founder and CEO at Calcu to Head of GTM at Blueiot - that's a cool shift."
- "Hi Allan, HVAC sales at Unique before jumping to insurance at Allegiance - super differentiated."
- "Hi Kelly, managed a missing children program at ADVO before moving to corporate insurance at Allegiance - neat how that carries over."
- "Hi Robert, 15 years building Diversified - much respect to that depth."

Generate ONE personalized opener using ONLY the facts above. Do not add details, years, companies, or context that isn't explicitly listed.

Output only the opener text, nothing else.
`;
}
