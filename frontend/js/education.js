document.addEventListener("DOMContentLoaded", () => {
  const state = getState();

  const level = document.getElementById("education-level");
  const majorsWrap = document.getElementById("majors-wrap");
  const minorsWrap = document.getElementById("minors-wrap");
  const certWrap = document.getElementById("certificate-wrap");
  const coursesWrap = document.getElementById("courses-wrap");
  const dynamicArea = document.getElementById("dynamic-area");
  const form = document.getElementById("education-form");

  level.value = state.education.level || "";

  function createTagInput(container, values, placeholder, inputClass) {
    container.innerHTML = "";
    const list = document.createElement("div");
    list.className = "multi-list";

    values.forEach((value) => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="${inputClass}" type="text" value="${value}" placeholder="${placeholder}" />`;
      list.appendChild(row);
    });

    if (!values.length) {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="${inputClass}" type="text" placeholder="${placeholder}" />`;
      list.appendChild(row);
    }

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary-btn";
    addBtn.textContent = "+ Add another";
    addBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="${inputClass}" type="text" placeholder="${placeholder}" />`;
      list.appendChild(row);
    });

    container.appendChild(list);
    container.appendChild(addBtn);
  }

  function renderDynamicFields() {
    dynamicArea.innerHTML = "";
    const selected = level.value;

    if (["associates", "bachelors", "masters", "phd"].includes(selected)) {
      const majorsSection = document.createElement("div");
      majorsSection.innerHTML = `<label>Major(s)</label>`;
      createTagInput(majorsSection, state.education.majors || [], "Enter a major", "major-input");

      const minorsSection = document.createElement("div");
      minorsSection.innerHTML = `<label>Minor(s) (optional)</label>`;
      createTagInput(minorsSection, state.education.minors || [], "Enter a minor", "minor-input");

      dynamicArea.appendChild(majorsSection);
      dynamicArea.appendChild(minorsSection);
    }

    if (selected === "certificate") {
      const certTitle = state.education.certificateTitle || "";
      const certHours = state.education.certificateHours || "";

      dynamicArea.innerHTML = `
        <label>Certificate Title
          <input id="certificate-title" type="text" value="${certTitle}" placeholder="Google Data Analytics Certificate" />
        </label>
        <label>Duration (hours)
          <input id="certificate-hours" type="number" value="${certHours}" placeholder="120" />
        </label>
      `;
    }

    if (selected === "some_college") {
      const coursesSection = document.createElement("div");
      coursesSection.innerHTML = `<label>Courses Taken</label>`;
      createTagInput(coursesSection, state.education.courses || [], "Enter a course", "course-input");
      dynamicArea.appendChild(coursesSection);
    }
  }

  renderDynamicFields();

  level.addEventListener("change", () => {
    state.education.level = level.value;
    setState(state);
    renderDynamicFields();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const selected = level.value;
    const nextEducation = {
      level: selected,
      majors: [],
      minors: [],
      certificateTitle: "",
      certificateHours: "",
      courses: []
    };

    if (["associates", "bachelors", "masters", "phd"].includes(selected)) {
      nextEducation.majors = Array.from(document.querySelectorAll(".major-input"))
        .map((el) => el.value.trim())
        .filter(Boolean);

      nextEducation.minors = Array.from(document.querySelectorAll(".minor-input"))
        .map((el) => el.value.trim())
        .filter(Boolean);
    }

    if (selected === "certificate") {
      nextEducation.certificateTitle = document.getElementById("certificate-title")?.value.trim() || "";
      nextEducation.certificateHours = document.getElementById("certificate-hours")?.value.trim() || "";
    }

    if (selected === "some_college") {
      nextEducation.courses = Array.from(document.querySelectorAll(".course-input"))
        .map((el) => el.value.trim())
        .filter(Boolean);
    }

    updateState({ education: nextEducation });
    window.location.href = "/skills.html";
  });
});