document.addEventListener("DOMContentLoaded", () => {
  const state = getState();
  const form = document.getElementById("target-form");
  const targetInput = document.getElementById("target-career");

  targetInput.value = state.targetCareer || "";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    updateState({ targetCareer: targetInput.value.trim() });
    window.location.href = "/loading.html";
  });
});