// content.js - Option 1: safe, raw experience capture

// Grab all experience <li> blocks as raw text
function getExperienceBlocks() {
  const sections = Array.from(document.querySelectorAll("section"));
  const expSection = sections.find(sec => sec.innerText.includes("Experience"));

  if (!expSection) {
    console.log("❌ No Experience section found");
    return [];
  }

  const entityItems = Array.from(
    expSection.querySelectorAll('[componentkey^="entity-collection-item"]')
  );

  const results = [];

  for (const item of entityItems) {
    const companyImg = item.querySelector('img[alt]');
    const company = companyImg?.alt?.replace(/ logo$/i, '').trim() || '';
    if (!company) continue;

    let title = '', date = '', description = '';

    const list = item.querySelector('ul');
    if (list) {
      // Grouped roles — most recent is first <li>
      const firstLi = list.querySelector('li');
      if (firstLi) {
        const paras = Array.from(firstLi.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
        title = paras[0] || '';
        date = paras.find(t => t.match(/\d{4}|Present/)) || '';
        description = firstLi.querySelector('[data-testid="expandable-text-box"]')?.innerText?.trim() || '';
      }
    } else {
      // Single role
      const paras = Array.from(item.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);
      const nonCompany = paras.filter(t => t !== company && !t.match(/^\d+\s*(mos|yrs)/i));
      title = nonCompany[0] || '';
      date = paras.find(t => t.match(/\d{4}|Present/)) || '';
      description = item.querySelector('[data-testid="expandable-text-box"]')?.innerText?.trim() || '';
    }

    results.push({ company, title, date, description });
    if (results.length === 2) break;
  }

  console.log("✅ Final experience results:", results);
  return results;
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
    debugRawExperience: experienceBlocks.map(e => e.raw)
    //fullPageText
  };
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PROFILE") {
    sendResponse(getProfileData());
  }
});