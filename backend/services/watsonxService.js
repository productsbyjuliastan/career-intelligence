// backend/services/watsonxService.js

const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";

async function getIamToken() {
  const apiKey = process.env.WATSONX_API_KEY;

  if (!apiKey) {
    throw new Error("Missing WATSONX_API_KEY in .env");
  }

  const body = new URLSearchParams({
    grant_type: "urn:ibm:params:oauth:grant-type:apikey",
    apikey: apiKey
  });

  const response = await fetch(IAM_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get IAM token: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

function buildPrompt(profile, selectedCareer) {
  const educationLevel = profile.education?.level || "unknown";
  const majors = (profile.education?.majors || []).join(", ") || "none";
  const minors = (profile.education?.minors || []).join(", ") || "none";
  const courses = (profile.education?.courses || []).join(", ") || "none";
  const certificateTitle = profile.education?.certificateTitle || "none";
  const certificateHours = profile.education?.certificateHours || "none";

  const skills = (profile.skills || []).join(", ") || "none";
  const interests = (profile.interests || []).join(", ") || "none";
  const targetCareer = profile.targetCareer || "none";

  const matchedSkills = (selectedCareer.matchedSkills || []).join(", ") || "none";
  const missingSkills = (selectedCareer.missingSkills || []).join(", ") || "none";
  const topSkills = (selectedCareer.topSkills || []).join(", ") || "none";
  const majorAlignment = selectedCareer.majorAlignment?.label || "unknown";

  return `
You are a career planning assistant.

Use only the structured analysis below.
Do not invent salaries, fit scores, matched skills, or missing skills.
Keep the advice practical, concise, and encouraging.

User profile:
- Education level: ${educationLevel}
- Majors: ${majors}
- Minors: ${minors}
- Courses: ${courses}
- Certificate: ${certificateTitle}
- Certificate hours: ${certificateHours}
- Skills: ${skills}
- Interests: ${interests}
- Target career: ${targetCareer}

Structured analysis:
- Recommended career: ${selectedCareer.title}
- Career description: ${selectedCareer.description}
- Match percent: ${selectedCareer.matchPercent}
- Median wage: ${selectedCareer.medianWage || "unavailable"}
- Education fit: ${selectedCareer.breakdown?.educationFit ?? 0}
- Skills fit: ${selectedCareer.breakdown?.skillsFit ?? 0}
- Interests fit: ${selectedCareer.breakdown?.interestsFit ?? 0}
- Target alignment: ${selectedCareer.breakdown?.targetAlignment ?? 0}
- Major alignment: ${majorAlignment}
- Top skills in this career: ${topSkills}
- Matched skills: ${matchedSkills}
- Missing skills: ${missingSkills}

Return valid JSON only with this shape:
{
  "summary": "2-4 sentence explanation",
  "todo30Days": ["item 1", "item 2", "item 3"],
  "todo90Days": ["item 1", "item 2", "item 3"],
  "caution": "1-2 sentence caution"
}
`.trim();
}

async function generateCareerAdvice(profile, selectedCareer) {
  const projectId = process.env.WATSONX_PROJECT_ID;
  const baseUrl = process.env.WATSONX_URL;
  const modelId = process.env.WATSONX_MODEL_ID || "ibm/granite-3-8b-instruct";

  if (!projectId) {
    throw new Error("Missing WATSONX_PROJECT_ID in .env");
  }

  if (!baseUrl) {
    throw new Error("Missing WATSONX_URL in .env");
  }

  const token = await getIamToken();
  const prompt = buildPrompt(profile, selectedCareer);

  const response = await fetch(
    `${baseUrl}/ml/v1/text/generation?version=2024-05-31`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: modelId,
        project_id: projectId,
        input: prompt,
        parameters: {
          decoding_method: "greedy",
          max_new_tokens: 600,
          min_new_tokens: 60,
          repetition_penalty: 1.05
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Watsonx generation failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  const generatedText =
    data?.results?.[0]?.generated_text ||
    data?.results?.[0]?.generatedText ||
    "";

  if (!generatedText) {
    throw new Error("Watsonx returned no generated text.");
  }

  // Try to parse strict JSON first
  function extractJSONFromText(text) {
  if (!text || typeof text !== "string") return null;

  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    const jsonBlock = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(jsonBlock);
    } catch {}
  }

  return null;
}

const parsed = extractJSONFromText(generatedText);

if (parsed) {
  return {
    summary: parsed.summary || "No summary returned.",
    todo30Days: Array.isArray(parsed.todo30Days) ? parsed.todo30Days : [],
    todo90Days: Array.isArray(parsed.todo90Days) ? parsed.todo90Days : [],
    caution: parsed.caution || "Use this advice as guidance, not a guarantee."
  };
}

console.log("WATSONX RAW RESPONSE:", generatedText);

return {
  summary: generatedText || "No AI summary available.",
  todo30Days: [
    "Review the recommended path and missing skills.",
    "Build one small project tied to this career.",
    "Strengthen one core technical or professional skill."
  ],
  todo90Days: [
    "Complete a larger portfolio project.",
    "Refine your resume around the target role.",
    "Apply to internships or entry-level opportunities."
  ],
  caution: "Use this advice as guidance, not a guarantee."
};

}

module.exports = {
  generateCareerAdvice
};