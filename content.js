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


function getRecentActivity() {
  const sections = Array.from(document.querySelectorAll("section"));
  const postsSection = sections.find(sec => sec.innerText.includes("Posts") && sec.innerText.includes("Comments"));

  if (!postsSection) {
    console.log("❌ No Posts section found");
    return [];
  }

  const lines = postsSection.innerText.split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find date line (e.g., "2w •", "1mo •")
    if (line.match(/^\d+[dwmy]\s*•/i)) {
      const dateMatch = line.match(/(\d+)\s*([dwmy])/i);
      if (!dateMatch) continue;

      const [_, amount, unit] = dateMatch;
      const unitLower = unit.toLowerCase();

      let isWithin3Months = false;
      if (unitLower === "d" || unitLower === "w") {
        isWithin3Months = true;
      } else if (unitLower === "m" || unitLower === "mo") {
        isWithin3Months = parseInt(amount) <= 3;
      }

      if (!isWithin3Months) continue;

      // Collect post text from next lines until we hit another date, "View analytics", or end
      let postText = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];

        // Stop if we hit another date, analytics, or section headers
        if (nextLine.match(/^\d+[dwmy]\s*•/i) ||
            nextLine.includes("View analytics") ||
            nextLine === "Comments" ||
            nextLine === "Images" ||
            nextLine === "Repost" ||
            nextLine === "Like" ||
            nextLine.match(/^\d+\s*(impressions|reactions|comments)/i)) {
          break;
        }

        if (nextLine && nextLine.length > 5 && !nextLine.includes("You")) {
          postText.push(nextLine);
        }
      }

      const combined = postText.join(" ").trim().substring(0, 300);
      if (combined && combined.length > 20) {
        results.push({ text: combined, type: "post" });
        if (results.length === 3) break;
      }
    }
  }

  console.log("✅ Recent activity results:", results);
  return results;
}

// Main function: collect profile data
function getProfileData() {
  const name = document.querySelector("h1")?.innerText || null;
  const title = document.querySelector(".text-body-medium")?.innerText || null;

  const experienceBlocks = getExperienceBlocks();
  const recentActivity = getRecentActivity();

  return {
    name,
    title,
    experienceBlocks,
    recentActivity
  };
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PROFILE") {
    sendResponse(getProfileData());
  }
});