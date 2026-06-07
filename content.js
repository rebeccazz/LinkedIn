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

    // Find date line (e.g., "2w •", "1mo •"). We take the latest 3 posts
    // regardless of age — they're used to summarize the person's recent themes.
    if (line.match(/^\d+[dwmy]\s*•/i)) {
      const dateMatch = line.match(/(\d+)\s*([dwmy])/i);
      if (!dateMatch) continue;

      const [_, amount, unit] = dateMatch;
      const age = `${amount}${unit}`;

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

      const combined = postText.join(" ").trim().substring(0, 500);
      if (combined && combined.length > 20) {
        results.push({ text: combined, type: "post", age });
        if (results.length === 3) break;
      }
    }
  }

  console.log("✅ Recent activity results:", results);
  return results;
}

// Extract education info with more detail
// Get clean, de-duplicated visible text lines from an element.
function textLines(el) {
  if (!el) return [];
  const seen = new Set();
  return el.innerText
    .split("\n")
    .map(l => l.trim())
    .filter(l => {
      if (!l) return false;
      const key = l.toLowerCase();
      if (seen.has(key)) return false;  // LinkedIn duplicates lines for a11y
      seen.add(key);
      return true;
    });
}

// Find the <section> for a given heading (e.g. "Education", "Volunteer").
// LinkedIn nests sections and repeats words across them, so we rank candidates:
// prefer the section whose heading line IS the keyword, then the smallest one
// that actually contains profile entity items.
function findProfileSection(keyword) {
  const sections = Array.from(document.querySelectorAll("section"));
  const kw = keyword.toLowerCase();

  const candidates = sections.filter(sec => sec.innerText.toLowerCase().includes(kw));
  if (candidates.length === 0) return null;

  // Score: heading match is strongest; among those, smaller text = more specific.
  candidates.sort((a, b) => {
    const aHead = a.innerText.trim().toLowerCase().startsWith(kw) ? 0 : 1;
    const bHead = b.innerText.trim().toLowerCase().startsWith(kw) ? 0 : 1;
    if (aHead !== bHead) return aHead - bHead;
    return a.innerText.length - b.innerText.length;
  });

  // Prefer a candidate that has entity items; else fall back to the best-ranked.
  const withItems = candidates.find(
    sec => sec.querySelectorAll('[componentkey^="entity-collection-item"]').length > 0
  );
  return withItems || candidates[0];
}

function parseYears(text) {
  const rangeMatch = text.match(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|present)\b/i);
  if (rangeMatch) return `${rangeMatch[1]} - ${rangeMatch[2]}`;
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g);
  return yearMatches && yearMatches.length ? yearMatches[yearMatches.length - 1] : "";
}

function getEducation() {
  const eduSection = findProfileSection("Education");
  if (!eduSection) {
    console.log("❌ No Education section found");
    return null;
  }
  console.log("✅ Education section found");

  // Prefer the first entity item; fall back to parsing the section's text lines.
  const items = Array.from(eduSection.querySelectorAll('[componentkey^="entity-collection-item"]'));
  const scope = items[0] || eduSection;
  const allText = scope.innerText;

  // School: from logo alt first, else first non-"Education" line.
  const schoolImg = scope.querySelector('img[alt]');
  let school = schoolImg?.alt?.replace(/ logo$/i, "").trim() || "";

  let lines = textLines(scope).filter(l => l.toLowerCase() !== "education");
  if (!school && lines.length) school = lines[0];

  // Degree/field line: first line with a comma or a degree keyword, that isn't
  // the school name or a pure date range.
  const degreeKeywords = /\b(bachelor|master|associate|doctor|phd|mba|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|degree|engineering|science|arts|studies)\b/i;
  const degreeFieldLine = lines.find(l =>
    l !== school &&
    !/^\d{4}\s*[-–]\s*(\d{4}|present)/i.test(l) &&
    !/^(grade|activities|skills|grade:)/i.test(l) &&
    (l.includes(",") || degreeKeywords.test(l))
  ) || "";

  let degree = "", field = "";
  if (degreeFieldLine.includes(",")) {
    const parts = degreeFieldLine.split(",");
    degree = parts[0].trim();
    field = parts.slice(1).join(",").trim();
  } else {
    field = degreeFieldLine.trim();
  }

  const years = parseYears(allText);
  const education = { school, degree, field, years };

  console.log("✅ Education extracted:", education);
  // Only return something if we actually found a school or field.
  return (school || field) ? education : null;
}

// Extract volunteer work with recency check (last 5 years)
function getVolunteerWork() {
  const volSection = findProfileSection("Volunteer");
  if (!volSection) {
    console.log("❌ No Volunteer section found");
    return null;
  }
  console.log("✅ Volunteer section found");

  // Prefer the first entity item; fall back to the section's text lines.
  const items = Array.from(volSection.querySelectorAll('[componentkey^="entity-collection-item"]'));
  const scope = items[0] || volSection;
  const allText = scope.innerText;

  const lines = textLines(scope).filter(l => !/^volunteer/i.test(l));
  const role = lines[0] || '';
  const org = lines[1] || '';

  // Only surface volunteer work from the last 5 years (per requirements).
  const currentYear = new Date().getFullYear();
  let isRecent = false;
  let years = '';

  const rangeMatch = allText.match(/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|Present)\b/i);
  if (rangeMatch) years = `${rangeMatch[1]} - ${rangeMatch[2]}`;

  const yearMatches = allText.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length > 0) {
    if (!years) years = yearMatches[yearMatches.length - 1];
    const latestYear = Math.max(...yearMatches.map(y => parseInt(y)));
    if (currentYear - latestYear <= 5) isRecent = true;
  }

  // "Present" means ongoing, so it counts as recent.
  if (/present/i.test(allText)) isRecent = true;

  // No recency signal at all -> treat as not recent (don't display).
  if (!isRecent) {
    console.log("⏭️ Volunteer work found but not within last 5 years — skipping");
    return null;
  }

  const volunteer = { role, org, years };

  console.log("✅ Volunteer work extracted:", volunteer);
  return volunteer;
}

// Calculate years at a specific company
function getYearsAtCompany(experienceBlock) {
  if (!experienceBlock || !experienceBlock.date) return null;

  const dateText = experienceBlock.date;
  const yearMatch = dateText.match(/(\d{4})/);

  if (!yearMatch) return null;

  const startYear = parseInt(yearMatch[0]);
  const currentYear = new Date().getFullYear();

  // Check if still employed (contains "Present")
  const isCurrentRole = dateText.includes("Present");

  const years = currentYear - startYear;
  return { years, isCurrent: isCurrentRole };
}

// Calculate years in industry from experience
function calculateYearsInIndustry(experienceBlocks) {
  if (!experienceBlocks || experienceBlocks.length === 0) return null;

  const oldestRole = experienceBlocks[experienceBlocks.length - 1];
  if (!oldestRole.date) return null;

  const dateMatch = oldestRole.date.match(/(\d{4})/);
  if (!dateMatch) return null;

  const startYear = parseInt(dateMatch[1]);
  const currentYear = new Date().getFullYear();
  const years = currentYear - startYear;

  return years > 0 ? years : null;
}

// Main function: collect profile data
function getProfileData() {
  let name = null;

  // Try h1 first
  name = document.querySelector("h1")?.innerText || null;

  // Fallback: look for name in common LinkedIn selectors
  if (!name) {
    const nameEl = document.querySelector('[data-testid="top-card-profile-headline"]')?.parentElement?.querySelector('h1');
    name = nameEl?.innerText || null;
  }

  // Last resort: check the page title
  if (!name) {
    const pageTitle = document.title;
    const match = pageTitle.match(/^(.*?)\s*\|/);
    name = match ? match[1] : null;
  }

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

// Extended profile data for personalization
function getProfileDataForPersonalization() {
  const basicData = getProfileData();
  const experienceBlocks = basicData.experienceBlocks || [];

  // Extract name parts
  let firstName = 'there', lastName = '';
  if (basicData.name) {
    const nameParts = basicData.name.trim().split(/\s+/);
    firstName = nameParts[0] || 'there';
    lastName = nameParts.slice(1).join(' ') || '';
  }

  // Get current and previous roles with tenure
  const currentRole = (experienceBlocks[0]?.title || basicData.title || '').trim();
  const currentCompany = (experienceBlocks[0]?.company || '').trim();
  const currentTenure = getYearsAtCompany(experienceBlocks[0]);
  const currentDescription = (experienceBlocks[0]?.description || '').trim();

  const previousRole = (experienceBlocks[1]?.title || '').trim();
  const previousCompany = (experienceBlocks[1]?.company || '').trim();
  const previousTenure = getYearsAtCompany(experienceBlocks[1]);
  const previousDescription = (experienceBlocks[1]?.description || '').trim();

  // Get education and volunteer info
  const education = getEducation();
  const volunteerWork = getVolunteerWork();
  const yearsInIndustry = calculateYearsInIndustry(experienceBlocks);

  const profileData = {
    firstName,
    lastName,
    currentRole,
    currentCompany,
    currentTenure,
    currentDescription,
    previousRole,
    previousCompany,
    previousTenure,
    previousDescription,
    yearsInIndustry,
    education,
    volunteerWork,
    allExperienceBlocks: experienceBlocks,
    recentActivity: basicData.recentActivity
  };

  console.log("✅ Full profile data:", profileData);

  return profileData;
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PROFILE") {
    sendResponse(getProfileData());
  } else if (req.type === "GET_PROFILE_FOR_PERSONALIZATION") {
    sendResponse(getProfileDataForPersonalization());
  }
});