document.addEventListener("DOMContentLoaded", () => {
  const exitBtn = document.querySelector(".exit-btn");
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "/index.html";
    });
  }
});