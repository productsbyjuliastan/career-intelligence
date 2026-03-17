const fs = require("fs");
const path = require("path");

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

function loadOnetFiles() {
  const base = path.join(__dirname, "../../data/raw/onet");

  const occupationPath = path.join(base, "Occupation Data.txt");
  const skillsPath = path.join(base, "Skills.txt");

  if (!fs.existsSync(occupationPath)) {
    throw new Error(`Missing file: ${occupationPath}`);
  }

  if (!fs.existsSync(skillsPath)) {
    throw new Error(`Missing file: ${skillsPath}`);
  }

  return {
    occupations: parseTabFile(occupationPath),
    skills: parseTabFile(skillsPath)
  };
}

module.exports = {
  loadOnetFiles
};