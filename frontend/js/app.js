document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll(".exit-btn").forEach(btn => {

    btn.addEventListener("click", (e) => {

      const confirmExit = confirm(
        "Exit analysis and clear your progress?"
      );

      if (!confirmExit) return;

      sessionStorage.clear();
      window.location.href = "/index.html";

    });

  });

});