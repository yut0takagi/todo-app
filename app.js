let apiBase = "";
const API_PATH = "/api/data";
const state = {
  columns: [],
  tasks: [],
  filter: "all",
  view: "board",
  selectedDate: null,
  selectedTime: "",
  quickAddColumn: "todo",
  search: "",
};

const qs = (sel, parent = document) => parent.querySelector(sel);
const qsa = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

const boardView = qs("#board-view");
const calendarView = qs("#calendar-view");
const columnWrapper = qs("#columns");
const quickAddInput = qs("#quick-add-input");
const quickAddButton = qs("#quick-add-button");
const quickAddMeta = qs("#quick-add-meta");
const viewButtons = qsa("[data-view]");
const searchInput = qs("#global-search");
const commandOpenButton = qs("#command-open");
const calendarGrid = qs("#calendar-grid");
const calendarTitle = qs("#calendar-title");
const calendarPrev = qs("#calendar-prev");
const calendarNext = qs("#calendar-next");
const calendarToday = qs("#calendar-today");
const detailOverlay = qs("#detail-overlay");
const detailPanel = qs("#detail-panel");
const detailTitle = qs("#detail-title");
const detailDescription = qs("#detail-description");
const detailDue = qs("#detail-due");
const detailTime = qs("#detail-time");
const detailPriority = qs("#detail-priority");
const detailColumn = qs("#detail-column");
const detailSave = qs("#detail-save");
const detailDelete = qs("#detail-delete");
const detailOpenPage = qs("#detail-open-page");
const commandOverlay = qs("#command-overlay");
const commandInput = qs("#command-input");
const commandList = qs("#command-list");
const calendarModeButtons = qsa("[data-calendar-mode]");
const weekdayRow = qs("#weekday-row");

let currentMonth = new Date();
let activeTaskId = null;
let calendarMode = "month";
let hoverTimer = null;
let hoverTargetId = null;
let isDraggingCard = false;
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

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
  const data = await res.json();
  state.columns = data.columns || [];
  state.tasks = (data.tasks || []).map((task) => ({
    ...task,
    dueTime: task.dueTime || "",
  }));
}

async function saveData() {
  const payload = JSON.stringify({ columns: state.columns, tasks: state.tasks });
  await fetchWithFallback(API_PATH, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
}

function uid() {
  return crypto.randomUUID();
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function priorityClass(priority) {
  if (priority === "high") return "priority-high";
  if (priority === "medium") return "priority-medium";
  if (priority === "low") return "priority-low";
  return "priority-none";
}

function taskMatches(task) {
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  return (
    task.title.toLowerCase().includes(q) ||
    (task.description || "").toLowerCase().includes(q)
  );
}

function visibleTasks() {
  return state.tasks.filter(taskMatches);
}

function renderBoard() {
  columnWrapper.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const column of state.columns) {
    const colEl = document.createElement("section");
    colEl.className = "column";
    colEl.dataset.columnId = column.id;
    colEl.innerHTML = `
      <header>
        <h3>${column.title}</h3>
        <span class="count">${visibleTasks().filter((t) => t.columnId === column.id).length}</span>
      </header>
      <div class="column-drop" data-dropzone="${column.id}">
      </div>
    `;

    const tasks = visibleTasks()
      .filter((task) => task.columnId === column.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const drop = colEl.querySelector(".column-drop");
    for (const task of tasks) {
      const card = document.createElement("article");
      card.className = `card ${priorityClass(task.priority)}`;
      card.draggable = true;
      card.dataset.taskId = task.id;
      card.innerHTML = `
        <div class="card-header">
          <h4>${task.title}</h4>
          <span class="badge">${task.priority || "none"}</span>
        </div>
        <p>${task.description || ""}</p>
        <div class="card-meta">
          <span>${task.dueDate ? `${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ""}` : "No due"}</span>
          <button class="open" type="button">Open</button>
        </div>
      `;
      drop.appendChild(card);
    }

    fragment.appendChild(colEl);
  }
  columnWrapper.appendChild(fragment);
}

function renderDetailColumnOptions() {
  const options = state.columns
    .map((col) => `<option value="${col.id}">${col.title}</option>`)
    .join("");
  detailColumn.innerHTML = options;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  calendarModeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.calendarMode === calendarMode);
  });
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  if (calendarMode === "week") {
    weekdayRow.innerHTML = ["", ...weekdays].map((d) => `<span>${d}</span>`).join("");
    weekdayRow.style.gridTemplateColumns = "120px repeat(7, 1fr)";
  } else {
    weekdayRow.innerHTML = weekdays.map((d) => `<span>${d}</span>`).join("");
    weekdayRow.style.gridTemplateColumns = "repeat(7, 1fr)";
  }

  if (calendarMode === "day") {
    renderDayView();
    return;
  }
  if (calendarMode === "week") {
    renderWeekView();
    return;
  }
  renderMonthView();
}

function renderMonthView() {
  weekdayRow.style.display = "grid";
  const tasksSource = visibleTasks();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const start = new Date(year, month, 1);
  const startDay = start.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const title = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(currentMonth);
  calendarTitle.textContent = title;
  calendarGrid.className = "calendar-grid month-grid";

  const grid = document.createDocumentFragment();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i += 1) {
    const cell = document.createElement("div");
    cell.className = "day";
    const dayNumber = i - startDay + 1;
    if (dayNumber > 0 && dayNumber <= daysInMonth) {
      const date = new Date(year, month, dayNumber);
      const iso = formatDate(date);
      const tasks = tasksSource.filter((t) => t.dueDate === iso);
      cell.dataset.date = iso;
      cell.innerHTML = `
        <div class="day-header">
          <span>${dayNumber}</span>
          <button class="day-add" type="button">+</button>
        </div>
        <div class="day-tasks">
          ${tasks
            .map(
              (task) => `
                <button class="day-task" data-task-id="${task.id}" draggable="true">${task.title}</button>
              `
            )
            .join("")}
        </div>
      `;
      if (state.selectedDate === iso) {
        cell.classList.add("selected");
      }
    } else {
      cell.classList.add("muted");
      cell.innerHTML = "<span></span>";
    }
    grid.appendChild(cell);
  }
  calendarGrid.appendChild(grid);
}

function renderWeekView() {
  weekdayRow.style.display = "grid";
  const tasksSource = visibleTasks();
  const today = state.selectedDate ? parseDate(state.selectedDate) : new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  calendarTitle.textContent = `${formatDate(start)} - ${formatDate(end)}`;
  calendarGrid.className = "calendar-grid week-grid";

  const grid = document.createDocumentFragment();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return formatDate(date);
  });

  const allDayRow = document.createElement("div");
  allDayRow.className = "time-row";
  allDayRow.innerHTML = `<div class="time-label">All day</div>`;
  days.forEach((iso) => {
    const tasks = tasksSource.filter((t) => t.dueDate === iso && !t.dueTime);
    const cell = document.createElement("div");
    cell.className = "time-cell";
    cell.dataset.date = iso;
    cell.dataset.hour = "";
    cell.innerHTML = `
      <button class="time-add" type="button">+</button>
      <div class="day-tasks">
        ${tasks
          .map(
            (task) => `
              <button class="day-task" data-task-id="${task.id}" draggable="true">${task.title}</button>
            `
          )
          .join("")}
      </div>
    `;
    allDayRow.appendChild(cell);
  });
  grid.appendChild(allDayRow);

  HOURS.forEach((hour) => {
    const row = document.createElement("div");
    row.className = "time-row";
    row.innerHTML = `<div class="time-label">${String(hour).padStart(2, "0")}:00</div>`;
    days.forEach((iso) => {
      const tasks = tasksSource.filter(
        (t) => t.dueDate === iso && t.dueTime?.startsWith(String(hour).padStart(2, "0"))
      );
      const cell = document.createElement("div");
      cell.className = "time-cell";
      cell.dataset.date = iso;
      cell.dataset.hour = String(hour).padStart(2, "0");
      cell.innerHTML = `
        <button class="time-add" type="button">+</button>
        <div class="day-tasks">
          ${tasks
            .map(
              (task) => `
                <button class="day-task" data-task-id="${task.id}" draggable="true">${task.title}</button>
              `
            )
            .join("")}
        </div>
      `;
      row.appendChild(cell);
    });
    grid.appendChild(row);
  });

  calendarGrid.appendChild(grid);
}

function renderDayView() {
  weekdayRow.style.display = "none";
  const tasksSource = visibleTasks();
  const date = state.selectedDate ? parseDate(state.selectedDate) : new Date();
  const iso = formatDate(date);
  const title = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
  calendarTitle.textContent = title;
  calendarGrid.className = "calendar-grid day-grid";

  const grid = document.createDocumentFragment();
  const allDayRow = document.createElement("div");
  allDayRow.className = "time-row";
  allDayRow.innerHTML = `<div class="time-label">All day</div>`;
  const allDayTasks = tasksSource.filter((t) => t.dueDate === iso && !t.dueTime);
  const allDayCell = document.createElement("div");
  allDayCell.className = "time-cell";
  allDayCell.dataset.date = iso;
  allDayCell.dataset.hour = "";
  allDayCell.innerHTML = `
    <button class="time-add" type="button">+</button>
    <div class="day-tasks">
      ${allDayTasks
        .map(
          (task) => `
            <button class="day-task" data-task-id="${task.id}" draggable="true">${task.title}</button>
          `
        )
        .join("")}
    </div>
  `;
  allDayRow.appendChild(allDayCell);
  grid.appendChild(allDayRow);

  HOURS.forEach((hour) => {
    const row = document.createElement("div");
    row.className = "time-row";
    row.innerHTML = `<div class="time-label">${String(hour).padStart(2, "0")}:00</div>`;
    const tasks = tasksSource.filter(
      (t) => t.dueDate === iso && t.dueTime?.startsWith(String(hour).padStart(2, "0"))
    );
    const cell = document.createElement("div");
    cell.className = "time-cell";
    cell.dataset.date = iso;
    cell.dataset.hour = String(hour).padStart(2, "0");
    cell.innerHTML = `
      <button class="time-add" type="button">+</button>
      <div class="day-tasks">
        ${tasks
          .map(
            (task) => `
              <button class="day-task" data-task-id="${task.id}" draggable="true">${task.title}</button>
            `
          )
          .join("")}
      </div>
    `;
    row.appendChild(cell);
    grid.appendChild(row);
  });

  calendarGrid.appendChild(grid);
}

function openTaskDetail(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  activeTaskId = taskId;
  detailOverlay.classList.add("active");
  detailTitle.value = task.title;
  detailDescription.value = task.description || "";
  detailDue.value = task.dueDate || "";
  detailTime.value = task.dueTime || "";
  detailPriority.value = task.priority || "none";
  detailColumn.value = task.columnId || state.columns[0]?.id;
}

function closeTaskDetail() {
  detailOverlay.classList.remove("active");
  activeTaskId = null;
}

function createTask({ title, columnId, dueDate }) {
  const task = {
    id: uid(),
    title,
    description: "",
    columnId,
    dueDate: dueDate || "",
    dueTime: state.selectedTime || "",
    priority: "medium",
    createdAt: new Date().toISOString(),
  };
  state.tasks.unshift(task);
  return task;
}

function setView(view) {
  state.view = view;
  viewButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  boardView.classList.toggle("hidden", view !== "board");
  calendarView.classList.toggle("hidden", view !== "calendar");
  if (view === "calendar") {
    renderCalendar();
  } else {
    renderBoard();
  }
}

function setSelectedDate(value) {
  state.selectedDate = value;
  updateQuickAddMeta();
  renderCalendar();
}

function updateQuickAddMeta() {
  const datePart = state.selectedDate
    ? `${state.selectedDate}${state.selectedTime ? ` ${state.selectedTime}` : ""}`
    : "no date";
  quickAddMeta.textContent = `Adding to ${state.quickAddColumn} • ${datePart}`;
}

function attachBoardEvents() {
  columnWrapper.addEventListener("click", async (event) => {
    const openBtn = event.target.closest(".open");
    if (openBtn) {
      const card = openBtn.closest(".card");
      if (card) openTaskDetail(card.dataset.taskId);
      return;
    }
  });

  columnWrapper.addEventListener("mouseover", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;
    if (event.relatedTarget && card.contains(event.relatedTarget)) return;
    if (detailOverlay.classList.contains("active")) return;
    if (isDraggingCard) return;
    const taskId = card.dataset.taskId;
    hoverTargetId = taskId;
    hoverTimer = setTimeout(() => {
      if (hoverTargetId === taskId) openTaskDetail(taskId);
    }, 1000);
  });

  columnWrapper.addEventListener("mouseout", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;
    if (event.relatedTarget && card.contains(event.relatedTarget)) return;
    hoverTargetId = null;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  });

  columnWrapper.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".card");
    if (!card) return;
    event.dataTransfer.setData("text/plain", card.dataset.taskId);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
    isDraggingCard = true;
  });

  columnWrapper.addEventListener("dragend", (event) => {
    const card = event.target.closest(".card");
    if (card) card.classList.remove("dragging");
    isDraggingCard = false;
  });

  columnWrapper.addEventListener("dragover", (event) => {
    if (!event.target.closest(".column")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  columnWrapper.addEventListener("drop", async (event) => {
    const column = event.target.closest(".column");
    const dropzone = column?.querySelector(".column-drop");
    if (!dropzone) return;
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.columnId = dropzone.dataset.dropzone;
    await saveData();
    renderBoard();
  });
}

function attachCalendarEvents() {
  calendarGrid.addEventListener("click", (event) => {
    const day = event.target.closest(".day, .week-day, .day-focus, .time-cell");
    if (!day || !day.dataset.date) return;

    if (event.target.closest(".day-add") || event.target.closest(".time-add")) {
      const iso = day.dataset.date;
      const hour = day.dataset.hour || "";
      state.selectedTime = hour ? `${hour}:00` : "";
      state.selectedDate = iso;
      updateQuickAddMeta();
      quickAddInput.focus();
      return;
    }

    const dayTask = event.target.closest(".day-task");
    if (dayTask) {
      openTaskDetail(dayTask.dataset.taskId);
      return;
    }

    state.selectedTime = "";
    setSelectedDate(day.dataset.date);
  });

  calendarGrid.addEventListener("dragstart", (event) => {
    const task = event.target.closest(".day-task");
    if (!task) return;
    event.dataTransfer.setData("text/plain", task.dataset.taskId);
    event.dataTransfer.effectAllowed = "move";
  });

  calendarGrid.addEventListener("dragover", (event) => {
    if (!event.target.closest(".day, .week-day, .day-focus, .time-cell")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  calendarGrid.addEventListener("drop", async (event) => {
    const cell = event.target.closest(".day, .week-day, .day-focus, .time-cell");
    if (!cell || !cell.dataset.date) return;
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.dueDate = cell.dataset.date;
    task.dueTime = cell.dataset.hour ? `${cell.dataset.hour}:00` : "";
    await saveData();
    renderBoard();
    renderCalendar();
  });

  calendarPrev.addEventListener("click", () => {
    if (calendarMode === "month") {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    } else if (calendarMode === "week") {
      const base = state.selectedDate ? parseDate(state.selectedDate) : new Date();
      base.setDate(base.getDate() - 7);
      state.selectedDate = formatDate(base);
    } else {
      const base = state.selectedDate ? parseDate(state.selectedDate) : new Date();
      base.setDate(base.getDate() - 1);
      state.selectedDate = formatDate(base);
    }
    renderCalendar();
  });

  calendarNext.addEventListener("click", () => {
    if (calendarMode === "month") {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    } else if (calendarMode === "week") {
      const base = state.selectedDate ? parseDate(state.selectedDate) : new Date();
      base.setDate(base.getDate() + 7);
      state.selectedDate = formatDate(base);
    } else {
      const base = state.selectedDate ? parseDate(state.selectedDate) : new Date();
      base.setDate(base.getDate() + 1);
      state.selectedDate = formatDate(base);
    }
    renderCalendar();
  });

  calendarToday.addEventListener("click", () => {
    currentMonth = new Date();
    state.selectedDate = formatDate(new Date());
    state.selectedTime = "";
    updateQuickAddMeta();
    renderCalendar();
  });
}

function attachQuickAdd() {
  quickAddButton.addEventListener("click", async () => {
    const title = quickAddInput.value.trim();
    if (!title) return;
    createTask({ title, columnId: state.quickAddColumn, dueDate: state.selectedDate });
    quickAddInput.value = "";
    await saveData();
    renderBoard();
    renderCalendar();
  });

  quickAddInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      quickAddButton.click();
    }
  });
}

function attachDetailEvents() {
  detailSave.addEventListener("click", async () => {
    const task = state.tasks.find((t) => t.id === activeTaskId);
    if (!task) return;
    task.title = detailTitle.value.trim() || task.title;
    task.description = detailDescription.value.trim();
    task.dueDate = detailDue.value;
    task.dueTime = detailTime.value;
    task.priority = detailPriority.value;
    task.columnId = detailColumn.value;
    await saveData();
    renderBoard();
    renderCalendar();
    closeTaskDetail();
  });

  detailDelete.addEventListener("click", async () => {
    if (!activeTaskId) return;
    state.tasks = state.tasks.filter((t) => t.id !== activeTaskId);
    await saveData();
    renderBoard();
    renderCalendar();
    closeTaskDetail();
  });

  qs("#detail-close").addEventListener("click", closeTaskDetail);
  detailOverlay.addEventListener("click", (event) => {
    if (event.target === detailOverlay) closeTaskDetail();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTaskDetail();
  });
  detailOpenPage.addEventListener("click", () => {
    if (!activeTaskId) return;
    const id = activeTaskId;
    closeTaskDetail();
    window.location.href = `/detail.html?id=${encodeURIComponent(id)}`;
  });
}

function attachViewSwitcher() {
  viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setView(btn.dataset.view);
    });
  });
}

function openCommandPalette() {
  commandOverlay.classList.add("active");
  commandInput.value = "";
  renderCommandList();
  commandInput.focus();
}

function closeCommandPalette() {
  commandOverlay.classList.remove("active");
}

function renderCommandList() {
  const q = commandInput.value.trim().toLowerCase();
  const commands = [
    { label: "New task", action: () => quickAddInput.focus() },
    { label: "Go to Board", action: () => setView("board") },
    { label: "Go to Calendar", action: () => setView("calendar") },
    { label: "Calendar: Day view", action: () => { calendarMode = "day"; renderCalendar(); } },
    { label: "Calendar: Week view", action: () => { calendarMode = "week"; renderCalendar(); } },
    { label: "Calendar: Month view", action: () => { calendarMode = "month"; renderCalendar(); } },
    { label: "Focus search", action: () => searchInput.focus() },
    {
      label: "Today",
      action: () => {
        currentMonth = new Date();
        state.selectedDate = formatDate(new Date());
        state.selectedTime = "";
        updateQuickAddMeta();
        renderCalendar();
      },
    },
  ];
  const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(q));
  commandList.innerHTML = filtered
    .map((cmd, idx) => `<button data-command-index="${idx}">${cmd.label}</button>`)
    .join("");
  commandList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const command = filtered[Number(btn.dataset.commandIndex)];
      if (command) command.action();
      closeCommandPalette();
    });
  });
}

function attachCalendarMode() {
  calendarModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      calendarModeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      calendarMode = btn.dataset.calendarMode;
      renderCalendar();
    });
  });
}

function attachGlobalShortcuts() {
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    renderBoard();
    renderCalendar();
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      state.search = "";
      renderBoard();
      renderCalendar();
      searchInput.blur();
    }
  });

  commandOpenButton.addEventListener("click", openCommandPalette);
  commandInput.addEventListener("input", renderCommandList);
  commandInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = commandList.querySelector("button");
      if (first) first.click();
    }
  });
  commandOverlay.addEventListener("click", (event) => {
    if (event.target === commandOverlay) closeCommandPalette();
  });
  window.addEventListener("keydown", (event) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? event.metaKey : event.ctrlKey;
    const tag = document.activeElement?.tagName;
    const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (mod && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (event.key === "/" && !isTyping && !commandOverlay.classList.contains("active")) {
      event.preventDefault();
      searchInput.focus();
      return;
    }

    if (event.key.toLowerCase() === "n" && !isTyping && !commandOverlay.classList.contains("active")) {
      event.preventDefault();
      quickAddInput.focus();
      return;
    }

    if (event.key === "Escape" && commandOverlay.classList.contains("active")) {
      closeCommandPalette();
    }
  });
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
  await loadData();
  renderDetailColumnOptions();
  updateQuickAddMeta();
  renderBoard();
  renderCalendar();
  attachBoardEvents();
  attachCalendarEvents();
  attachQuickAdd();
  attachDetailEvents();
  attachViewSwitcher();
  attachCalendarMode();
  attachGlobalShortcuts();
  initVanta();
}

init();
