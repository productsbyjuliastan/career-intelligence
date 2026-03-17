document.addEventListener("DOMContentLoaded", () => {
  const state = getState();
  const form = document.getElementById("skills-form");
  const container = document.getElementById("skills-list");

  function render(values) {
    container.innerHTML = "";

    const list = document.createElement("div");
    list.className = "multi-list";

    (values.length ? values : [""]).forEach((value) => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="skill-input" type="text" value="${value}" placeholder="Python, SQL, Statistics..." />`;
      list.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary-btn";
    addBtn.textContent = "+ Add another skill";
    addBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="skill-input" type="text" placeholder="Enter a skill" />`;
      list.appendChild(row);
    });

    container.appendChild(list);
    container.appendChild(addBtn);
  }

  render(state.skills || []);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const skills = Array.from(document.querySelectorAll(".skill-input"))
      .map((el) => el.value.trim())
      .filter(Boolean);

    updateState({ skills });
    window.location.href = "/interests.html";
  });
});