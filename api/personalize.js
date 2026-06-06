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
  return `
You are generating a personalized first-line opener for a LinkedIn outreach message. The goal is to make a meaningful connection with someone in the employee benefits or insurance industry.

TONE: Warm, casual, short, direct. Like a quick DM from a smart friend who genuinely glanced at the profile. React to what you see, don't explain why it matters.

RULES:
- Keep to 1-2 short sentences max. Lowercase energy is fine.
- NEVER include "happy to connect" or any filler.
- Anchor to SPECIFIC details: actual company names, actual titles.
- Lead with the most interesting/unexpected detail, not the most chronological.
- React to what you see -- don't explain why it's interesting.
- No bridge explanations like "that background translates well into this space."
- The tone must be clearly complimentary.
- Years: ~17-19 years = "almost two decades", ~20+ = "two decades", ~11-14 = "over a decade", 5-7 = just use the number

CONTEXT DATA:
- First Name: ${firstName}
- Last Name: ${lastName || ''}
- Current Role: ${currentRole}
- Current Company: ${currentCompany}
- Previous Role: ${previousRole || 'N/A'}
- Previous Company: ${previousCompany || 'N/A'}
- Years in Industry: ${yearsInIndustry || 'N/A'}
- Education: ${education ? education.school : 'N/A'}
- Volunteer Work: ${volunteerWork ? volunteerWork.org : 'N/A'}

EXAMPLE GOOD OPENERS:
- "Hi Allan, your background in HVAC sales at Unique before making the jump to insurance at Allegiance - super differentiated and impressive!"
- "Hi Jason, two decades as the CEO of Applegate before building Allegiance Insurance Brokers - such a wild pivot and much respect!"
- "Hi Kelly, managing a missing children program at ADVO before building corporate insurance at Allegiance - impressive public service mindset carried over."

Generate ONE personalized first-line opener. Start with "Hi ${firstName}," and keep it punchy. Focus on the most interesting career detail or transition you can identify from the data.

Output only the opener text, nothing else.
`;
}
