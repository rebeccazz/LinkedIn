// 🔧 1. Extract titles
function extractTitles(experienceBlocks) {
  const current = experienceBlocks[0]?.textBlock || "";
  const previous = experienceBlocks[1]?.textBlock || "";

  return {
    currentTitle: current.split("\n")[0] || "",
    previousTitle: previous.split("\n")[0] || ""
  };
}

// 🔧 2. Build prompt
function buildPrompt({ currentTitle, previousTitle }) {
  return `
You are writing a LinkedIn connection request opener.

Write ONE sentence in this EXACT style:
"really cool that you have such deep expertise leading [specific functional area]."

Rules:
- start with lowercase "really"
- max 150 characters
- no "..."
- sound natural, not robotic
- extract the FUNCTIONAL EXPERTISE from the roles

Mapping guidance:
- GTM / growth / sales → "go-to-market and growth"
- brand / marketing → "brand and marketing strategy"
- BD → "business development and partnerships"
- product → "product and platform development"
- CEO/founder → "strategy and operations"
- operations → "operations and execution"

If both roles are useful:
→ combine into 1 phrase (e.g. "go-to-market and brand strategy")

If unclear:
→ default to "strategy and operations"

Input:
Current role: ${currentTitle}
Previous role: ${previousTitle}

Output ONLY the sentence.
`;
}

// 🔧 3. Call Gemini
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

  console.log("Gemini response:", data);

  return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
}

// 🔧 4. Button click
document.getElementById("generate").onclick = async () => {
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");

  // 🔥 show loading immediately
  let seconds = 0;
  statusEl.innerText = "Generating... 0s";

  const interval = setInterval(() => {
    seconds++;
    statusEl.innerText = `Generating... ${seconds}s`;
  }, 1000);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const profile = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PROFILE"
    });

    const { currentTitle, previousTitle } = extractTitles(profile.experienceBlocks);

    const prompt = buildPrompt({ currentTitle, previousTitle });

    let result = await callGemini(prompt);

    // cleanup
    result = result
      .replace(/^"|"$/g, "")
      .replace(/\n/g, " ")
      .trim();

    outputEl.innerText = result;

    // auto copy
    navigator.clipboard.writeText(result);

  } catch (err) {
    outputEl.innerText = "Error generating message";
    console.error(err);
  }

  // 🔥 stop timer
  clearInterval(interval);
  statusEl.innerText = "Done";
};