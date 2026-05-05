// content.js - Option 1: safe, raw experience capture

// Grab all experience <li> blocks as raw text
function getExperienceBlocks() {
  const expSection = Array.from(document.querySelectorAll("section"))
    .find(sec => sec.innerText.includes("Experience"));

  if (!expSection) return [];

  return Array.from(expSection.querySelectorAll("li"))
    .map(el => el.innerText.trim())
    .filter(Boolean)
    .map(textBlock => ({
      textBlock,
      company: "XXXX" // placeholder for later
    }));
}

// Grab all visible text on the page (full fallback)
function getPageText() {
  return document.body.innerText.trim();
}

// Main function: collect profile data
function getProfileData() {
  const name = document.querySelector("h1")?.innerText || null;
  const title = document.querySelector(".text-body-medium")?.innerText || null;

  const experienceBlocks = getExperienceBlocks();
  //const fullPageText = getPageText();

  return {
    name,
    title,
    experienceBlocks,
    //fullPageText
  };
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PROFILE") {
    sendResponse(getProfileData());
  }
});