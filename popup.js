// ===== 🔧 CONFIG =====
let currentProfileData = null;

// Load custom message from storage on popup open
chrome.storage.local.get("closingMessage", ({ closingMessage }) => {
  if (closingMessage) {
    document.getElementById("closing-message").value = closingMessage;
    updateCharCount();
  }
});

// Check if we're on a LinkedIn profile and load profile data
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  if (url && url.includes("linkedin.com/in/")) {
    document.getElementById("personalization-section").style.display = "block";
    loadAndDisplayProfileData(tabs[0].id);
  }
});

// Load profile data and display it
async function loadAndDisplayProfileData(tabId) {
  try {
    const profileData = await chrome.tabs.sendMessage(tabId, {
      type: "GET_PROFILE_FOR_PERSONALIZATION"
    });

    const detailsEl = document.getElementById("profile-details");
    let html = "";

    if (profileData.firstName) {
      html += `<strong>${profileData.firstName}${profileData.lastName ? " " + profileData.lastName : ""}</strong><br>`;
    }

    if (profileData.currentRole && profileData.currentCompany) {
      html += `📍 <strong>${profileData.currentRole}</strong> at ${profileData.currentCompany}<br>`;
    }

    if (profileData.previousRole && profileData.previousCompany) {
      html += `← <strong>${profileData.previousRole}</strong> at ${profileData.previousCompany}<br>`;
    }

    if (profileData.yearsInIndustry) {
      html += `⏱️ ~${profileData.yearsInIndustry} years in industry<br>`;
    }

    if (profileData.education && profileData.education.school) {
      html += `🎓 ${profileData.education.school}${profileData.education.degree ? " (" + profileData.education.degree + ")" : ""}<br>`;
    }

    if (profileData.volunteerWork && profileData.volunteerWork.org) {
      html += `🤝 ${profileData.volunteerWork.role} at ${profileData.volunteerWork.org}<br>`;
    }

    detailsEl.innerHTML = html || "<div style='color: #999;'>No details found</div>";
  } catch (err) {
    console.log("Profile data not available:", err.message);
    document.getElementById("profile-details").innerHTML = "<div style='color: #999;'>Open a LinkedIn profile to see details</div>";
  }
}

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

  const opt1CountEl = document.getElementById("option1-count");
  const opt2CountEl = document.getElementById("option2-count");

  opt1CountEl.innerText = `${totalOpt1} / 300`;
  opt2CountEl.innerText = `${totalOpt2} / 300`;

  if (totalOpt1 > 300) {
    opt1CountEl.classList.add("warning");
  } else {
    opt1CountEl.classList.remove("warning");
  }

  if (totalOpt2 > 300) {
    opt2CountEl.classList.add("warning");
  } else {
    opt2CountEl.classList.remove("warning");
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

// Prompts imported from prompts.js (injected at runtime)

// ===== 🔧 3. Backend API call =====
async function callGemini(prompt) {
  const response = await fetch("https://linked-in-nu-virid.vercel.app/api/groq", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to generate message");
  }

  console.log("🤖 API response:", data);

  return data.content;
}

// ===== 🔧 4. UI helpers =====
function setStatus(text) {
  document.getElementById("status").innerText = text;
}

function setOutput(text) {
  document.getElementById("output").innerText = text;
}

// ===== 🔧 5. Copy button handlers =====
const copyToClipboard = (btn) => {
  const fullText = btn.previousElementSibling?.innerText || "";
  navigator.clipboard.writeText(fullText);

  btn.classList.add("copied");
  setTimeout(() => btn.classList.remove("copied"), 2000);
};

document.getElementById("option1-copy").onclick = function() {
  copyToClipboard(this);
};

document.getElementById("option2-copy").onclick = function() {
  copyToClipboard(this);
};

// ===== 🔧 6. Personalization handler =====
document.getElementById("generate-personalization").onclick = async () => {
  const statusEl = document.getElementById("personalization-status");
  const outputEl = document.getElementById("personalization-output");
  const copyBtn = document.getElementById("personalization-copy");

  statusEl.innerText = "Generating...";
  outputEl.style.display = "none";
  copyBtn.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const profileData = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PROFILE_FOR_PERSONALIZATION"
    });

    console.log("📊 Profile data:", profileData);

    const response = await fetch("https://linked-in-nu-virid.vercel.app/api/personalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profileData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate personalization");
    }

    let opener = data.personalizationOpener
      .replace(/^"|"$/g, "")
      .replace(/\n/g, " ")
      .trim();

    outputEl.innerText = opener;
    outputEl.style.display = "block";
    copyBtn.style.display = "flex";
    statusEl.innerText = "✓ Click again for new";

  } catch (err) {
    console.error("❌ Error:", err);
    let errorMsg = "Error generating opener";

    if (err.message.includes("Receiving end does not exist")) {
      errorMsg = "Open a LinkedIn profile first";
    } else if (err.message) {
      errorMsg = err.message;
    }

    outputEl.innerText = errorMsg;
    outputEl.style.display = "block";
    statusEl.innerText = "Error";
  }
};

// ===== 🔧 Copy personalization button =====
document.getElementById("personalization-copy").onclick = function() {
  copyToClipboard(this);
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
    let errorMsg = "Error generating message";

    if (err.message.includes("Receiving end does not exist")) {
      errorMsg = "Open a LinkedIn profile page first";
    }

    document.getElementById("option1-output").innerText = errorMsg;
    document.getElementById("option2-output").innerText = "";
    setStatus("Error");
  }
};
