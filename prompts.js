// Experience-based personalized message prompt
function buildExperiencePrompt({ currentTitle, currentDescription, previousTitle, currentCompany, previousCompany }) {
  return `
#CONTEXT#
You are generating a single personalized sentence based on a person's LinkedIn roles and company history. You must follow a strict sentence template, select concise company name fragments (omit suffixes like Inc, LLC, Corp), and handle cases where no previous company exists. Use only the provided input fields exactly as given.

#OBJECTIVE#
Generate EXACTLY this sentence structure (do not deviate):
"really cool background in [PHRASE] from [PREV] to [CURRENT]."
OR if no previous company:
"really cool background in [PHRASE] at [CURRENT]."

#CRITICAL RULES - FOLLOW EXACTLY:
1. START: "really cool background in" (lowercase r, always use this phrase)
2. PHRASE (after "in"):
   - Combine DescriptorA, DescriptorB, DescriptorC into ONE natural phrase
   - Example inputs: Title="VP Sales", Desc="enterprise software", PrevTitle="CTO"
   - Example output phrase: "enterprise software and sales strategy"
   - Be concise, use lowercase nouns, don't repeat company names
3. COMPANIES:
   - Remove suffixes: Inc, LLC, Ltd, Corp, Co, Company, PLC, etc.
   - Shorten long names to 1-3 words
   - If same company: use "at [company]" format (not "from X to X")
4. END: period (.) - single period only
5. NEVER use "expertise leading" - ALWAYS use "background in [phrase]"

#EXAMPLES#
- Input: DescriptorA="public sector sales", DescriptorB="government partnerships", DescriptorC="strategic accounts", PreviousCompany="Agoria", CurrentCompany="Microsoft"
  Output: "really cool background in public sector sales strategy and government partnerships from Agoria to Microsoft."
- Input: DescriptorA="customer success", DescriptorB="SaaS operations", DescriptorC="B2B enablement", PreviousCompany="", CurrentCompany="BrightPath Analytics"
  Output: "really cool background in customer success and SaaS operations at BrightPath Analytics."

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
