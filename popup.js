// ===== 🔧 CONFIG =====
let currentProfileData = null;

// Load custom message from storage on popup open
chrome.storage.local.get("closingMessage", ({ closingMessage }) => {
  if (closingMessage) {
    document.getElementById("closing-message").value = closingMessage;
    updateCharCount();
  }
});

// Check if we're on a LinkedIn profile and enable personalization
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  if (url && url.includes("linkedin.com/in/")) {
    document.getElementById("personalization-section").style.display = "block";
  }
});

// Display profile data
async function displayProfileData(profileData) {
  const detailsEl = document.getElementById("profile-details");
  let html = "";

  console.log("🔧 displayProfileData called with:", profileData);

  // Current role
  if (profileData.currentRole && profileData.currentCompany) {
    const tenure = profileData.currentTenure?.years || '?';
    html += `<div style="margin-bottom: 10px;"><strong>Current:</strong> ${profileData.currentRole}</div>`;
    html += `<div style="margin-left: 12px; margin-bottom: 5px; color: #666;">@ ${profileData.currentCompany}${profileData.currentTenure ? ` • ${tenure} yr${tenure !== 1 ? 's' : ''}` : ''}</div>`;

    // Fetch company info
    console.log("🌐 Fetching company info for:", profileData.currentCompany);
    const currentCompanyInfo = await fetchCompanyInfo(profileData.currentCompany);
    console.log("📦 Current company info result:", currentCompanyInfo);

    if (currentCompanyInfo) {
      html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #888; font-style: italic;">${currentCompanyInfo.summary7words || '(no summary)'}</div>`;
      if (currentCompanyInfo.apolloDescription) {
        html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #999; line-height: 1.4;">${currentCompanyInfo.apolloDescription.substring(0, 120)}...</div>`;
      }
    } else {
      html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #d9534f;">⚠️ Company lookup failed</div>`;
    }
  }

  // Previous role
  if (profileData.previousRole && profileData.previousCompany) {
    const tenure = profileData.previousTenure?.years || '?';
    html += `<div style="margin-bottom: 10px;"><strong>Previous:</strong> ${profileData.previousRole}</div>`;
    html += `<div style="margin-left: 12px; margin-bottom: 5px; color: #666;">@ ${profileData.previousCompany}${profileData.previousTenure ? ` • ${tenure} yr${tenure !== 1 ? 's' : ''}` : ''}</div>`;

    // Fetch company info
    console.log("🌐 Fetching company info for:", profileData.previousCompany);
    const previousCompanyInfo = await fetchCompanyInfo(profileData.previousCompany);
    console.log("📦 Previous company info result:", previousCompanyInfo);

    if (previousCompanyInfo) {
      html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #888; font-style: italic;">${previousCompanyInfo.summary7words || '(no summary)'}</div>`;
      if (previousCompanyInfo.apolloDescription) {
        html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #999; line-height: 1.4;">${previousCompanyInfo.apolloDescription.substring(0, 120)}...</div>`;
      }
    } else {
      html += `<div style="margin-left: 12px; margin-bottom: 10px; font-size: 11px; color: #d9534f;">⚠️ Company lookup failed</div>`;
    }
  }

  // Education
  if (profileData.education && profileData.education.school) {
    html += `<div style="margin-bottom: 8px;"><strong>Education:</strong> ${profileData.education.school}`;
    if (profileData.education.degree) html += ` • ${profileData.education.degree}`;
    if (profileData.education.field) html += ` (${profileData.education.field})`;
    if (profileData.education.gradYear) html += ` • ${profileData.education.gradYear}`;
    html += `</div>`;
  } else {
    html += `<div style="margin-bottom: 8px; font-size: 11px; color: #999;">📚 Education: Not found on profile</div>`;
  }

  // Volunteer work (last 5 years)
  if (profileData.volunteerWork && profileData.volunteerWork.org) {
    const recency = profileData.volunteerWork.isRecent ? '✓ Recent' : 'Older';
    html += `<div style="margin-bottom: 8px;"><strong>Volunteer:</strong> ${profileData.volunteerWork.role} at ${profileData.volunteerWork.org} <span style="color: #999;">(${recency})</span></div>`;
  } else {
    html += `<div style="margin-bottom: 8px; font-size: 11px; color: #999;">🤝 Volunteer: Not found on profile</div>`;
  }

  console.log("✅ displayProfileData complete. HTML:", html);
  detailsEl.innerHTML = html || "<div style='color: #999; font-size: 12px;'>No details found</div>";
}

// Fetch company info from Apollo.io
async function fetchCompanyInfo(companyName) {
  try {
    console.log(`🔄 Calling /api/company-lookup for: ${companyName}`);

    const response = await fetch("https://linked-in-nu-virid.vercel.app/api/company-lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ companyName })
    });

    console.log(`📡 Response status for ${companyName}:`, response.status, response.ok);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      console.error(`❌ API Error (${response.status}) for ${companyName}:`, errorData);
      console.error(`Full response:`, errorData);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Company data for ${companyName}:`, data);
    return data;
  } catch (err) {
    console.error(`❌ Network/Parse error for ${companyName}:`, err.message, err);
    return null;
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

    console.log("📊 Full profile data:", profileData);

    // Display the profile data
    displayProfileData(profileData);

    // Generate opener
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
