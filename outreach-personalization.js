// ===== LINKEDIN BENEFITS OUTREACH PERSONALIZATION SYSTEM =====
// Combined workflow: detailed personalization guidelines + Claude Code browsing

// ===== CONTEXT: WHO REBECCA IS =====
const REBECCA_CONTEXT = `
Georgia Tech undergrad, mechanical engineering
Did boxing in college
Was part of AIESEC (global volunteer/exchange organization) in college
Founded Zero to Close (outbound sales company)
Has sold to self-insured employers -- understands the group health and employee benefits buyer deeply
`;

// ===== ICP DEFINITION =====
const ICP_DEFINITION = `
Senior and above contacts (partners, VPs, directors, account managers, principals, owners) at firms that sell
employee benefits or group health insurance to employers -- brokers, consultants, and agency owners.

NOT ICP if they are:
- Carrier-side staff
- Tech company employees
- Recruiters
- HR practitioners at regular companies (buyers, not sellers)
- Non-US contacts
`;

// ===== EXTRACTION FIELDS FROM LINKEDIN =====
const EXTRACTION_FIELDS = [
  "Current role and company",
  "Most recent previous company (before current)",
  "Rough years in the industry",
  "University/college (flag if Georgia Tech or ACC/SEC school)",
  "Any volunteer work or causes",
  "Any founder/entrepreneur story (started own firm, big career pivot)",
  "Overlap with Rebecca: engineering background, boxing/combat sports, AIESEC, self-insured employer sales"
];

// ===== TONE GUIDELINES (CRITICAL) =====
const TONE_GUIDELINES = `
REBECCA'S VOICE: warm, casual, short, direct. Think quick DM energy from a smart friend who genuinely glanced at the profile.

CORE STRUCTURE: [specific detail from profile] + [quick punchy reaction]

KEY RULES:
1. React to what you see -- don't explain why it's interesting or what it means for their career. Just react.
2. Keep to 1-2 short sentences max. Lowercase energy is fine. "haha" is allowed.
3. NEVER insert Rebecca into the line. No "as someone who also went the founder route." The line is about THEM, not Rebecca.
4. NEVER write bridge explanations like "that X background translates well into Y." Just say what's cool about it.
5. ANCHOR to specific details: actual company name, actual role title, actual org. Specificity = human.
6. No career recaps -- but DO use 2-3 specific data points if they flow naturally into one punchy sentence.
7. YEARS -- convert to natural language:
   - ~17-19 years = "almost two decades"
   - ~20+ years = "two decades" or "over two decades"
   - ~11-14 years = "over a decade"
   - ~8-9 years = "almost a decade"
   - 5-7 years, or in-between like 16 = just use the number
   - Round numbers like 25 = "almost 25 years" or "25 years"
8. Avoid industry acronyms (CIC, CRM, NABIP, TPA, etc.) -- write out or skip.
9. Avoid obscure org names -- say "triathlons" not the club name.
10. Never include numerical rankings like "#249" -- just say "Inc. 5000 company."
11. Lead with the MOST INTERESTING/UNEXPECTED detail, not the most chronological.
12. Never end with filler: no "happy to connect," "would love to connect," etc.
13. The tone must be clearly a compliment -- nothing backhanded or ambiguous.
14. Only say things actually on their profile. DO NOT infer or invent.
15. Check email address for name preference -- if email is dan@company.com but LinkedIn says Daniel, use Dan.

CLOSER VARIETY (don't always use "impressive!"):
- "impressive!" / "impressive background!" / "genuinely impressive."
- "much respect!" / "much respect to the depth here."
- "what a background." / "what a path." / "what a merge between X and Y."
- "super differentiated." / "super interesting path."
- "wow, genuinely impressive." / "really cool background."
- "what an unexpected but cool path!"

HOOK PRIORITY ORDER:
1. Unusual career pivot INTO insurance (non-insurance background is strongest)
2. Real overlap with Rebecca's background (Georgia Tech, boxing, AIESEC, founder story) -- lead with it, but DO NOT mention Rebecca's background
3. Volunteer work, human/personal detail
4. Career depth/tenure (years + specific companies)
5. Sparse profile -- write plain role-based opener and FLAG it
`;

// ===== GOOD EXAMPLES (Rebecca's actual voice) =====
const GOOD_EXAMPLES = [
  'Hi Allan, your background in HVAC sales at Unique before making the jump to insurance at Allegiance - super differentiated and impressive!',
  'Hi Jason, two decades as the CEO of Applegate before building Allegiance Insurance Brokers - such a wild pivot and much respect!',
  'Hi Kelly, managing a missing children program at ADVO before building corporate insurance at Allegiance - impressive public service mindset carried over.',
  'Hi Miguel, managing sales at Porsche and Aston Martin before making the jump to insurance - what a background in high net worth & SMB sales.',
  'Hi Robert, almost 3 decades building Diversified since 1998 is super impressive - much respect to the depth on group health & supplemental benefits.',
  'Hi Jean, really impressive background in dental hygiene before leading the group health side at Diversified, what an integration of healthcare practice & insurance.',
  'Hi Dan, being a drummer on Royal Caribbean before building InsureYourCompany from 0 to 1 - that\'s an unexpected path into insurance, impressive!',
  'Hi Christine, interesting background as an MA before going deep in insurance at Insure Your Company - what an unexpected but cool path!',
  'Hi Maryanne, over a decade as a teacher at Turtle Creek before making the jump to insurance - what a merge between education and client management.',
  'Hi Ronald, really cool security background in criminal justice before moving to the benefits side, impressive!'
];

// ===== BAD PATTERNS TO AVOID =====
const BAD_PATTERNS = `
1. INSERTING REBECCA -- never do this:
   "Hi Shayne, noticed you spent 15 years as a scientist at GSK before founding your own insurance group - honestly that's a wild pivot, and as someone who also went the founder route, I respect that move a lot."
   ❌ Cut "as someone who also went the founder route"

2. BRIDGE EXPLANATION -- cut the analysis:
   "Hi Allan, your background in HVAC sales at Unique before making the jump to insurance - that commercial sales background translates well into this space, impressive!"
   ❌ Cut "that commercial sales background translates well into this space"

3. TOO COMPREHENSIVE / DOSSIER ENERGY:
   "Hi Shayne, really unique story going from 15 years in pharma at GSK - as a scientist, national training manager, and international marketing manager - to founding and running your own insurance group for nearly two decades."
   ❌ Way too much. Pick one angle.

4. INVENTED DETAIL -- never do this:
   "Hi Tanya, co-founding a brewery while running insurance operations is impressive."
   ❌ If she was GM, not co-founder, never infer.

5. FILLER CLOSER -- always cut:
   "Hi Robin, almost two decades at Pavese-McCormick before Cedar Risk - happy to connect!"
   ❌ "happy to connect" is dead weight.
`;

// ===== FLAGS: DO NOT SEND =====
const DO_NOT_SEND_CRITERIA = `
Mark contact as DO NOT SEND if:
- LinkedIn profile is clearly NOT ICP (carrier-side, tech company, recruiter, HR buyer, non-US, wrong industry)
- Profile belongs to completely different person than intended contact
- It is a duplicate of another contact in the list
`;

// ===== FLAGS: PERSONALIZE MANUALLY =====
const PERSONALIZE_MANUALLY_CRITERIA = `
Mark as PERSONALIZE MANUALLY if:
- LinkedIn profile is too sparse to generate a good opener (no history, no interesting details)
- Profile is blocked/login-walled and you cannot access it
- Unable to extract enough profile details to create personalized line
`;

// ===== WORKFLOW FOR CLAUDE CODE BROWSING =====
function buildOutreachPersonalizationPrompt(contactData) {
  return `
You are generating personalized first-line openers for Rebecca's cold outreach campaign targeting senior contacts at firms that sell employee benefits or group health insurance to employers.

=== STEP 1: VALIDATE ICP ===
Check the LinkedIn profile to confirm this contact is ICP:
${ICP_DEFINITION}

If NOT ICP, flag as DO NOT SEND and provide reason.

=== STEP 2: EXTRACT PROFILE DETAILS ===
From the LinkedIn profile, extract:
${EXTRACTION_FIELDS.map(f => `- ${f}`).join('\n')}

=== STEP 3: IDENTIFY PERSONALIZATION HOOK ===
Using the hook priority order below, select the strongest hook:
1. Unusual career pivot INTO insurance (non-insurance background)
2. Overlap with Rebecca's background (Georgia Tech, boxing/combat sports, AIESEC, founder story) -- lead with it but DO NOT mention Rebecca
3. Volunteer work or human detail
4. Career depth/tenure
5. Sparse profile -- write plain opener and FLAG

=== STEP 4: GENERATE FIRST LINE ===
Tone Guidelines:
${TONE_GUIDELINES}

CONTACT DATA PROVIDED:
- First Name: ${contactData.firstName}
- Last Name: ${contactData.lastName}
- Current Company: ${contactData.company}
- Email: ${contactData.email}
- LinkedIn URL: ${contactData.linkedinUrl}

Write ONE personalized first-line opener following Rebecca's voice and tone. Must be 1-2 sentences, specific, punchy, no filler.

=== STEP 5: VALIDATION ===
Before outputting, check:
✓ Does it anchor to SPECIFIC details (actual names, roles, companies)?
✓ Is it purely reactive, not explanatory?
✓ Does it avoid inserted Rebecca?
✓ No bridge explanations?
✓ No filler closers?
✓ Only things actually on the profile?
✓ Tone is clearly complimentary?

Output format:
---
ICP Status: [VALID / DO NOT SEND / PERSONALIZE MANUALLY]
Hook Used: [specific hook name]
First Line: [the personalized opener]
Notes: [any flags or context]
---
`;
}

// ===== BATCH PROCESSING INSTRUCTIONS =====
const BATCH_INSTRUCTIONS = `
WORKFLOW:
1. Load contacts from spreadsheet (prioritize rows with email)
2. For each contact, navigate to their LinkedIn profile using Claude Code browsing
3. Wait ~20 seconds between profiles to avoid rate limiting
4. Extract the fields listed above
5. Generate one personalized first-line opener per contact
6. Process in batches of 10-15 contacts with a note between batches

BATCH COMPLETION NOTE:
"Batch X complete -- [X of Y contacts processed]. Ready for next batch."

OUTPUT TABLE:
| # | First Name | Last Name | Company | Email | LinkedIn | Hook Used | First Line |

AFTER TABLE:
List any flagged contacts (DO NOT SEND / PERSONALIZE MANUALLY) with reasons.
`;

// Export for use in workflow
const OUTREACH_SYSTEM = {
  rebeccaContext: REBECCA_CONTEXT,
  icpDefinition: ICP_DEFINITION,
  extractionFields: EXTRACTION_FIELDS,
  toneGuidelines: TONE_GUIDELINES,
  goodExamples: GOOD_EXAMPLES,
  badPatterns: BAD_PATTERNS,
  doNotSendCriteria: DO_NOT_SEND_CRITERIA,
  personalizeManuallyFriteria: PERSONALIZE_MANUALLY_CRITERIA,
  buildPersonalizationPrompt: buildOutreachPersonalizationPrompt,
  batchInstructions: BATCH_INSTRUCTIONS
};
