const fs = require("fs");
const path = require("path");
const db = require("./db");
const { loadOnetFiles } = require("./services/onetImportService");

function safeNumber(value) {
  const cleaned = String(value ?? "").replace(/[$,"]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function getField(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function parseTabFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (cols[index] ?? "").trim();
    });
    return row;
  });
}

function importBLSWages() {
  const csvPath = path.join(__dirname, "../data/raw/bls/national_wages.csv");

  if (!fs.existsSync(csvPath)) {
    console.log("BLS wage file not found, skipping wage import.");
    return;
  }

  const rows = parseCsvFile(csvPath);
  console.log(`Loaded BLS wage rows: ${rows.length}`);

  const insertWage = db.prepare(`
    INSERT OR REPLACE INTO wages (occupation_id, median_wage)
    VALUES (?, ?)
  `);

  let inserted = 0;

  for (const row of rows) {
    const occCode = getField(row, ["OCC_CODE", "occ_code"]);
    const median = safeNumber(getField(row, ["A_MEDIAN", "a_median"]));

    if (!occCode || !median) continue;

    const occ = db.prepare(`
      SELECT id
      FROM occupations
      WHERE onet_code LIKE ?
      LIMIT 1
    `).get(`${occCode}%`);

    if (occ) {
      insertWage.run(occ.id, median);
      inserted += 1;
    }
  }

  console.log(`Imported BLS wages: ${inserted}`);
}

function main() {
  console.log("Starting O*NET seed...");

  const { occupations, skills } = loadOnetFiles();

  console.log(`Loaded raw occupations: ${occupations.length}`);
  console.log(`Loaded raw skills rows: ${skills.length}`);

  if (!occupations.length) throw new Error("No occupations loaded.");
  if (!skills.length) throw new Error("No skills loaded.");

  console.log("Occupation headers:", Object.keys(occupations[0]));
  console.log("Skills headers:", Object.keys(skills[0]));

  db.exec(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS occupation_skills;
    DROP TABLE IF EXISTS wages;
    DROP TABLE IF EXISTS skills;
    DROP TABLE IF EXISTS occupations;

    CREATE TABLE occupations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      onet_code TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      job_zone INTEGER DEFAULT 0
    );

    CREATE TABLE skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE occupation_skills (
      occupation_id INTEGER NOT NULL,
      skill_id INTEGER NOT NULL,
      importance REAL DEFAULT 0,
      level REAL DEFAULT 0,
      PRIMARY KEY (occupation_id, skill_id),
      FOREIGN KEY (occupation_id) REFERENCES occupations(id),
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    );

    CREATE TABLE wages (
      occupation_id INTEGER PRIMARY KEY,
      median_wage INTEGER DEFAULT 0,
      FOREIGN KEY (occupation_id) REFERENCES occupations(id)
    );

    PRAGMA foreign_keys = ON;
  `);

  const occupationRows = occupations.filter((row) => {
    const title = getField(row, ["Title", "title"]);
    return title && !title.includes("All Other");
  });

  const insertOccupation = db.prepare(`
    INSERT OR IGNORE INTO occupations (onet_code, title, description, job_zone)
    VALUES (?, ?, ?, ?)
  `);

  for (const row of occupationRows) {
    const onetCode = getField(row, ["O*NET-SOC Code", "O*NET-SOC code", "Code"]);
    const title = getField(row, ["Title", "title"]);
    const description = getField(row, ["Description", "description"]);

    if (!onetCode || !title) continue;

    insertOccupation.run(onetCode, title, description || "", 0);
  }

  const insertedOccupations = db.prepare(`
    SELECT COUNT(*) AS count
    FROM occupations
  `).get();

  console.log(`Inserted occupations: ${insertedOccupations.count}`);

  const occupationMap = new Map(
    db.prepare(`
      SELECT id, onet_code, title
      FROM occupations
    `).all().map((r) => [r.onet_code, r])
  );

  const skillNames = new Set();

  for (const row of skills) {
    const onetCode = getField(row, ["O*NET-SOC Code", "O*NET-SOC code", "Code"]);
    const elementName = getField(row, ["Element Name", "Skill", "name"]);

    if (occupationMap.has(onetCode) && elementName) {
      skillNames.add(elementName);
    }
  }

  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (name)
    VALUES (?)
  `);

  for (const skillName of skillNames) {
    insertSkill.run(skillName);
  }

  const insertedSkills = db.prepare(`
    SELECT COUNT(*) AS count
    FROM skills
  `).get();

  console.log(`Inserted skills: ${insertedSkills.count}`);

  const skillMap = new Map(
    db.prepare(`
      SELECT id, name
      FROM skills
    `).all().map((r) => [r.name, r])
  );

  const skillPairs = new Map();

  for (const row of skills) {
    const onetCode = getField(row, ["O*NET-SOC Code", "O*NET-SOC code", "Code"]);
    const elementName = getField(row, ["Element Name", "Skill", "name"]);
    const scaleName = getField(row, [
      "Scale Name",
      "Scale",
      "scale_name",
      "Scale ID"
    ]);
    const dataValue = safeNumber(getField(row, ["Data Value", "Value", "data_value"]));

    if (!occupationMap.has(onetCode) || !skillMap.has(elementName)) continue;

    const key = `${onetCode}|||${elementName}`;

    if (!skillPairs.has(key)) {
      skillPairs.set(key, {
        onetCode,
        elementName,
        importance: 0,
        level: 0
      });
    }

    const pair = skillPairs.get(key);
    const scale = String(scaleName).toLowerCase();

    if (scale === "importance" || scale === "im") {
      pair.importance = dataValue;
    } else if (scale === "level" || scale === "lv") {
      pair.level = dataValue;
    }
  }

  const insertOccupationSkill = db.prepare(`
    INSERT OR REPLACE INTO occupation_skills (occupation_id, skill_id, importance, level)
    VALUES (?, ?, ?, ?)
  `);

  let insertedLinks = 0;

  for (const pair of skillPairs.values()) {
    const occ = occupationMap.get(pair.onetCode);
    const skill = skillMap.get(pair.elementName);

    if (!occ || !skill) continue;

    insertOccupationSkill.run(
      occ.id,
      skill.id,
      pair.importance || 0,
      pair.level || 0
    );

    insertedLinks += 1;
  }

  console.log(`Inserted occupation-skill links: ${insertedLinks}`);

  importBLSWages();

  const totalLinks = db.prepare(`
    SELECT COUNT(*) AS count
    FROM occupation_skills
  `).get();

  const totalWages = db.prepare(`
    SELECT COUNT(*) AS count
    FROM wages
  `).get();

  console.log(`Final occupation_skills count: ${totalLinks.count}`);
  console.log(`Final wages count: ${totalWages.count}`);
  console.log("O*NET seed complete.");
}

main();