// Experience-based personalized message prompt
function buildExperiencePrompt({ currentTitle, currentDescription, previousTitle, currentCompany, previousCompany }) {
  return `
#CONTEXT#
You are generating a single personalized sentence based on a person's LinkedIn roles and company history. You must follow a strict sentence template, select concise company name fragments (omit suffixes like Inc, LLC, Corp), and handle cases where no previous company exists. Use only the provided input fields exactly as given.

#OBJECTIVE#
Produce one sentence in the exact structure: "really cool that you have such deep expertise leading XXXX/IN xxxxxx from [previousCompany] to [currentCompany]." Ensure the initial "r" in "really" is lowercase and include a period at the end.

#INSTRUCTIONS#
1. Derive the focus phrase after "leading" or "in":
   - Create a concise, natural phrase from DescriptorA, DescriptorB, and DescriptorC that reflects role scope, function, or area. Use lowercased function/area nouns. Combine or choose the most coherent subset; do not repeat company names.
   - Be specific: CEO/president → "innovation and strategy"; operations roles → "operations"; CTO → "technology and innovation"; product roles → "product"; CFO → "finance and operations". If VP/director but department unclear, say "leading innovation and ops".
2. Company selection and formatting:
   - Normalize each company name by removing suffixes: Inc, Inc., LLC, LLC., Ltd, Ltd., Corp, Corp., Co, Co., Company, PLC, GmbH, S.A., S.L., Pvt, Pte, Pty, BV, NV, AB.
   - If a company name is long, shorten to the first 1–3 significant words.
   - If PreviousCompany and CurrentCompany are the same after normalization, use the fallback "at [currentCompany]" structure.
3. Construct the sentence:
   - Always start with: "really cool that you have such deep expertise".
   - If PreviousCompany is present and differs from CurrentCompany: " leading [derived phrase] from [previousCompany] to [currentCompany]."
   - If PreviousCompany is empty or same as CurrentCompany: " leading [derived phrase] at [currentCompany]."
4. Formatting rules:
   - Keep natural casing except "really" must be lowercase.
   - End with a single period. No extra spaces.

#EXAMPLES#
- Input: DescriptorA="global product strategy", DescriptorB="enterprise sales", DescriptorC="AI platforms", PreviousCompany="Acme Technologies Inc.", CurrentCompany="NextWave Data LLC"
  Output: "really cool that you have such deep expertise leading global product strategy and enterprise sales for ai platforms from Acme Technologies to NextWave Data."
- Input: DescriptorA="customer success", DescriptorB="SaaS operations", DescriptorC="B2B enablement", PreviousCompany="", CurrentCompany="BrightPath Analytics Corp."
  Output: "really cool that you have such deep expertise leading customer success at BrightPath Analytics."

#INPUTS#
DescriptorA: ${currentTitle}
DescriptorB: ${currentDescription}
DescriptorC: ${previousTitle}
PreviousCompany: ${previousCompany}
CurrentCompany: ${currentCompany}

Output only the sentence.
`;
}

// Post-based message prompt (insight/engagement opener)
function buildInsightPrompt(postText) {
  return `
Write a SHORT, natural LinkedIn opener that references someone's post. You are a real person who read it.

Post content: ${postText}

Rules:
- Start with "saw your post" or "read your post"
- MAX 100 characters (keep it tight and punchy)
- Reference ONE specific thing they said—not the general topic
- Sound like a regular person, not marketing copy
- Be direct. No "amazing", "love", "great insights"—just acknowledge what they said
- If you can naturally disagree or add a different angle, that's better than agreement
- Don't use exclamation marks

Examples:
GOOD: "saw your post about quiet quitting—agree on the burnout part but think companies don't care enough to change"
GOOD: "read your post on asynchronous work. dealing with the same timezone issues at our company"
BAD: "love your insights on remote work!" (generic, sounds like AI)
BAD: "saw your amazing post about productivity tips" (too long, too flattery)

Output only the sentence. Must be under 100 chars.
`;
}
