const express = require('express');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// ===== GROQ ENDPOINT (for blue button) =====
app.post('/api/groq', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const apiKey = process.env.Claude;

  if (!apiKey) {
    return res.status(500).json({ error: "Claude API key not configured - set Claude env var" });
  }

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
        max_tokens: 200,
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

    return res.status(200).json({ content });
  } catch (error) {
    console.error("Error calling Claude API:", error);
    return res.status(500).json({ error: "Failed to call Claude API" });
  }
});

// ===== PERSONALIZE ENDPOINT (for green button) =====
app.post('/api/personalize', async (req, res) => {
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
    return res.status(500).json({ error: "Claude API key not configured - set Claude env var" });
  }

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
});

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
  let dataPoints = [];

  if (currentRole && currentCompany) {
    dataPoints.push(`Now: ${currentRole} at ${currentCompany}`);
  }

  if (previousRole && previousCompany && previousCompany !== currentCompany) {
    dataPoints.push(`Before: ${previousRole} at ${previousCompany}`);
  }

  if (yearsInIndustry && yearsInIndustry > 0) {
    dataPoints.push(`Years: ~${yearsInIndustry}`);
  }

  if (education && education.school) {
    dataPoints.push(`School: ${education.school}`);
  }

  if (volunteerWork && volunteerWork.org) {
    dataPoints.push(`Volunteer: ${volunteerWork.role} at ${volunteerWork.org}`);
  }

  const dataSection = dataPoints.join('\n');

  const hasLongCareer = yearsInIndustry && yearsInIndustry >= 15;
  const vibeChoice = hasLongCareer ? "cool path" : "really cool background";

  return `
You are writing a personalized LinkedIn opener for someone's outreach.

YOUR VOICE: Warm, casual, conversational. Like a friend who glanced at their profile.

PRIMARY VIBE TO USE: "${vibeChoice}"
${hasLongCareer ? `(Long career detected: ~${yearsInIndustry} years - "cool path" is appropriate)` : `(Typical career - stick with "really cool background")`}

STRUCTURE (always lead with this vibe, then interesting detail):
- "Hi [Name], ${vibeChoice} in [skills/role details] at [company] and/or [other details]."

KEY RULES:
- Start with "Hi ${firstName},"
- Lead with VIBE: "${vibeChoice}"
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
- "Hi Sarah, really cool background in product strategy and sales at Acme and SaaS Co."
- "Hi Robert, cool path building enterprise software over 20+ years at Diversified."
- "Hi James, really cool background in nonprofit operations moving into enterprise leadership."

Generate ONE opener. Output ONLY the text, nothing else.
`;
}

// ===== COMPANY LOOKUP ENDPOINT (Apollo "what the company does") =====
function firstSentence(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^.*?[.!?](\s|$)/);
  let sentence = match ? match[0].trim() : clean;
  if (sentence.length > 160) sentence = sentence.slice(0, 157).trim() + "…";
  return sentence;
}

function extractDomain(websiteUrl) {
  if (!websiteUrl) return "";
  try {
    const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return websiteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

async function apolloEnrichByDomain(domain, apolloApiKey) {
  if (!domain) return null;
  const resp = await fetch(
    `https://api.apollo.io/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { method: "GET", headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloApiKey } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.organization || null;
}

async function distillDescription(name, description, claudeApiKey) {
  if (!description) return "";
  if (!claudeApiKey) return firstSentence(description);

  const prompt = `In 7 to 10 words, say what this company does. Be specific and factual. No fluff, no period, no quotes. Return ONLY the phrase.

Company: ${name}
Description: ${description}

7-10 word phrase:`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": claudeApiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 40, messages: [{ role: "user", content: prompt }] })
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text?.trim().replace(/^"|"$/g, "");
    return text || firstSentence(description);
  } catch (err) {
    console.error("Claude distill failed:", err);
    return firstSentence(description);
  }
}

app.post('/api/company-lookup', async (req, res) => {
  const { companyName } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: "Missing companyName" });
  }

  const apolloApiKey = process.env.APOLLO_API_KEY;
  const claudeApiKey = process.env.Claude;

  if (!apolloApiKey) {
    return res.status(500).json({ error: "Apollo API key not configured - set APOLLO_API_KEY env var" });
  }

  try {
    const apolloResponse = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloApiKey },
      body: JSON.stringify({ q_organization_name: companyName, page: 1, per_page: 1 })
    });

    const apolloData = await apolloResponse.json();

    if (!apolloResponse.ok) {
      console.error("Apollo search error:", apolloResponse.status, apolloData);
      return res.status(502).json({
        error: "Apollo API error",
        apolloStatus: apolloResponse.status,
        apolloMessage: apolloData?.error || apolloData?.message || JSON.stringify(apolloData),
        companyName
      });
    }

    const organizations = apolloData.organizations || apolloData.accounts || [];
    if (organizations.length === 0) {
      return res.status(404).json({ error: "Company not found on Apollo.io", companyName });
    }

    let company = organizations[0];
    let description = company.short_description || company.description || "";

    if (!description) {
      const domain = company.primary_domain || extractDomain(company.website_url);
      const enriched = await apolloEnrichByDomain(domain, apolloApiKey);
      if (enriched) {
        company = enriched;
        description = enriched.short_description || enriched.description || "";
      }
    }

    const distilled = await distillDescription(company.name || companyName, description, claudeApiKey);

    return res.status(200).json({
      companyName: company.name || companyName,
      description: distilled,
      fullDescription: description,
      website: company.website_url || "",
      industry: company.industry || "",
      employees: company.estimated_num_employees || ""
    });
  } catch (error) {
    console.error("Error looking up company:", error);
    return res.status(500).json({ error: "Failed to lookup company", message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Local server running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Local server running on http://localhost:${PORT}`);
  console.log(`📝 Make sure Claude API key is set: export Claude=YOUR_KEY`);
  console.log(`📝 For company descriptions: export APOLLO_API_KEY=YOUR_KEY`);
  console.log(`🔗 Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/groq`);
  console.log(`   POST http://localhost:${PORT}/api/personalize`);
  console.log(`   POST http://localhost:${PORT}/api/company-lookup`);
});
