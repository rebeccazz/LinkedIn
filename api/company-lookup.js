// Returns a concise, factual description of what a company does, sourced
// directly from Apollo.io. No LLM rewriting — Apollo's own description is the
// most reliable answer to "what does this company do," so we return it as-is
// (trimmed to one sentence).

function firstSentence(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  // Grab up to the first sentence-ending punctuation; fall back to a hard cap.
  const match = clean.match(/^.*?[.!?](\s|$)/);
  let sentence = match ? match[0].trim() : clean;
  if (sentence.length > 160) sentence = sentence.slice(0, 157).trim() + "…";
  return sentence;
}

// Pull the company slug out of a LinkedIn company URL, e.g.
// "https://www.linkedin.com/company/calcu/" -> "calcu".
function linkedinSlug(url) {
  if (!url) return "";
  const m = url.match(/\/company\/([^\/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : "";
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
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey
      }
    }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.organization || null;
}

// Distill Apollo's company description into a 7-10 word phrase via Claude.
// Falls back to the first sentence if Claude is unavailable or errors.
async function distillDescription(name, description, claudeApiKey) {
  if (!description) return "";
  if (!claudeApiKey) return firstSentence(description);

  const prompt = `In 7 to 8 words (never more than 8), say what this company does. Be specific and factual. Drop adjectives you don't need. No fluff, no period, no quotes. Return ONLY the phrase.

Company: ${name}
Description: ${description}

Phrase (max 8 words):`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 40,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await resp.json();
    const text = data.content?.[0]?.text?.trim().replace(/^"|"$/g, "");
    return text || firstSentence(description);
  } catch (err) {
    console.error("Claude distill failed:", err);
    return firstSentence(description);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { companyName, companyUrl } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: "Missing companyName" });
  }

  const apolloApiKey = process.env.APOLLO_API_KEY;
  const claudeApiKey = process.env.Claude;

  if (!apolloApiKey) {
    return res.status(500).json({ error: "Apollo API key not configured (APOLLO_API_KEY)" });
  }

  try {
    // Step 1: Search by name, asking for several matches so we can disambiguate.
    const apolloResponse = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey
      },
      body: JSON.stringify({
        q_organization_name: companyName,
        page: 1,
        per_page: 10
      })
    });

    const apolloData = await apolloResponse.json();

    // Surface Apollo auth/plan errors clearly instead of a generic 404.
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

    // Step 2: Disambiguate. If we have the profile's LinkedIn company URL, pick
    // the Apollo result whose linkedin_url matches that exact /company/<slug>;
    // otherwise fall back to Apollo's top (most prominent) match.
    const wantSlug = linkedinSlug(companyUrl);
    let company =
      (wantSlug && organizations.find(o => linkedinSlug(o.linkedin_url) === wantSlug)) ||
      organizations[0];
    const matchedByUrl = wantSlug && linkedinSlug(company.linkedin_url) === wantSlug;

    let description = company.short_description || company.description || "";

    // Step 3: Search results often omit the description. If so, enrich by domain.
    if (!description) {
      const domain = company.primary_domain || extractDomain(company.website_url);
      const enriched = await apolloEnrichByDomain(domain, apolloApiKey);
      if (enriched) {
        company = enriched;
        description = enriched.short_description || enriched.description || "";
      }
    }

    // Step 4: Distill to a 7-10 word phrase (per requirements).
    const distilled = await distillDescription(company.name || companyName, description, claudeApiKey);

    return res.status(200).json({
      companyName: company.name || companyName,
      description: distilled,
      fullDescription: description,
      matchedByUrl: !!matchedByUrl,
      linkedinUrl: company.linkedin_url || "",
      website: company.website_url || "",
      industry: company.industry || "",
      employees: company.estimated_num_employees || ""
    });
  } catch (error) {
    console.error("Error looking up company:", error);
    return res.status(500).json({ error: "Failed to lookup company", message: error.message });
  }
}
