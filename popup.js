// ===== 🔧 CONFIG =====
// Switch this to http://localhost:3000 for local testing (see LOCAL_SETUP.md)
const API_BASE_URL = "https://linked-in-nu-virid.vercel.app";  // Production
// const API_BASE_URL = "http://localhost:3000";              // Local

let currentProfileData = null;

// Load custom message from storage on popup open
chrome.storage.local.get("closingMessage", ({ closingMessage }) => {
  if (closingMessage) {
    document.getElementById("closing-message").value = closingMessage;
    updateCharCount();
  }
});

// Check if we're on a LinkedIn profile, enable personalization, and auto-load overview
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  if (url && url.includes("linkedin.com/in/")) {
    document.getElementById("personalization-section").style.display = "block";
    loadProfileOverview();
  }
});

// Escape user-controlled text before injecting into innerHTML.
function esc(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Look up "what the company does" from Apollo via the backend (already 7-10 words).
async function fetchCompanyDescription(companyName) {
  if (!companyName) return "";
  try {
    const resp = await fetch(`${API_BASE_URL}/api/company-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName })
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.warn("Company lookup error for", companyName, data);
      return "";
    }
    return data.description || "";
  } catch (err) {
    console.warn("Company lookup failed for", companyName, err);
    return "";
  }
}

// Condense a raw LinkedIn role description into a 7-10 word phrase via Claude (/api/groq).
async function condenseRole(text) {
  if (!text || text.trim().length < 12) return "";
  try {
    const result = await callGemini(buildCondenseRolePrompt(text));
    return (result || "").replace(/^"|"$/g, "").replace(/\n/g, " ").trim();
  } catch (err) {
    console.warn("Role condense failed:", err);
    return "";
  }
}

// Render one role block: title, @ company • tenure, then two 7-10 word lines:
//   📝 what they wrote on LinkedIn   |   🏢 what the company does (Apollo)
function renderRole(label, role, company, tenure, linkedinDesc, apolloDesc) {
  if (!role || !company) return "";
  const yrs = tenure?.years;
  const tenureText = (yrs || yrs === 0) ? ` • ${yrs} yr${yrs !== 1 ? "s" : ""}` : "";

  let html = `<div style="margin-bottom: 4px;"><strong>${label}:</strong> ${esc(role)}</div>`;
  html += `<div style="margin-left: 12px; color: #666;">@ ${esc(company)}${tenureText}</div>`;
  if (linkedinDesc) {
    html += `<div style="margin-left: 12px; margin-top: 3px; color: #444;">📝 ${esc(linkedinDesc)}</div>`;
  }
  if (apolloDesc) {
    html += `<div style="margin-left: 12px; margin-top: 3px; color: #1a5490;">🏢 ${esc(apolloDesc)}</div>`;
  }
  html += `<div style="height: 10px;"></div>`;
  return html;
}

// Display profile data. descriptions = {
//   currentLinkedIn, currentApollo, previousLinkedIn, previousApollo } (all optional).
function displayProfileData(profileData, descriptions = {}) {
  const detailsEl = document.getElementById("profile-details");
  let html = "";

  html += renderRole(
    "Current",
    profileData.currentRole,
    profileData.currentCompany,
    profileData.currentTenure,
    descriptions.currentLinkedIn,
    descriptions.currentApollo
  );

  html += renderRole(
    "Previous",
    profileData.previousRole,
    profileData.previousCompany,
    profileData.previousTenure,
    descriptions.previousLinkedIn,
    descriptions.previousApollo
  );

  // Education — field of study + years (any time)
  const edu = profileData.education;
  if (edu && (edu.school || edu.field)) {
    let line = `<strong>📚 Education:</strong> `;
    line += esc(edu.field || edu.degree || edu.school);
    if (edu.field && edu.school) line += ` — ${esc(edu.school)}`;
    if (edu.years) line += ` <span style="color: #999;">(${esc(edu.years)})</span>`;
    html += `<div style="margin-bottom: 8px;">${line}</div>`;
  } else {
    html += `<div style="margin-bottom: 8px; font-size: 11px; color: #999;">📚 Education: Not found</div>`;
  }

  detailsEl.innerHTML = html || "<div style='color: #999; font-size: 12px;'>Profile details unavailable</div>";
}

// Ask the content script for profile data, retrying while the LinkedIn page is
// still rendering its Experience section (otherwise we can get empty roles).
async function fetchProfileData(retries = 6, delayMs = 400) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let data = null;
  for (let i = 0; i < retries; i++) {
    data = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROFILE_FOR_PERSONALIZATION" });
    if (data && data.currentRole && data.currentCompany) return data;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return data; // best effort after retries
}

// Load the profile overview: render scraped data immediately, then fill in
// Apollo company descriptions as they arrive. Accepts already-fetched data
// (from the personalize button) so we don't query twice.
async function loadProfileOverview(profileData) {
  const detailsEl = document.getElementById("profile-details");
  try {
    if (!profileData) profileData = await fetchProfileData();
    currentProfileData = profileData;

    // Don't clobber the panel with a degraded view if the page wasn't ready.
    if (!profileData || (!profileData.currentRole && !profileData.previousRole)) {
      console.warn("Profile data not ready (no roles found).");
      detailsEl.innerHTML = "<div style='color: #999; font-size: 12px;'>Couldn't read this profile. Scroll the page so Experience is visible, then reopen.</div>";
      return;
    }

    // First paint: roles + education show immediately; the two
    // 7-10 word description lines fill in once Claude/Apollo respond.
    displayProfileData(profileData);

    const samePrevCompany =
      profileData.previousCompany &&
      profileData.previousCompany !== profileData.currentCompany;

    // Run all four distillations in parallel:
    //   📝 LinkedIn role text -> 7-10 words (via Claude /api/groq)
    //   🏢 company -> 7-10 words (via Apollo /api/company-lookup)
    const [currentLinkedIn, previousLinkedIn, currentApollo, previousApollo] =
      await Promise.all([
        condenseRole(profileData.currentDescription),
        condenseRole(profileData.previousDescription),
        fetchCompanyDescription(profileData.currentCompany),
        samePrevCompany
          ? fetchCompanyDescription(profileData.previousCompany)
          : Promise.resolve("")
      ]);

    displayProfileData(profileData, {
      currentLinkedIn,
      previousLinkedIn,
      currentApollo,
      previousApollo
    });
  } catch (err) {
    console.warn("Could not load profile overview:", err);
    detailsEl.innerHTML = "<div style='color: #999; font-size: 12px;'>Open a LinkedIn profile, then reopen this popup.</div>";
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

// Update display with closing message appended.
// Only Option 1 is an outreach message; Option 2 is the recent-posts gist
// (context, not a message), so the closing is never appended to it.
function updateOptionDisplay() {
  const closingText = document.getElementById("closing-message").value.trim();
  const option1Base = document.getElementById("option1-output").getAttribute("data-base-text") || "";
  const option1Full = closingText ? `${option1Base} ${closingText}` : option1Base;
  document.getElementById("option1-output").innerText = option1Full;
}

// Update character count (Option 1 only — the sendable message).
function updateCharCount() {
  const closingText = document.getElementById("closing-message").value;
  const option1Base = document.getElementById("option1-output").getAttribute("data-base-text") || "";
  const totalOpt1 = option1Base.length + (closingText ? 1 + closingText.length : 0);

  const opt1CountEl = document.getElementById("option1-count");
  opt1CountEl.innerText = `${totalOpt1} / 300`;

  if (totalOpt1 > 300) {
    opt1CountEl.classList.add("warning");
  } else {
    opt1CountEl.classList.remove("warning");
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
  const response = await fetch(`${API_BASE_URL}/api/groq`, {
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
    const profileData = await fetchProfileData();

    console.log("📊 Full profile data:", profileData);

    // Refresh the overview with this (retried) data — recovers the panel if the
    // auto-load on popup open happened before the page finished rendering.
    loadProfileOverview(profileData);

    // Generate opener
    const response = await fetch(`${API_BASE_URL}/api/personalize`, {
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

    // Generate Option 2 — gist of their latest (up to 3) posts in 3 sentences.
    let option2Text = "No recent posts found";
    if (profile.recentActivity && profile.recentActivity.length > 0) {
      const posts = profile.recentActivity.slice(0, 3);
      const option2Prompt = buildPostSummaryPrompt(posts);
      const option2Result = await callGemini(option2Prompt);
      option2Text = option2Result.replace(/^"|"$/g, "").trim();
      document.getElementById("option2-copy").style.display = "inline-block";
    }

    // Option 2 is context (the gist), not a sendable message, so set it
    // directly rather than going through the closing-message append logic.
    const option2El = document.getElementById("option2-output");
    option2El.removeAttribute("data-base-text");
    option2El.innerText = option2Text;
    option2El.style.display = "inline-block";

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
