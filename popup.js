// ===== 🔧 CONFIG =====
const DEBUG = true;

// ===== 🔧 1. Extract experience =====
function extractExperience(experienceBlocks) {
  return {
    currentCompany:      experienceBlocks[0]?.company || "",
    currentTitle:        experienceBlocks[0]?.title || "",
    currentDate:         experienceBlocks[0]?.date || "",
    currentDescription:  experienceBlocks[0]?.description || "",
    previousCompany:     experienceBlocks[1]?.company || "",
    previousTitle:       experienceBlocks[1]?.title || "",
    previousDescription: experienceBlocks[1]?.description || ""
  };
}

// ===== 🔧 2. Prompt builder =====
function buildPrompt({ currentTitle, currentDescription, previousTitle, currentCompany, previousCompany }) {
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

// ===== 🔧 3. Gemini call =====
async function callGemini(prompt) {
  const response = await fetch(`${CONFIG.API_URL}?key=${CONFIG.API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await response.json();

  console.log("🤖 Gemini response:", data);

  return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
}

// ===== 🔧 4. UI helpers =====
function setStatus(text) {
  document.getElementById("status").innerText = text;
}

function setOutput(text) {
  document.getElementById("output").innerText = text;
}

// ===== 🔧 5. Main click handler =====
document.getElementById("generate").onclick = async () => {
  const statusEl = document.getElementById("status");

  let seconds = 0;
  setStatus("Generating... 0s");

  const interval = setInterval(() => {
    seconds++;
    setStatus(`Generating... ${seconds}s`);
  }, 1000);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const profile = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PROFILE"
    });

    console.log("📊 Full profile:", profile);

    const exp = extractExperience(profile.experienceBlocks);

    // ===== 🔍 DEBUG MODE =====
    if (DEBUG) {
      const generated = await callGemini(buildPrompt(exp));
      const debugText = [
        "--- Current ---",
        `Company: ${exp.currentCompany}`,
        `Title: ${exp.currentTitle}`,
        `Time: ${exp.currentDate}`,
        `Description: ${exp.currentDescription}`,
        "",
        "--- Previous ---",
        `Company: ${exp.previousCompany}`,
        `Title: ${exp.previousTitle}`,
        `Description: ${exp.previousDescription}`,
        "",
        "--- Generated ---",
        generated.trim()
      ].join("\n");
      setOutput(debugText);
      clearInterval(interval);
      setStatus("Debug mode");
      return;
    }

    // ===== 🧠 NORMAL MODE =====
    let result = await callGemini(buildPrompt(exp));

    result = result
      .replace(/^"|"$/g, "")
      .replace(/\n/g, " ")
      .trim();

    setOutput(result);

    navigator.clipboard.writeText(result);

    clearInterval(interval);
    setStatus("Copied ✓");

  } catch (err) {
    console.error(err);
    clearInterval(interval);
    setOutput("Error generating message");
    setStatus("Error");
  }
};
