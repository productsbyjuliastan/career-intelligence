const STORAGE_KEY = "career_app_state";
const RESULT_KEY = "career_app_result";

function getState() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      education: {
        level: "",
        majors: [],
        minors: [],
        certificateTitle: "",
        certificateHours: "",
        courses: []
      },
      skills: [],
      interests: [],
      targetCareer: ""
    };
  }
  return JSON.parse(raw);
}

function setState(nextState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function updateState(partial) {
  const current = getState();
  const next = { ...current, ...partial };
  setState(next);
}

function clearState() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(RESULT_KEY);
}

function setResult(result) {
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

function getResult() {
  const raw = sessionStorage.getItem(RESULT_KEY);
  return raw ? JSON.parse(raw) : null;
}