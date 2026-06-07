export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { companyName } = req.body;

  if (!companyName) {
    return res.status(400).json({ error: "Missing companyName" });
  }

  const apolloApiKey = process.env.APOLLO_API_KEY;
  const claudeApiKey = process.env.Claude;

  if (!apolloApiKey) {
    return res.status(500).json({ error: "Apollo API key not configured" });
  }

  if (!claudeApiKey) {
    return res.status(500).json({ error: "Claude API key not configured" });
  }

  try {
    // Step 1: Look up company on Apollo.io
    const apolloResponse = await fetch("https://api.apollo.io/v1/organizations/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({
        api_key: apolloApiKey,
        q_organization_name: companyName,
        limit: 1
      })
    });

    const apolloData = await apolloResponse.json();

    if (!apolloResponse.ok || !apolloData.organizations || apolloData.organizations.length === 0) {
      return res.status(404).json({
        error: "Company not found on Apollo.io",
        companyName
      });
    }

    const company = apolloData.organizations[0];
    const apolloDescription = company.short_description || company.description || "";
    const companyWebsite = company.website_url || "";

    // Step 2: Summarize description with Claude
    let summary = "";
    if (apolloDescription) {
      const summaryPrompt = `Summarize this company description in exactly 7 words. Be specific about what they do. Return ONLY the 7-word summary, nothing else.

Company: ${company.name}
Description: ${apolloDescription}

7-word summary:`;

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-opus-4-8",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: summaryPrompt
            }
          ]
        })
      });

      const claudeData = await claudeResponse.json();
      summary = claudeData.content?.[0]?.text?.trim() || "";
    }

    return res.status(200).json({
      companyName: company.name,
      apolloDescription: apolloDescription,
      summary7words: summary,
      website: companyWebsite,
      industry: company.industry || "",
      employees: company.estimated_num_employees || ""
    });
  } catch (error) {
    console.error("Error looking up company:", error);
    return res.status(500).json({
      error: "Failed to lookup company",
      message: error.message
    });
  }
}
