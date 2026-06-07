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

// Extract education info with more detail
function getEducation() {
  const sections = Array.from(document.querySelectorAll("section"));
  const eduSection = sections.find(sec => {
    const text = sec.innerText;
    return text.includes("Education") && !text.includes("Experience");
  });

  if (!eduSection) {
    console.log("❌ No Education section found");
    return null;
  }

  // Find all education items in this section
  const allItems = Array.from(eduSection.querySelectorAll('[componentkey^="entity-collection-item"]'));

  if (allItems.length === 0) {
    console.log("❌ No education items found in Education section");
    return null;
  }

  // Use the first education item
  const eduItem = allItems[0];
  const allText = eduItem.innerText;

  // Extract school name (usually first line or from image alt)
  const schoolImg = eduItem.querySelector('img[alt]');
  let school = schoolImg?.alt?.replace(/ logo$/i, '').trim() || '';

  // Get all paragraphs - they usually contain: school, degree, field, dates
  const paras = Array.from(eduItem.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);

  // If no school found from image, try first paragraph
  if (!school && paras.length > 0) {
    school = paras[0];
  }

  const degree = paras[1] || '';
  const field = paras[2] || '';

  // Find graduation year (look for 4-digit number that looks like a year)
  let gradYear = '';
  const yearMatches = allText.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length > 0) {
    gradYear = yearMatches[yearMatches.length - 1];
  }

  const education = { school, degree, field };
  if (gradYear) education.gradYear = gradYear;

  console.log("✅ Education extracted:", education);
  return education;
}

// Extract volunteer work with recency check (last 5 years)
function getVolunteerWork() {
  const sections = Array.from(document.querySelectorAll("section"));
  const volSection = sections.find(sec => {
    const text = sec.innerText;
    return (text.includes("Volunteer") || text.includes("Causes")) && !text.includes("Experience");
  });

  if (!volSection) {
    console.log("❌ No Volunteer section found");
    return null;
  }

  // Find all volunteer items in this section
  const allItems = Array.from(volSection.querySelectorAll('[componentkey^="entity-collection-item"]'));

  if (allItems.length === 0) {
    console.log("❌ No volunteer items found in Volunteer section");
    return null;
  }

  // Use the first volunteer item
  const volItem = allItems[0];
  const allText = volItem.innerText;

  // Get all paragraphs - they usually contain: role, org, dates
  const paras = Array.from(volItem.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean);

  const role = paras[0] || '';
  const org = paras[1] || '';

  // Check if volunteer work is recent (within last 5 years)
  const currentYear = new Date().getFullYear();
  let isRecent = false;

  // Look for date patterns
  const yearMatches = allText.match(/\b(19|20)\d{2}\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const latestYear = Math.max(...yearMatches.map(y => parseInt(y)));
    if (currentYear - latestYear <= 5) {
      isRecent = true;
    }
  }

  // Also check for "Present"
  if (allText.includes("Present")) {
    isRecent = true;
  }

  const volunteer = { role, org, isRecent };

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

  const previousRole = (experienceBlocks[1]?.title || '').trim();
  const previousCompany = (experienceBlocks[1]?.company || '').trim();
  const previousTenure = getYearsAtCompany(experienceBlocks[1]);

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
    previousRole,
    previousCompany,
    previousTenure,
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