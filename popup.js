// ===== 🔧 CONFIG =====
// Load custom message from storage on popup open
chrome.storage.local.get("closingMessage", ({ closingMessage }) => {
  if (closingMessage) {
    document.getElementById("closing-message").value = closingMessage;
    updateCharCount();
  }
});

// Auto-save custom message (debounced) and update display
let saveTimeout;
document.getElementById("closing-message").addEventListener("input", () => {
  updateCharCount();
  updateOptionDisplay();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({ closingMessage: document.getElementById("closing-message").value });
  }, 500);
});

// Update display with closing message appended
function updateOptionDisplay() {
  const closingText = document.getElementById("closing-message").value.trim();
  const option1Base = document.getElementById("option1-output").getAttribute("data-base-text") || "";
  const option2Base = document.getElementById("option2-output").getAttribute("data-base-text") || "";

  const option1Full = closingText ? `${option1Base} ${closingText}` : option1Base;
  const option2Full = closingText ? `${option2Base} ${closingText}` : option2Base;

  document.getElementById("option1-output").innerText = option1Full;
  document.getElementById("option2-output").innerText = option2Full;
}

// Update character count
function updateCharCount() {
  const closingText = document.getElementById("closing-message").value;
  const option1Base = document.getElementById("option1-output").getAttribute("data-base-text") || "";
  const option2Base = document.getElementById("option2-output").getAttribute("data-base-text") || "";

  const totalOpt1 = option1Base.length + (closingText ? 1 + closingText.length : 0);
  const totalOpt2 = option2Base.length + (closingText ? 1 + closingText.length : 0);

  const charCountEl = document.getElementById("char-count");
  charCountEl.innerText = `${totalOpt1} / 300 chars (Option 1) | ${totalOpt2} / 300 chars (Option 2)`;

  if (totalOpt1 > 300 || totalOpt2 > 300) {
    charCountEl.style.color = "red";
  } else {
    charCountEl.style.color = "gray";
  }
}

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

// ===== 🔧 2. Prompt builder based on client's experience =====
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

// ===== 🔧 2b. Prompt builder based on client's posts =====
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

// ===== 🔧 3. Groq API call =====
async function callGemini(prompt) {
  const response = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  });

  const data = await response.json();

  console.log("🤖 Groq response:", data);

  return data.choices?.[0]?.message?.content || JSON.stringify(data);
}

// ===== 🔧 4. UI helpers =====
function setStatus(text) {
  document.getElementById("status").innerText = text;
}

function setOutput(text) {
  document.getElementById("output").innerText = text;
}

// ===== 🔧 5. Copy button handlers =====
document.getElementById("option1-copy").onclick = () => {
  const fullText = document.getElementById("option1-output").innerText;
  navigator.clipboard.writeText(fullText);
  setStatus("Copied ✓");
  setTimeout(() => setStatus(""), 2000);
};

document.getElementById("option2-copy").onclick = () => {
  const fullText = document.getElementById("option2-output").innerText;
  navigator.clipboard.writeText(fullText);
  setStatus("Copied ✓");
  setTimeout(() => setStatus(""), 2000);
};

// ===== 🔧 6. Main click handler =====
document.getElementById("generate").onclick = async () => {
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
    const firstName = profile.name?.split(" ")[0] || "there";

    // Generate Option 1 (experience)
    const option1Prompt = buildExperiencePrompt(exp);
    const option1Result = await callGemini(option1Prompt);
    let option1Text = option1Result
      .replace(/^"|"$/g, "")
      .replace(/\n/g, " ")
      .trim();
    option1Text = `Hi ${firstName}, ${option1Text}`;

    document.getElementById("option1-output").setAttribute("data-base-text", option1Text);
    document.getElementById("option1-output").style.display = "inline-block";
    document.getElementById("option1-copy").style.display = "inline-block";

    // Generate Option 2 (recent post/comment)
    let option2Text = "No posts or comments within 3 months found";
    if (profile.recentActivity && profile.recentActivity.length > 0) {
      const firstActivity = profile.recentActivity[0];
      const option2Prompt = buildInsightPrompt(firstActivity.text);
      const option2Result = await callGemini(option2Prompt);
      option2Text = option2Result
        .replace(/^"|"$/g, "")
        .replace(/\n/g, " ")
        .trim();
      option2Text = `Hi ${firstName}, ${option2Text}`;
      document.getElementById("option2-copy").style.display = "inline-block";
    }

    document.getElementById("option2-output").setAttribute("data-base-text", option2Text);
    document.getElementById("option2-output").style.display = "inline-block";

    updateCharCount();
    updateOptionDisplay();

    clearInterval(interval);
    setStatus("Done");

  } catch (err) {
    console.error(err);
    clearInterval(interval);
    document.getElementById("option1-output").innerText = "Error generating message";
    document.getElementById("option2-output").innerText = "Error";
    setStatus("Error");
  }
};
