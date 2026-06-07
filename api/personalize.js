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
    return res.status(400).json({
      error: "Missing required fields",
      received: { firstName, currentRole, currentCompany },
      message: "Make sure you're on a LinkedIn profile with experience listed"
    });
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
You are writing a personalized LinkedIn opener for someone's outreach.

YOUR VOICE: Warm, casual, conversational. Like a friend who glanced at their profile.

STRUCTURE OPTIONS (lead with VIBE, then interesting detail):
1. Background: "Hi [Name], really cool background in [skills] at [company]."
2. Path: "Hi [Name], cool path leading [skills] at [company] and [other role/company]."
3. Depth: "Hi [Name], impressive building [depth/breadth] at [company]."

KEY RULES:
- Start with "Hi ${firstName},"
- Lead with VIBE first: "really cool," "cool path," "impressive," "neat," "much respect"
- Put MOST INTERESTING detail first (not chronologically)
- Be conversational, casual, genuine
- 1-2 sentences max
- NO filler: "would love to connect," "happy to reach out," etc.
- Use ONLY facts below - don't infer or hallucinate
- Save character space - be concise

FACTS (use ONLY these):
${dataSection}

EXAMPLES:
- "Hi Didier, really cool background in public sector strategy and board work at Microsoft and Augoria."
- "Hi Rebecca, cool path from Founder/CEO at Calcu to GTM at Blueiot."
- "Hi Sarah, impressive breadth in both product and sales over 12+ years at Acme."
- "Hi James, neat transition from nonprofit into enterprise software leadership."

Generate ONE opener. Output ONLY the text, nothing else.
`;
}
