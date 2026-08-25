/* =========================================================
   FocusTrack — script.js
   Vanilla JS task tracker. Works with the existing HTML/CSS.
   Task array is the single source of truth; the DOM is
   re-rendered from state on every change.
   ========================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     CONSTANTS
     --------------------------------------------------------- */

  const STORAGE_KEY = "focusTrackTasks";

  // Categories that must always exist in the "By Category" list.
  const CATEGORY_LIST_DEFAULTS = ["work", "personal", "health"];

  // Categories that must always exist as status/progress cards.
  const STATUS_CARD_DEFAULTS = ["work", "study", "health"];

  // Display labels for every known category.
  const CATEGORY_LABELS = {
    work: "Work",
    personal: "Personal",
    health: "Health",
    study: "Study",
    others: "Others",
  };

  // Colors used for the category pie chart (conic-gradient slices).
  const CATEGORY_COLORS = {
    work: "#6366f1",
    personal: "#f59e0b",
    health: "#10b981",
    study: "#3b82f6",
    others: "#ec4899",
  };

  const DEFAULT_CHART_COLOR = "#2a2f3a";

  /* ---------------------------------------------------------
     STATE
     --------------------------------------------------------- */

  let tasks = [];
  let currentFilter = "all"; // "all" | "pending" | "done"

  /* ---------------------------------------------------------
     DOM REFERENCES (queried once; guarded against null)
     --------------------------------------------------------- */

  const dateEl = document.getElementById("date");

  const totalTaskEl = document.getElementById("total-task");
  const completedEl = document.getElementById("completed");
  const remainingEl = document.getElementById("remaining");
  const progressPercentageEl = document.getElementById("progress-percentage");

  const progressTextEl = document.getElementById("progress-text");
  const progressFillEl = document.getElementById("progress-fill");

  const inputBarEl = document.querySelector(".input-bar");
  const todoTypeEl = document.querySelector(".todo-type");
  const priorityEl = document.querySelector(".priority");
  const addBtnEl = document.querySelector(".add-btn");

  const sectionsEl = document.getElementById("sections");
  const allCountEl = document.getElementById("allcount");
  const pendingCountEl = document.getElementById("pendingcount");
  const doneCountEl = document.getElementById("donecount");

  const taskListEl = document.getElementById("taskList");

  const categoryChartEl = document.getElementById("category-chart");
  const categoryListEl = document.getElementById("categorylist");

  const statusCardsEl = document.getElementById("statusCards");

  /* ---------------------------------------------------------
     UTILITIES
     --------------------------------------------------------- */

  function generateId() {
    return "task-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || (category ? category.charAt(0).toUpperCase() + category.slice(1) : "Others");
  }

  function categoryColor(category) {
    return CATEGORY_COLORS[category] || DEFAULT_CHART_COLOR;
  }

  /* ---------------------------------------------------------
     LOCAL STORAGE
     --------------------------------------------------------- */

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      // Storage might be full or unavailable (private mode, etc.) — fail silently.
      console.warn("FocusTrack: could not save tasks to localStorage.", err);
    }
  }

  function loadTasks() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn("FocusTrack: could not read localStorage.", err);
      tasks = [];
      return;
    }

    if (!raw) {
      tasks = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        tasks = parsed
          .filter((t) => t && typeof t === "object" && typeof t.text === "string")
          .map((t) => ({
            id: typeof t.id === "string" ? t.id : generateId(),
            text: t.text,
            category: typeof t.category === "string" ? t.category : "others",
            priority: typeof t.priority === "string" ? t.priority : "medium",
            completed: Boolean(t.completed),
          }));
      } else {
        tasks = [];
      }
    } catch (err) {
      console.warn("FocusTrack: corrupted localStorage data, resetting.", err);
      tasks = [];
    }
  }

  /* ---------------------------------------------------------
     DATE
     --------------------------------------------------------- */

  function updateDate() {
    if (!dateEl) return;
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    dateEl.textContent = formatted;
  }

  /* ---------------------------------------------------------
     TASK CREATION / MUTATION
     --------------------------------------------------------- */

  function addTask() {
    if (!inputBarEl) return;

    const text = inputBarEl.value.trim();
    if (!text) return;

    const category = todoTypeEl && todoTypeEl.value ? todoTypeEl.value : "others";
    const priority = priorityEl && priorityEl.value ? priorityEl.value : "medium";

    const newTask = {
      id: generateId(),
      text: text,
      category: category,
      priority: priority,
      completed: false,
    };

    tasks.push(newTask);

    inputBarEl.value = "";
    inputBarEl.focus();

    commitChange();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    commitChange();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    commitChange();
  }

  // Central place to call after any state mutation: persist + re-render everything.
  function commitChange() {
    saveTasks();
    renderAll();
  }

  /* ---------------------------------------------------------
     RENDER: TASK LIST
     --------------------------------------------------------- */

  function getFilteredTasks() {
    if (currentFilter === "pending") return tasks.filter((t) => !t.completed);
    if (currentFilter === "done") return tasks.filter((t) => t.completed);
    return tasks;
  }

  function createTaskElement(task) {
    const item = document.createElement("div");
    item.className = "task-item" + (task.completed ? " completed" : "");
    item.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;

    // Text + meta wrapper
    const details = document.createElement("div");
    details.className = "task-details";

    const textEl = document.createElement("p");
    textEl.className = "task-text";
    textEl.textContent = task.text;

    const metaEl = document.createElement("span");
    metaEl.className = "task-meta";
    metaEl.textContent = categoryLabel(task.category).toUpperCase() + " • " + task.priority.toUpperCase();

    details.appendChild(textEl);
    details.appendChild(metaEl);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", "Remove task");
    deleteBtn.textContent = "×";

    item.appendChild(checkbox);
    item.appendChild(details);
    item.appendChild(deleteBtn);

    return item;
  }

  function renderTasks() {
    if (!taskListEl) return;

    taskListEl.innerHTML = "";

    const visibleTasks = getFilteredTasks();
    const fragment = document.createDocumentFragment();

    visibleTasks.forEach((task) => {
      fragment.appendChild(createTaskElement(task));
    });

    taskListEl.appendChild(fragment);
  }

  /* ---------------------------------------------------------
     RENDER: COUNTERS + OVERALL PROGRESS
     --------------------------------------------------------- */

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const remaining = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (totalTaskEl) totalTaskEl.textContent = String(total);
    if (completedEl) completedEl.textContent = String(completed);
    if (remainingEl) remainingEl.textContent = String(remaining);
    if (progressPercentageEl) progressPercentageEl.textContent = percentage + "%";

    if (allCountEl) allCountEl.textContent = String(total);
    if (pendingCountEl) pendingCountEl.textContent = String(remaining);
    if (doneCountEl) doneCountEl.textContent = String(completed);
  }

  function updateOverallProgress() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    if (progressTextEl) progressTextEl.textContent = completed + " out of " + total + " done";
    if (progressFillEl) progressFillEl.style.width = percentage + "%";
  }

  /* ---------------------------------------------------------
     RENDER: CATEGORY STATISTICS (By Category list)
     --------------------------------------------------------- */

  function getCategoryBreakdown() {
    // Map of category -> { total, completed }
    const breakdown = {};
    tasks.forEach((task) => {
      const cat = task.category || "others";
      if (!breakdown[cat]) breakdown[cat] = { total: 0, completed: 0 };
      breakdown[cat].total += 1;
      if (task.completed) breakdown[cat].completed += 1;
    });
    return breakdown;
  }

  function updateCategoryStats() {
    if (!categoryListEl) return;

    const breakdown = getCategoryBreakdown();

    // Categories that must be visible: the fixed defaults, plus any
    // category that currently has at least one task.
    const categoriesToShow = new Set(CATEGORY_LIST_DEFAULTS);
    Object.keys(breakdown).forEach((cat) => categoriesToShow.add(cat));

    // Remove any dynamically-created item whose category no longer
    // qualifies (i.e. not a default and has zero tasks).
    Array.from(categoryListEl.querySelectorAll(".category-item")).forEach((el) => {
      const cat = el.dataset.category;
      if (!categoriesToShow.has(cat)) {
        el.remove();
      }
    });

    categoriesToShow.forEach((cat) => {
      const stats = breakdown[cat] || { total: 0, completed: 0 };
      let item = categoryListEl.querySelector('.category-item[data-category="' + cat + '"]');

      if (!item) {
        item = document.createElement("div");
        item.className = "category-item";
        item.dataset.category = cat;

        const nameWrap = document.createElement("div");
        nameWrap.className = "category-name";

        const box = document.createElement("span");
        box.className = "category-box";
        box.style.backgroundColor = categoryColor(cat);

        const label = document.createElement("span");
        label.textContent = categoryLabel(cat);

        nameWrap.appendChild(box);
        nameWrap.appendChild(label);

        const countEl = document.createElement("span");
        countEl.className = "category-count";

        item.appendChild(nameWrap);
        item.appendChild(countEl);
        categoryListEl.appendChild(item);
      }

      const countEl = item.querySelector(".category-count");
      if (countEl) countEl.textContent = stats.completed + " / " + stats.total;

      // Keep the color box in sync even for pre-existing (HTML-authored) items.
      const boxEl = item.querySelector(".category-box");
      if (boxEl) boxEl.style.backgroundColor = categoryColor(cat);
    });
  }

  /* ---------------------------------------------------------
     RENDER: CATEGORY PIE CHART
     --------------------------------------------------------- */

  function updateCategoryChart() {
    if (!categoryChartEl) return;

    const total = tasks.length;

    if (total === 0) {
      categoryChartEl.style.background = DEFAULT_CHART_COLOR;
      return;
    }

    const breakdown = getCategoryBreakdown();
    const categories = Object.keys(breakdown);

    let cumulativePercent = 0;
    const segments = [];

    categories.forEach((cat) => {
      const count = breakdown[cat].total;
      const percent = (count / total) * 100;
      const start = cumulativePercent;
      const end = cumulativePercent + percent;
      segments.push(categoryColor(cat) + " " + start + "% " + end + "%");
      cumulativePercent = end;
    });

    categoryChartEl.style.background = "conic-gradient(" + segments.join(", ") + ")";
  }

  /* ---------------------------------------------------------
     RENDER: CATEGORY PROGRESS CARDS
     --------------------------------------------------------- */

  function updateCategoryProgressCards() {
    if (!statusCardsEl) return;

    const breakdown = getCategoryBreakdown();

    const categoriesToShow = new Set(STATUS_CARD_DEFAULTS);
    Object.keys(breakdown).forEach((cat) => categoriesToShow.add(cat));

    // Remove dynamically-created cards that no longer qualify.
    Array.from(statusCardsEl.querySelectorAll(".status-card")).forEach((el) => {
      const cat = el.dataset.category;
      if (!categoriesToShow.has(cat)) {
        el.remove();
      }
    });

    categoriesToShow.forEach((cat) => {
      const stats = breakdown[cat] || { total: 0, completed: 0 };
      let card = statusCardsEl.querySelector('.status-card[data-category="' + cat + '"]');

      if (!card) {
        card = document.createElement("div");
        card.className = "status-card";
        card.dataset.category = cat;

        const header = document.createElement("div");
        header.className = "status-header";

        const strong = document.createElement("strong");
        strong.textContent = categoryLabel(cat).toUpperCase();

        const progressText = document.createElement("span");
        progressText.className = "status-progress-text";

        header.appendChild(strong);
        header.appendChild(progressText);

        const bar = document.createElement("div");
        bar.className = "status-progress-bar";

        const fill = document.createElement("div");
        fill.className = "status-progress-fill";

        bar.appendChild(fill);

        card.appendChild(header);
        card.appendChild(bar);

        statusCardsEl.appendChild(card);
      }

      const percentage = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

      const progressTextEl = card.querySelector(".status-progress-text");
      const fillEl = card.querySelector(".status-progress-fill");

      if (progressTextEl) progressTextEl.textContent = stats.completed + " of " + stats.total + " done";
      if (fillEl) fillEl.style.width = percentage + "%";
    });
  }

  /* ---------------------------------------------------------
     FILTER SECTIONS (All / Pending / Done)
     --------------------------------------------------------- */

  function setActiveSection(sectionEl) {
    if (!sectionsEl) return;
    Array.from(sectionsEl.querySelectorAll(".section")).forEach((el) => {
      el.classList.remove("active");
    });
    sectionEl.classList.add("active");
  }

  function handleSectionClick(event) {
    const sectionEl = event.target.closest(".section");
    if (!sectionEl || !sectionsEl.contains(sectionEl)) return;

    const type = sectionEl.dataset.type;
    if (!type) return;

    currentFilter = type;
    setActiveSection(sectionEl);
    renderTasks();
  }

  /* ---------------------------------------------------------
     MASTER RENDER
     --------------------------------------------------------- */

  function renderAll() {
    renderTasks();
    updateStats();
    updateOverallProgress();
    updateCategoryStats();
    updateCategoryChart();
    updateCategoryProgressCards();
  }

  /* ---------------------------------------------------------
     EVENT WIRING
     --------------------------------------------------------- */

  function initEventListeners() {
    if (addBtnEl) {
      addBtnEl.addEventListener("click", addTask);
    }

    if (inputBarEl) {
      inputBarEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTask();
        }
      });
    }

    if (sectionsEl) {
      sectionsEl.addEventListener("click", handleSectionClick);
    }

    // Event delegation for dynamically created task items.
    if (taskListEl) {
      taskListEl.addEventListener("change", (event) => {
        if (event.target.classList.contains("task-checkbox")) {
          const itemEl = event.target.closest(".task-item");
          if (itemEl) toggleTask(itemEl.dataset.id);
        }
      });

      taskListEl.addEventListener("click", (event) => {
        if (event.target.classList.contains("delete-btn")) {
          const itemEl = event.target.closest(".task-item");
          if (itemEl) deleteTask(itemEl.dataset.id);
        }
      });
    }
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */

  function init() {
    updateDate();
    loadTasks();
    initEventListeners();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

/* =========================================================
   Productivity Calendar
   ========================================================= */

const calendarWrapper =
    document.getElementById("calendarWrapper");

const calendarPickerBtn =
    document.getElementById("calendarPickerBtn");

const calendarRange =
    document.getElementById("calendar-range");


/* =========================================================
   Custom Cyberpunk Month Picker
   ========================================================= */

const monthPicker =
    document.getElementById("monthPicker");

const monthPickerClose =
    document.getElementById("monthPickerClose");

const monthGrid =
    document.getElementById("monthGrid");

const pickerYear =
    document.getElementById("pickerYear");

const monthPrevYear =
    document.getElementById("monthPrevYear");

const monthNextYear =
    document.getElementById("monthNextYear");

const monthTodayBtn =
    document.getElementById("monthTodayBtn");


/* =========================================================
   Calendar State
   ========================================================= */

let selectedCalendarYear;
let selectedCalendarMonth;

let pickerSelectedYear;


/* =========================================================
   Weekdays
   Friday → Thursday
   ========================================================= */

const weekdays = [
    "Fri",
    "Sat",
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu"
];


/* =========================================================
   Month Names
   ========================================================= */

const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC"
];


/* =========================================================
   Get Saved Tasks
   ========================================================= */

function getSavedTasks() {

    try {

        const saved =
            localStorage.getItem(
                "focusTrackTasks"
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.warn(
            "FocusTrack: could not read calendar task data.",
            error
        );

        return [];

    }

}


/* =========================================================
   Check Completed Date
   ========================================================= */

function isDateCompleted(dateString) {

    const savedTasks =
        getSavedTasks();

    return savedTasks.some(
        task =>
            task &&
            task.completed === true &&
            task.completedAt === dateString
    );

}


/* =========================================================
   Calendar Picker
   ========================================================= */


/* Open picker */

calendarPickerBtn.addEventListener(
    "click",
    (event) => {

        event.stopPropagation();

        pickerSelectedYear =
            selectedCalendarYear;

        renderMonthPicker();

        monthPicker.classList.toggle(
            "open"
        );

    }
);


/* Close button */

monthPickerClose.addEventListener(
    "click",
    () => {

        monthPicker.classList.remove(
            "open"
        );

    }
);


/* Previous year */

monthPrevYear.addEventListener(
    "click",
    () => {

        pickerSelectedYear--;

        renderMonthPicker();

    }
);


/* Next year */

monthNextYear.addEventListener(
    "click",
    () => {

        pickerSelectedYear++;

        renderMonthPicker();

    }
);


/* Current month */

monthTodayBtn.addEventListener(
    "click",
    () => {

        const today =
            new Date();

        const year =
            today.getFullYear();

        const month =
            today.getMonth() + 1;

        pickerSelectedYear =
            year;

        selectCalendarMonth(
            year,
            month
        );

    }
);


/* Prevent picker clicks from bubbling */

monthPicker.addEventListener(
    "click",
    (event) => {

        event.stopPropagation();

    }
);


/* Close picker when clicking outside */

document.addEventListener(
    "click",
    () => {

        monthPicker.classList.remove(
            "open"
        );

    }
);


/* =========================================================
   Render Month Picker
   ========================================================= */

function renderMonthPicker() {

    pickerYear.textContent =
        pickerSelectedYear;

    monthGrid.innerHTML =
        "";

    const today =
        new Date();


    monthNames.forEach(
        (
            monthName,
            index
        ) => {

            const monthNumber =
                index + 1;

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "month-option";

            button.textContent =
                monthName;


            /* -----------------------------------------
               Selected month
               ----------------------------------------- */

            if (
                pickerSelectedYear ===
                    selectedCalendarYear &&

                monthNumber ===
                    selectedCalendarMonth
            ) {

                button.classList.add(
                    "selected"
                );

            }


            /* -----------------------------------------
               Current real month
               ----------------------------------------- */

            if (
                pickerSelectedYear ===
                    today.getFullYear() &&

                monthNumber ===
                    today.getMonth() + 1
            ) {

                button.classList.add(
                    "current"
                );

            }


            /* -----------------------------------------
               Select month
               ----------------------------------------- */

            button.addEventListener(
                "click",
                () => {

                    selectCalendarMonth(
                        pickerSelectedYear,
                        monthNumber
                    );

                }
            );


            monthGrid.appendChild(
                button
            );

        }
    );

}


/* =========================================================
   Select Calendar Month
   ========================================================= */

function selectCalendarMonth(
    year,
    month
) {

    selectedCalendarYear =
        year;

    selectedCalendarMonth =
        month;

    renderCalendar(
        year,
        month
    );

    monthPicker.classList.remove(
        "open"
    );

}


/* =========================================================
   Get Month Name
   ========================================================= */

function getMonthName(
    year,
    month
) {

    return new Date(
        year,
        month - 1,
        1
    ).toLocaleString(
        "en-US",
        {
            month: "long"
        }
    );

}


/* =========================================================
   Get Days In Month
   ========================================================= */

function getDaysInMonth(
    year,
    month
) {

    return new Date(
        year,
        month,
        0
    ).getDate();

}


/* =========================================================
   Convert Weekday

   JS:
   Sunday = 0
   Monday = 1
   ...
   Friday = 5
   Saturday = 6

   Our order:
   Friday → Thursday
   ========================================================= */

function convertWeekday(
    jsDay
) {

    return (
        jsDay + 2
    ) % 7;

}


/* =========================================================
   Create Month
   ========================================================= */

function createMonth(
    year,
    month
) {

    const monthElement =
        document.createElement(
            "div"
        );

    monthElement.className =
        "calendar-month";


    /* -----------------------------------------
       Month title
       ----------------------------------------- */

    const title =
        document.createElement(
            "p"
        );

    title.className =
        "calendar-month-title";

    title.textContent =
        `${getMonthName(year, month)} ${year}`;

    monthElement.appendChild(
        title
    );


    /* -----------------------------------------
       Grid
       ----------------------------------------- */

    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "calendar-grid";


    const daysInMonth =
        getDaysInMonth(
            year,
            month
        );


    /* -----------------------------------------
       Store dates by weekday
       ----------------------------------------- */

    const datesByWeekday = [
        [],
        [],
        [],
        [],
        [],
        [],
        []
    ];


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const date =
            new Date(
                year,
                month - 1,
                day
            );

        const weekday =
            convertWeekday(
                date.getDay()
            );

        datesByWeekday[
            weekday
        ].push(day);

    }


    /* -----------------------------------------
       Maximum columns
       ----------------------------------------- */

    const columnCount =
        Math.max(
            ...datesByWeekday.map(
                days =>
                    days.length
            )
        );


    /*
       First column:
       weekday label

       Remaining columns:
       dates
    */

    grid.style.gridTemplateColumns =
        `45px repeat(${columnCount}, 18px)`;


    /* -----------------------------------------
       Create weekday rows
       ----------------------------------------- */

    weekdays.forEach(
        (
            weekday,
            rowIndex
        ) => {

            /* -----------------------------------------
               Weekday label
               ----------------------------------------- */

            const label =
                document.createElement(
                    "div"
                );

            label.className =
                "calendar-day-name";

            label.textContent =
                weekday;

            grid.appendChild(
                label
            );


            /* -----------------------------------------
               Dates
               ----------------------------------------- */

            const dates =
                datesByWeekday[
                    rowIndex
                ];


            for (
                let column = 0;
                column < columnCount;
                column++
            ) {

                const cell =
                    document.createElement(
                        "div"
                    );

                cell.className =
                    "calendar-cell";


                /* -----------------------------------------
                   Empty slot
                   ----------------------------------------- */

                if (
                    column >=
                    dates.length
                ) {

                    cell.classList.add(
                        "empty"
                    );

                    grid.appendChild(
                        cell
                    );

                    continue;

                }


                const day =
                    dates[column];


                /* -----------------------------------------
                   YYYY-MM-DD
                   ----------------------------------------- */

                const dateString =
                    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                cell.dataset.date =
                    dateString;


                cell.title =
                    `${getMonthName(
                        year,
                        month
                    )} ${day}, ${year}`;


                /* -----------------------------------------
                   COMPLETED TASK DAY
                   ----------------------------------------- */

                if (
                    isDateCompleted(
                        dateString
                    )
                ) {

                    cell.classList.add(
                        "completed"
                    );

                    cell.title =
                        `${getMonthName(
                            year,
                            month
                        )} ${day}, ${year} • COMPLETED`;

                }


                /* -----------------------------------------
                   Today
                   ----------------------------------------- */

                const today =
                    new Date();


                if (
                    today.getFullYear() ===
                        year &&

                    today.getMonth() + 1 ===
                        month &&

                    today.getDate() ===
                        day
                ) {

                    cell.classList.add(
                        "today"
                    );

                }


                /* -----------------------------------------
                   Date click
                   ----------------------------------------- */

                cell.addEventListener(
                    "click",
                    () => {

                        console.log(
                            "Selected date:",
                            cell.dataset.date
                        );

                    }
                );


                grid.appendChild(
                    cell
                );

            }

        }
    );


    monthElement.appendChild(
        grid
    );


    return monthElement;

}


/* =========================================================
   Render 4 Months

   Previous 1
   Selected
   Next 1
   Next 2
   ========================================================= */

function renderCalendar(
    selectedYear,
    selectedMonth
) {

    calendarWrapper.innerHTML =
        "";


    /* -----------------------------------------
       Start from previous month
       ----------------------------------------- */

    const startDate =
        new Date(
            selectedYear,
            selectedMonth - 2,
            1
        );


    /* -----------------------------------------
       Render 4 months
       ----------------------------------------- */

    for (
        let i = 0;
        i < 4;
        i++
    ) {

        const date =
            new Date(
                startDate.getFullYear(),
                startDate.getMonth() + i,
                1
            );


        const year =
            date.getFullYear();

        const month =
            date.getMonth() + 1;


        calendarWrapper.appendChild(
            createMonth(
                year,
                month
            )
        );

    }


    /* -----------------------------------------
       Header range
       ----------------------------------------- */

    calendarRange.textContent =
        `${getMonthName(
            selectedYear,
            selectedMonth
        )} ${selectedYear}`;

}


/* =========================================================
   Initial Calendar
   ========================================================= */

const now =
    new Date();

selectedCalendarYear =
    now.getFullYear();

selectedCalendarMonth =
    now.getMonth() + 1;

pickerSelectedYear =
    selectedCalendarYear;


/* -----------------------------------------
   Initial render
   ----------------------------------------- */

renderCalendar(
    selectedCalendarYear,
    selectedCalendarMonth
);


/* -----------------------------------------
   Initial picker render
   ----------------------------------------- */

renderMonthPicker();
