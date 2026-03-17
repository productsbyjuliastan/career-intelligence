const db = require("../db");

function normalizeText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

function singularize(text) {
  const t = normalizeText(text);
  if (t.endsWith("s") && !t.endsWith("ss")) {
    return t.slice(0, -1);
  }
  return t;
}

function getAllOccupationData() {
  return db.prepare(`
    SELECT 
      o.id,
      o.onet_code,
      o.title,
      o.description,
      COALESCE(w.median_wage, 0) AS median_wage
    FROM occupations o
    LEFT JOIN wages w ON w.occupation_id = o.id
    ORDER BY o.title
  `).all();
}

function getOccupationSkills(occupation) {
  // First try direct occupation_id match
  let rows = db.prepare(`
    SELECT s.name, os.importance, os.level
    FROM occupation_skills os
    JOIN skills s ON s.id = os.skill_id
    WHERE os.occupation_id = ?
    ORDER BY os.importance DESC
  `).all(occupation.id);

  if (rows.length) return rows;

  // Fallback: match occupations by exact onet_code
  rows = db.prepare(`
    SELECT s.name, os.importance, os.level
    FROM occupation_skills os
    JOIN skills s ON s.id = os.skill_id
    JOIN occupations o ON o.id = os.occupation_id
    WHERE o.onet_code = ?
    ORDER BY os.importance DESC
  `).all(occupation.onet_code);

  if (rows.length) return rows;

  // Fallback: match by O*NET code family prefix (e.g. 15-2051)
  const prefix = String(occupation.onet_code || "").split(".")[0];

  if (!prefix) return [];

  rows = db.prepare(`
    SELECT s.name, MAX(os.importance) AS importance, MAX(os.level) AS level
    FROM occupation_skills os
    JOIN skills s ON s.id = os.skill_id
    JOIN occupations o ON o.id = os.occupation_id
    WHERE o.onet_code LIKE ?
    GROUP BY s.name
    ORDER BY importance DESC
  `).all(`${prefix}%`);

  return rows;
}

function mapEducationBoost(education) {
  const level = education?.level || "";
  const majors = (education?.majors || []).map(normalizeText);

  let generalBoost = 0;

  if (level === "high_school") generalBoost = 0.45;
  if (level === "some_college") generalBoost = 0.55;
  if (level === "associates") generalBoost = 0.65;
  if (level === "bachelors") generalBoost = 0.78;
  if (level === "masters") generalBoost = 0.88;
  if (level === "phd") generalBoost = 0.94;
  if (level === "certificate") generalBoost = 0.58;

  let mathBoost = 0;
  const mathish = [
    "mathematics",
    "math",
    "statistics",
    "data science",
    "computer science",
    "economics"
  ];

  for (const major of majors) {
    if (mathish.some((m) => major.includes(m))) {
      mathBoost = 0.08;
      break;
    }
  }

  return Math.min(1, generalBoost + mathBoost);
}

function calculateInterestFit(interests, title, description) {
  const source = normalizeText(`${title} ${description}`);
  const normalizedInterests = (interests || []).map(normalizeText).filter(Boolean);

  if (!normalizedInterests.length) return 0.5;

  let matches = 0;
  for (const interest of normalizedInterests) {
    if (source.includes(interest)) matches += 1;
  }

  return Math.min(1, 0.45 + matches * 0.18);
}

function calculateTargetAlignment(targetCareer, title) {
  if (!targetCareer) return 0.5;

  const target = singularize(targetCareer);
  const current = singularize(title);

  if (current === target) return 1;
  if (current.includes(target) || target.includes(current)) return 0.9;

  const targetWords = new Set(target.split(/\s+/).filter(Boolean));
  const currentWords = current.split(/\s+/).filter(Boolean);

  let overlap = 0;
  for (const word of currentWords) {
    if (targetWords.has(word)) overlap += 1;
  }

  return Math.min(0.85, 0.4 + overlap * 0.18);
}

function expandUserSkillAliases(userSkills) {
  const aliasMap = {
    "python": ["programming", "computers and electronics"],
    "javascript": ["programming", "computers and electronics"],
    "sql": ["programming", "computers and electronics", "data analysis"],
    "excel": ["data analysis"],
    "statistics": ["mathematics", "data analysis"],
    "statistical analysis": ["mathematics", "data analysis"],
    "statistical": ["mathematics", "data analysis"],
    "statistic": ["mathematics", "data analysis"],
    "probability": ["mathematics"],
    "linear algebra": ["mathematics"],
    "calculus": ["mathematics"],
    "machine learning": ["programming", "mathematics", "data analysis"],
    "data visualization": ["data analysis"],
    "analytics": ["data analysis"],
    "data analysis": ["data analysis"],
    "communication": ["speaking", "writing"],
    "research": ["critical thinking", "reading comprehension"],
    "r": ["programming", "data analysis"],
    "c++": ["programming", "computers and electronics"],
    "c": ["programming", "computers and electronics"],
    "writing": ["writing", "reading comprehension", "critical thinking"],
    "editing": ["writing", "reading comprehension"],
    "communication": ["speaking", "writing", "active listening"],
    "public speaking": ["speaking", "active listening"],
    "teaching": ["instructing", "speaking", "active learning"],
    "research": ["critical thinking", "reading comprehension", "active learning"],
    "content creation": ["writing", "communications"],
    "documentation": ["writing", "reading comprehension"],
  };

  const normalized = (userSkills || []).map(normalizeText).filter(Boolean);
  const expanded = new Set(normalized);

  for (const skill of normalized) {
    const aliases = aliasMap[skill] || [];
    aliases.forEach((a) => expanded.add(normalizeText(a)));
  }

  return Array.from(expanded);
}

function getBaselineEducationSkills(education) {
  const level = education?.level || "";

  if (!["associates", "bachelors", "masters", "phd"].includes(level)) {
    return [];
  }

  return [
    "reading comprehension",
    "active listening",
    "writing",
    "speaking",
    "active learning",
    "critical thinking"
  ];
}

function calculateSkillsFit(userSkills, occupationSkills, education) {
    const expandedUserSkills = [
    ...expandUserSkillAliases(userSkills),
    ...getBaselineEducationSkills(education)
    ];
    const baselineSkills = new Set([
    "reading comprehension",
    "active listening",
    "speaking",
    "writing",
    "critical thinking",
    "active learning",
    "monitoring",
    "social perceptiveness",
    "judgment and decision making",
    "time management",
    "coordination"
    ]);

  let matchedWeight = 0;
  let totalWeight = 0;
  const missingSkills = [];
  const matchedSkills = [];

  for (const occSkill of occupationSkills) {
    const importance = Number(occSkill.importance) || 0;
    totalWeight += importance;

    const occSkillName = normalizeText(occSkill.name);
    const occSkillSingular = singularize(occSkill.name);

    const matched = expandedUserSkills.some((userSkill) => {
      const normUser = normalizeText(userSkill);
      const singularUser = singularize(userSkill);

      return (
        occSkillName.includes(normUser) ||
        normUser.includes(occSkillName) ||
        occSkillSingular.includes(singularUser) ||
        singularUser.includes(occSkillSingular)
      );
    });

    if (matched) {
      matchedWeight += importance;
      matchedSkills.push(occSkill.name);
        } else if (importance >= 3.0) {
      const skillName = normalizeText(occSkill.name);

      if (!baselineSkills.has(skillName)) {
        missingSkills.push(occSkill.name);
      }
    }
  }

  const fit = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    fit,
    matchedSkills: [...new Set(matchedSkills)].slice(0, 6),
    missingSkills: [...new Set(missingSkills)].slice(0, 6)
  };
}

function getUserMajorSignals(education) {
  const majors = (education?.majors || []).map(normalizeText);
  const minors = (education?.minors || []).map(normalizeText);
  return [...majors, ...minors];
}

function evaluateMajorAlignment(education, occupationTitle, occupationDescription) {
  const title = singularize(occupationTitle);
  const description = normalizeText(occupationDescription);
  const targetText = `${title} ${description}`;
  const userMajors = getUserMajorSignals(education);

  if (!userMajors.length) {
    return {
      label: "No major provided",
      status: "neutral"
    };
  }

    const strongMajorKeywords = {
  "mathematics": [
    "statistician",
    "actuary",
    "operations research analyst",
    "data scientist",
    "economist",
    "analyst"
  ],
  "math": [
    "statistician",
    "actuary",
    "operations research analyst",
    "data scientist",
    "economist",
    "analyst"
  ],
  "statistics": [
    "statistician",
    "data scientist",
    "actuary",
    "analyst",
    "economist"
  ],
  "computer science": [
    "software developer",
    "data scientist",
    "database administrator",
    "information security analyst",
    "business intelligence analyst"
  ],
  "economics": [
    "economist",
    "financial analyst",
    "market research analyst",
    "management analyst",
    "data scientist"
  ],
  "data science": [
    "data scientist",
    "business intelligence analyst",
    "analyst"
  ],
  "english": [
    "technical writer",
    "writer",
    "editor",
    "communications",
    "instructional designer",
    "content"
  ],
  "journalism": [
    "technical writer",
    "writer",
    "editor",
    "communications",
    "content"
  ],
  "communications": [
    "technical writer",
    "writer",
    "communications",
    "market research analyst",
    "instructional designer"
  ],
  "education": [
    "teacher",
    "instructional designer",
    "training",
    "curriculum"
  ],
  "biology": [
    "biologist",
    "medical",
    "health",
    "research",
    "laboratory"
  ],
  "business": [
    "management analyst",
    "financial analyst",
    "market research analyst",
    "operations",
    "business intelligence analyst"
  ],
  "finance": [
    "financial analyst",
    "actuary",
    "economist",
    "risk",
    "analyst"
  ],
  "marketing": [
    "market research analyst",
    "communications",
    "content",
    "business intelligence analyst"
  ],
  "psychology": [
    "research",
    "market research analyst",
    "ux",
    "human resources",
    "instructional designer"
  ]
};

  for (const major of userMajors) {
    for (const [majorKey, careerKeywords] of Object.entries(strongMajorKeywords)) {
      if (major.includes(majorKey)) {
        const aligned = careerKeywords.some((keyword) => {
          const k = singularize(keyword);
          return targetText.includes(k);
        });

        if (aligned) {
          return {
            label: `${major} aligns well`,
            status: "good"
          };
        }
      }
    }
  }

  return {
    label: `${userMajors[0]} has weak alignment`,
    status: "bad"
  };
}

function analyzeProfile(profile) {
  const occupations = getAllOccupationData();
  const educationFit = mapEducationBoost(profile.education);

  const results = occupations.map((occupation) => {
    const occupationSkills = getOccupationSkills(occupation);
    const skillsResult = calculateSkillsFit(profile.skills, occupationSkills, profile.education);
    const interestsFit = calculateInterestFit(
      profile.interests,
      occupation.title,
      occupation.description
    );
    const targetAlignment = calculateTargetAlignment(
      profile.targetCareer,
      occupation.title
    );

    const finalScore =
      skillsResult.fit * 0.5 +
      educationFit * 0.2 +
      interestsFit * 0.15 +
      targetAlignment * 0.15;

    const majorAlignment = evaluateMajorAlignment(
      profile.education,
      occupation.title,
      occupation.description
    );

    return {
      id: occupation.id,
      onetCode: occupation.onet_code,
      title: occupation.title,
      description: occupation.description,
      medianWage: occupation.median_wage,
      matchPercent: Math.round(finalScore * 100),
      breakdown: {
        educationFit: Math.round(educationFit * 100),
        skillsFit: Math.round(skillsResult.fit * 100),
        interestsFit: Math.round(interestsFit * 100),
        targetAlignment: Math.round(targetAlignment * 100)
      },
      matchedSkills: skillsResult.matchedSkills,
      missingSkills: skillsResult.missingSkills,
      majorAlignment,
      topSkills: occupationSkills.slice(0, 6).map((s) => s.name)
    };
  });

  results.sort((a, b) => b.matchPercent - a.matchPercent);

  let selectedCareer = results.length ? results[0] : null;

  if (profile.targetCareer && results.length) {
    const target = singularize(profile.targetCareer);
    const exact = results.find((r) => singularize(r.title) === target);
    if (exact) selectedCareer = exact;
  }

  return {
    selectedCareer,
    careerList: results,
    unexpectedCareers: selectedCareer
      ? results.filter((r) => r.title !== selectedCareer.title).slice(0, 8)
      : []
  };
}

module.exports = {
  analyzeProfile
};