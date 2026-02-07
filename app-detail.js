let apiBase = "";
const API_PATH = "/api/data";

const backButton = document.getElementById("detail-back");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const pageDue = document.getElementById("page-due");
const pageTime = document.getElementById("page-time");
const pagePriority = document.getElementById("page-priority");
const pageColumn = document.getElementById("page-column");
const pageSave = document.getElementById("page-save");
const pageDelete = document.getElementById("page-delete");

let data = { columns: [], tasks: [] };
let activeTaskId = null;

function getTaskId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function fetchWithFallback(path, options) {
  const candidates = [
    apiBase ? `${apiBase}${path}` : path,
    path,
    "http://localhost:57891" + path,
    "http://127.0.0.1:57891" + path,
  ];
  let lastError = null;
  for (const url of candidates) {
    if (!url) continue;
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      apiBase = new URL(url).origin;
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Failed to reach API");
}

async function loadData() {
  const res = await fetchWithFallback(API_PATH);
  const raw = await res.json();
  data = {
    columns: raw.columns || [],
    tasks: (raw.tasks || []).map((task) => ({ ...task, dueTime: task.dueTime || "" })),
  };
}

async function saveData() {
  await fetchWithFallback(API_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function renderColumnOptions() {
  pageColumn.innerHTML = data.columns
    .map((col) => `<option value="${col.id}">${col.title}</option>`)
    .join("");
}

function loadTask(taskId) {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  pageTitle.value = task.title;
  pageDescription.value = task.description || "";
  pageDue.value = task.dueDate || "";
  pageTime.value = task.dueTime || "";
  pagePriority.value = task.priority || "none";
  pageColumn.value = task.columnId || data.columns[0]?.id;
  return task;
}

function initVanta() {
  if (typeof VANTA === "undefined" || !VANTA.HALO) return;
  VANTA.HALO({
    el: "#vanta",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.0,
    minWidth: 200.0,
    baseColor: 0x060b15,
    backgroundColor: 0x04060c,
    amplitudeFactor: 1.4,
    xOffset: 0.0,
    size: 1.4,
  });
}

async function init() {
  activeTaskId = getTaskId();
  if (!activeTaskId) {
    window.location.href = "/";
    return;
  }
  await loadData();
  renderColumnOptions();
  const task = loadTask(activeTaskId);
  if (!task) {
    window.location.href = "/";
    return;
  }

  backButton.addEventListener("click", () => {
    window.location.href = "/";
  });

  pageSave.addEventListener("click", async () => {
    const target = data.tasks.find((t) => t.id === activeTaskId);
    if (!target) return;
    target.title = pageTitle.value.trim() || target.title;
    target.description = pageDescription.value.trim();
    target.dueDate = pageDue.value;
    target.dueTime = pageTime.value;
    target.priority = pagePriority.value;
    target.columnId = pageColumn.value;
    await saveData();
    window.location.href = "/";
  });

  pageDelete.addEventListener("click", async () => {
    data.tasks = data.tasks.filter((t) => t.id !== activeTaskId);
    await saveData();
    window.location.href = "/";
  });

  initVanta();
}

init();
