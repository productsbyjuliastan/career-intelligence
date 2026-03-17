document.addEventListener("DOMContentLoaded", () => {
  const result = getResult();
  if (!result) {
    window.location.href = "/index.html";
    return;
  }

  const career = result.selectedCareer;

  console.log("Selected career data:", career);
  console.log("Full result:", result);

  document.getElementById("career-title").textContent = career.title || "Unknown Career";
  document.getElementById("career-description").textContent =
    career.description || "No description available.";

  document.getElementById("career-match").textContent = `${career.matchPercent ?? 0}%`;
  document.getElementById("career-wage").textContent = career.medianWage
    ? `$${career.medianWage.toLocaleString()}`
    : "Unavailable";

  document.getElementById("breakdown").innerHTML = `
    <div class="metric-card"><span>Education Fit</span><strong>${career.breakdown?.educationFit ?? 0}%</strong></div>
    <div class="metric-card"><span>Skills Fit</span><strong>${career.breakdown?.skillsFit ?? 0}%</strong></div>
    <div class="metric-card"><span>Interests Fit</span><strong>${career.breakdown?.interestsFit ?? 0}%</strong></div>
    <div class="metric-card"><span>Target Alignment</span><strong>${career.breakdown?.targetAlignment ?? 0}%</strong></div>
  `;

  document.getElementById("bar-education-value").textContent = `${career.breakdown?.educationFit ?? 0}%`;
  document.getElementById("bar-skills-value").textContent = `${career.breakdown?.skillsFit ?? 0}%`;
  document.getElementById("bar-interests-value").textContent = `${career.breakdown?.interestsFit ?? 0}%`;
  document.getElementById("bar-target-value").textContent = `${career.breakdown?.targetAlignment ?? 0}%`;

  document.getElementById("bar-education").style.width = `${career.breakdown?.educationFit ?? 0}%`;
  document.getElementById("bar-skills").style.width = `${career.breakdown?.skillsFit ?? 0}%`;
  document.getElementById("bar-interests").style.width = `${career.breakdown?.interestsFit ?? 0}%`;
  document.getElementById("bar-target").style.width = `${career.breakdown?.targetAlignment ?? 0}%`;

  document.getElementById("top-skills").innerHTML =
    career.topSkills && career.topSkills.length
      ? career.topSkills.map((s) => `<span class="chip">${s}</span>`).join("")
      : "<p>No top skills available.</p>";

  document.getElementById("missing-skills").innerHTML =
    career.missingSkills && career.missingSkills.length
      ? career.missingSkills.map((s) => `<span class="chip warning">${s}</span>`).join("")
      : "<p>No major gaps detected.</p>";

  document.getElementById("matched-skills").innerHTML =
    career.matchedSkills && career.matchedSkills.length
      ? career.matchedSkills.map((s) => `<span class="chip success">${s}</span>`).join("")
      : "<p>No direct skill matches found.</p>";

  if (career.majorAlignment) {
    const majorClass =
      career.majorAlignment.status === "good"
        ? "chip success"
        : career.majorAlignment.status === "bad"
        ? "chip danger"
        : "chip";

    document.getElementById("major-alignment").innerHTML = `
      <span class="${majorClass}">${career.majorAlignment.label}</span>
    `;
  } else {
    document.getElementById("major-alignment").innerHTML =
      "<p>No major alignment data available.</p>";
  }

  document.getElementById("ai-summary").innerHTML = `
  <div class="future-steps-summary">
    <h3>Overview</h3>
    <p>${result.ai?.summary || "No AI summary available."}</p>
    ${
      result.ai?.caution
        ? `<div class="future-steps-note"><strong>Keep in mind:</strong> ${result.ai.caution}</div>`
        : ""
    }
  </div>

  <div class="future-steps-grid">
    <div class="future-step-column urgent">
      <h3>30-Day Priorities</h3>
      <ul class="future-step-list">
        ${(result.ai?.todo30Days || []).map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>

    <div class="future-step-column important">
      <h3>90-Day Growth Plan</h3>
      <ul class="future-step-list">
        ${(result.ai?.todo90Days || []).map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  </div>
`;

  document.getElementById("download-report").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("browse-careers").addEventListener("click", () => {
    window.location.href = "/career-list.html";
  });
});