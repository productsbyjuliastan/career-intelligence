document.addEventListener("DOMContentLoaded", () => {
  const result = getResult();
  if (!result) {
    window.location.href = "/index.html";
    return;
  }

  const listEl = document.getElementById("career-list");
  const previewEl = document.getElementById("career-preview");

  function renderPreview(career) {
    previewEl.innerHTML = `
      <h2>${career.title}</h2>
      <p>${career.description || "No description available."}</p>
      <p><strong>${career.matchPercent}% match</strong></p>
      <p>${career.medianWage ? `$${career.medianWage.toLocaleString()} median wage` : "Median wage unavailable"}</p>
      <button class="primary-btn" id="open-career-view">Open Career View</button>
    `;

    document.getElementById("open-career-view").addEventListener("click", () => {
      result.selectedCareer = career;
      setResult(result);
      window.location.href = "/career-view.html";
    });
  }

  listEl.innerHTML = result.careerList
    .map(
      (career, index) => `
        <div class="job-card" data-index="${index}">
          <div class="job-top">
            <h3>${career.title}</h3>
            <span class="job-match">${career.matchPercent}% match</span>
          </div>
          <p class="job-desc">${career.description || "No description available."}</p>
          <div class="job-meta">
            <span>${career.medianWage ? `$${career.medianWage.toLocaleString()}` : "Wage unavailable"}</span>
          </div>
        </div>
      `
    )
    .join("");

  document.querySelectorAll(".job-card").forEach((card) => {
    card.addEventListener("click", () => {
      const idx = Number(card.dataset.index);
      const career = result.careerList[idx];
      renderPreview(career);
      document.querySelectorAll(".job-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  renderPreview(result.selectedCareer || result.careerList[0]);
});