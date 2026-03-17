require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db");
const { analyzeProfile } = require("./services/analysisService");
const { generateCareerAdvice } = require("./services/watsonxService");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/debug/db", (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type='table'
      ORDER BY name
    `).all();

    const occupations = db.prepare(`
      SELECT COUNT(*) AS count
      FROM occupations
    `).get();

    res.json({
      tables,
      occupations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/debug/occupation-skills/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    const occupation = db.prepare(`
      SELECT id, title, onet_code
      FROM occupations
      WHERE id = ?
    `).get(id);

    const skills = db.prepare(`
      SELECT s.name, os.importance, os.level
      FROM occupation_skills os
      JOIN skills s ON s.id = os.skill_id
      WHERE os.occupation_id = ?
      ORDER BY os.importance DESC
    `).all(id);

    const totalLinks = db.prepare(`
      SELECT COUNT(*) AS count
      FROM occupation_skills
    `).get();

    res.json({
      occupation,
      skills,
      totalLinks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/debug/analyze", (req, res) => {
  try {
    const profile = req.body || {};
    const result = analyzeProfile(profile);

    console.log("DEBUG ANALYZE:");
    console.log("selectedCareer:", result.selectedCareer?.title);
    console.log("topSkills:", result.selectedCareer?.topSkills);
    console.log("matchedSkills:", result.selectedCareer?.matchedSkills);
    console.log("missingSkills:", result.selectedCareer?.missingSkills);

    res.json(result);
  } catch (err) {
    console.error("DEBUG ANALYZE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const profile = req.body || {};
    const result = analyzeProfile(profile);

    if (!result.selectedCareer) {
      return res.status(500).json({
        error: "No careers were available for analysis."
      });
    }

    const aiSummary = await generateCareerAdvice(
      profile,
      result.selectedCareer
    );

    res.json({
      selectedCareer: result.selectedCareer,
      careerList: result.careerList,
      unexpectedCareers: result.unexpectedCareers,
      ai: aiSummary
    });
  } catch (error) {
    console.error("ANALYZE ERROR:", error);
    res.status(500).json({
      error: "Failed to analyze profile.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});