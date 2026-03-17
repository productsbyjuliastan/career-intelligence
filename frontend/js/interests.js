document.addEventListener("DOMContentLoaded", () => {
  const state = getState();
  const form = document.getElementById("interests-form");
  const container = document.getElementById("interests-list");

  function render(values) {
    container.innerHTML = "";

    const list = document.createElement("div");
    list.className = "multi-list";

    (values.length ? values : [""]).forEach((value) => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="interest-input" type="text" value="${value}" placeholder="Finance, research, analytics..." />`;
      list.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary-btn";
    addBtn.textContent = "+ Add another interest";
    addBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "multi-row";
      row.innerHTML = `<input class="interest-input" type="text" placeholder="Enter an interest" />`;
      list.appendChild(row);
    });

    container.appendChild(list);
    container.appendChild(addBtn);
  }

  render(state.interests || []);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const interests = Array.from(document.querySelectorAll(".interest-input"))
      .map((el) => el.value.trim())
      .filter(Boolean);

    updateState({ interests });
    window.location.href = "/target.html";
  });
});