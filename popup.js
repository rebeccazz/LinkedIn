// ===== 🔧 CONFIG =====
// Switch this to http://localhost:3000 for local testing (see LOCAL_SETUP.md)
const API_BASE_URL = "https://linked-in-nu-virid.vercel.app";  // Production
// const API_BASE_URL = "http://localhost:3000";              // Local

let currentProfileData = null;
let saveTimeout;

// ===== Small helpers =====
function esc(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Backend Claude proxy (named /api/groq for legacy reasons; it calls Claude).
async function callClaude(prompt) {
  const response = await fetch(`${API_BASE_URL}/api/groq`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to generate");
  return data.content;
}

// ===== Message box (generated opener + custom closing) =====
chrome.storage.local.get("closingMessage", ({ closingMessage }) => {
  if (closingMessage) {
    document.getElementById("closing-message").value = closingMessage;
    updateMessageDisplay();
  }
});

document.getElementById("closing-message").addEventListener("input", () => {
  updateMessageDisplay();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({ closingMessage: document.getElementById("closing-message").value });
  }, 500);
});

// Render the message = generated opener + (optional) custom closing, with count.
function updateMessageDisplay() {
  const out = document.getElementById("personalization-output");
  const base = out.getAttribute("data-base-text") || "";
  const closing = document.getElementById("closing-message").value.trim();
  const full = base ? (closing ? `${base} ${closing}` : base) : "";

  out.innerText = full;

  const countEl = document.getElementById("message-count");
  countEl.innerText = `${full.length} / 300`;
  countEl.classList.toggle("warning", full.length > 300);
}

// ===== Copy =====
const copyToClipboard = (btn) => {
  const fullText = btn.parentElement.querySelector(".option-box")?.innerText || "";
  navigator.clipboard.writeText(fullText);
  btn.classList.add("copied");
  setTimeout(() => btn.classList.remove("copied"), 2000);
};
document.getElementById("personalization-copy").onclick = function () {
  copyToClipboard(this);
};

// ===== Company "what they do" (LinkedIn page -> Claude; Apollo fallback) =====
async function fetchCompanyDescription(companyName, companyUrl = "") {
  if (!companyName) return "";
  try {
    const resp = await fetch(`${API_BASE_URL}/api/company-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, companyUrl })
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

async function condenseRole(text) {
  if (!text || text.trim().length < 12) return "";
  try {
    const result = await callClaude(buildCondenseRolePrompt(text));
    return (result || "").replace(/^"|"$/g, "").replace(/\n/g, " ").trim();
  } catch (err) {
    console.warn("Role condense failed:", err);
    return "";
  }
}

async function condenseCompany(text) {
  if (!text || text.trim().length < 12) return "";
  try {
    const result = await callClaude(buildCondenseCompanyPrompt(text));
    return (result || "").replace(/^"|"$/g, "").replace(/\n/g, " ").trim();
  } catch (err) {
    console.warn("Company condense failed:", err);
    return "";
  }
}

// Prefer the company's own LinkedIn description; fall back to Apollo.
async function getCompanyDescription(companyName, companyUrl, linkedinDesc) {
  if (linkedinDesc && linkedinDesc.trim()) {
    const condensed = await condenseCompany(linkedinDesc);
    if (condensed) return condensed;
  }
  return fetchCompanyDescription(companyName, companyUrl);
}

// One post -> topic phrase (under 7 words) via Claude.
async function condensePostTopic(text) {
  if (!text || text.trim().length < 8) return "";
  try {
    const result = await callClaude(buildPostTopicPrompt(text));
    return (result || "").replace(/^"|"$/g, "").replace(/\n/g, " ").trim();
  } catch (err) {
    console.warn("Post topic failed:", err);
    return "";
  }
}

// ===== Profile data fetch (retry while LinkedIn finishes rendering) =====
async function fetchProfileData(retries = 6, delayMs = 400) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let data = null;
  for (let i = 0; i < retries; i++) {
    data = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROFILE_FOR_PERSONALIZATION" });
    if (data && data.currentRole && data.currentCompany) return data;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return data; // best effort
}

// ===== Profile Overview rendering =====
// One role block: title, @ company • tenure, 📝 their words, 🏢 what company does.
function renderRole(label, role, company, tenure, linkedinDesc, apolloDesc) {
  if (!role || !company) return "";
  const yrs = tenure?.years;
  const tenureText = (yrs || yrs === 0) ? ` • ${yrs} yr${yrs !== 1 ? "s" : ""}` : "";

  let html = `<div style="margin-bottom: 3px;"><strong>${esc(label)}:</strong> ${esc(role)}</div>`;
  html += `<div style="margin-left: 12px; color: #666;">@ ${esc(company)}${tenureText}</div>`;
  if (linkedinDesc) {
    html += `<div style="margin-left: 12px; margin-top: 2px; color: #444;">📝 ${esc(linkedinDesc)}</div>`;
  }
  if (apolloDesc) {
    html += `<div style="margin-left: 12px; margin-top: 2px; color: #1a5490;">🏢 ${esc(apolloDesc)}</div>`;
  }
  html += `<div style="height: 9px;"></div>`;
  return html;
}

// descriptions = { currentLinkedIn, currentApollo, previousLinkedIn, previousApollo }
function displayProfileData(profileData, descriptions = {}) {
  const detailsEl = document.getElementById("profile-details");
  let html = "";

  html += renderRole(
    "Current", profileData.currentRole, profileData.currentCompany,
    profileData.currentTenure, descriptions.currentLinkedIn, descriptions.currentApollo
  );
  html += renderRole(
    "Previous", profileData.previousRole, profileData.previousCompany,
    profileData.previousTenure, descriptions.previousLinkedIn, descriptions.previousApollo
  );

  const edu = profileData.education;
  if (edu && (edu.school || edu.field)) {
    let line = `<strong>📚 Education:</strong> ${esc(edu.field || edu.degree || edu.school)}`;
    if (edu.field && edu.school) line += ` — ${esc(edu.school)}`;
    if (edu.years) line += ` <span class="muted">(${esc(edu.years)})</span>`;
    html += `<div>${line}</div>`;
  } else {
    html += `<div class="muted" style="font-size: 11px;">📚 Education: Not found</div>`;
  }

  detailsEl.innerHTML = html || "<div class='muted'>Profile details unavailable</div>";
}

// ===== Recent Posts rendering =====
function displayPostsLoading(posts) {
  const el = document.getElementById("posts-summary");
  if (!posts || posts.length === 0) {
    el.innerHTML = "<div class='muted'>No recent posts found.</div>";
    return;
  }
  el.innerHTML = posts.map((p, i) =>
    `<div class="post-row"><span class="post-num">${i + 1}.</span>` +
    `<span class="post-topic muted">summarizing…</span>` +
    `<span class="post-age">${esc(p.age || "")}</span></div>`
  ).join("");
}

function displayPosts(posts, topics) {
  const el = document.getElementById("posts-summary");
  if (!posts || posts.length === 0) {
    el.innerHTML = "<div class='muted'>No recent posts found.</div>";
    return;
  }
  el.innerHTML = posts.map((p, i) => {
    const topic = topics[i] || p.text.slice(0, 50) + "…";
    return `<div class="post-row"><span class="post-num">${i + 1}.</span>` +
      `<span class="post-topic">${esc(topic)}</span>` +
      `<span class="post-age">${esc(p.age || "")}</span></div>`;
  }).join("");
}

// ===== Load everything (overview + posts), enrich asynchronously =====
async function loadProfileOverview(profileData) {
  const detailsEl = document.getElementById("profile-details");
  try {
    if (!profileData) profileData = await fetchProfileData();
    currentProfileData = profileData;

    if (!profileData || (!profileData.currentRole && !profileData.previousRole)) {
      console.warn("Profile data not ready (no roles found).");
      detailsEl.innerHTML = "<div class='muted'>Couldn't read this profile. Scroll the page so Experience is visible, then reopen.</div>";
      document.getElementById("posts-summary").innerHTML = "<div class='muted'>—</div>";
      return;
    }

    // First paint: roles + education immediately; descriptions fill in after.
    displayProfileData(profileData);

    // Recent posts: show rows immediately, then their <7-word topics.
    const posts = (profileData.recentActivity || []).slice(0, 3);
    displayPostsLoading(posts);

    const samePrevCompany =
      profileData.previousCompany &&
      profileData.previousCompany !== profileData.currentCompany;

    const [
      currentLinkedIn, previousLinkedIn, currentApollo, previousApollo, ...topics
    ] = await Promise.all([
      condenseRole(profileData.currentDescription),
      condenseRole(profileData.previousDescription),
      getCompanyDescription(profileData.currentCompany, profileData.currentCompanyUrl, profileData.currentCompanyLinkedinDesc),
      samePrevCompany
        ? getCompanyDescription(profileData.previousCompany, profileData.previousCompanyUrl, profileData.previousCompanyLinkedinDesc)
        : Promise.resolve(""),
      ...posts.map(p => condensePostTopic(p.text))
    ]);

    displayProfileData(profileData, { currentLinkedIn, previousLinkedIn, currentApollo, previousApollo });
    displayPosts(posts, topics);
  } catch (err) {
    console.warn("Could not load profile overview:", err);
    detailsEl.innerHTML = "<div class='muted'>Open a LinkedIn profile, then reopen this popup.</div>";
  }
}

// ===== Generate Message (personalized opener) =====
document.getElementById("generate-personalization").onclick = async () => {
  const statusEl = document.getElementById("personalization-status");
  const copyBtn = document.getElementById("personalization-copy");

  statusEl.innerText = "Generating…";
  copyBtn.style.display = "none";

  try {
    const profileData = await fetchProfileData();
    console.log("📊 Full profile data:", profileData);

    // Refresh overview + posts with this (retried) data.
    loadProfileOverview(profileData);

    const response = await fetch(`${API_BASE_URL}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate personalization");

    const opener = data.personalizationOpener
      .replace(/^"|"$/g, "")
      .replace(/\n/g, " ")
      .trim();

    document.getElementById("personalization-output").setAttribute("data-base-text", opener);
    updateMessageDisplay();
    copyBtn.style.display = "flex";
    statusEl.innerText = "✓ Click again for a new one";
  } catch (err) {
    console.error("❌ Error:", err);
    let msg = "Error generating message";
    if (err.message && err.message.includes("Receiving end does not exist")) {
      msg = "Open a LinkedIn profile first";
    } else if (err.message) {
      msg = err.message;
    }
    statusEl.innerText = msg;
  }
};

// ===== Init: auto-load overview + posts when on a LinkedIn profile =====
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";
  if (url.includes("linkedin.com/in/")) {
    loadProfileOverview();
  } else {
    document.getElementById("profile-details").innerHTML =
      "<div class='muted'>Open a LinkedIn profile (linkedin.com/in/…) to see details.</div>";
    document.getElementById("posts-summary").innerHTML = "<div class='muted'>—</div>";
  }
});
