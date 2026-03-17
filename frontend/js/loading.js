document.addEventListener("DOMContentLoaded", async () => {
  const messages = [
    "Evaluating your education...",
    "Matching your skills to careers...",
    "Finding unexpected paths...",
    "Preparing your results..."
  ];

  const loadingText = document.getElementById("loading-text");
  let i = 0;

  const interval = setInterval(() => {
    loadingText.textContent = messages[i % messages.length];
    i += 1;
  }, 900);

  try {
    const state = getState();

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      throw new Error("Failed to analyze");
    }

    const data = await response.json();
    setResult(data);
    clearInterval(interval);
    window.location.href = "/career-view.html";
  } catch (error) {
    console.error(error);
    clearInterval(interval);
    loadingText.textContent = "Something went wrong while analyzing your profile.";
  }
});