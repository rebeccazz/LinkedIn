// content.js - Option 1: safe, raw experience capture

// Grab all experience <li> blocks as raw text
function getExperienceBlocks() {
  // 1. Find the Experience section more robustly
  const sections = Array.from(document.querySelectorAll("section"));
  const expSection = sections.find(sec => {
    const anchor = sec.querySelector('div[id="experience"]');
    return anchor || sec.innerText.includes("Experience");
  });

  if (!expSection) return [];

  // 2. Target the individual list items
  const items = expSection.querySelectorAll("li.artdeco-list__item");
  
  return Array.from(items).map(li => {
    // LinkedIn often hides the 'Company Name' label for screen readers
    // We want the text immediately following or inside the bold span
    const companyElement = li.querySelector('.t-14.t-normal span[aria-hidden="true"], .t-bold span[aria-hidden="true"]');
    const titleElement = li.querySelector('.t-bold span[aria-hidden="true"]');
    
    // If it's a nested role (multiple roles at one company), 
    // the company name is usually in a parent div.
    let company = companyElement?.innerText || "Unknown Company";
    let title = titleElement?.innerText || "Unknown Title";

    // Logic for "Multiple Roles at One Company" blocks
    if (li.querySelector('.pvs-entity__path-node')) {
       // This is a sub-role; we'd need to traverse up to find the header
       // For a simple script, we can often find it in the textBlock
       const rawText = li.innerText.split('\n');
       company = rawText[0]; // Usually the first line in these blocks
    }

    return {
      company: company.replace(/ · Full-time| · Part-time/g, '').trim(),
      title: title.trim()
    };
  });
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