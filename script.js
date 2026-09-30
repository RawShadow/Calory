const STORAGE_KEY = "calory-tracker-v1";
const THEME_KEY = "calory-theme-v1";

const defaultState = {
    goals: {
        calories: 2000,
        protein: 140,
        carbs: 220,
        fat: 65
    },
    logs: {
        // YYYY-MM-DD: [{ id, meal, name, calories, protein, carbs, fat, quantity }]
    }
};

const quickFoods = [
    { name: "Chicken breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: "per 100g" },
    { name: "Cooked white rice", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: "per 100g" },
    { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, unit: "per medium" },
    { name: "Egg", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, unit: "per egg" },
    { name: "Paneer", calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, unit: "per 100g" },
    { name: "Oats", calories: 150, protein: 5, carbs: 27, fat: 2.5, unit: "per 40g" },
    { name: "Greek yogurt", calories: 100, protein: 10, carbs: 6, fat: 3, unit: "per 100g" },
    { name: "Almonds", calories: 164, protein: 6, carbs: 6, fat: 14, unit: "per 28g" }
];

const mealOrder = ["Breakfast", "Lunch", "Dinner", "Snacks"];
let state = loadState();
let selectedDate = localDateKey(new Date());
let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(defaultState);
        const parsed = JSON.parse(raw);
        return {
            goals: { ...defaultState.goals, ...(parsed.goals || {}) },
            logs: parsed.logs || {}
        };
    } catch {
        return structuredClone(defaultState);
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function localDateKey(date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function dateFromKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function formatDate(key, options = {}) {
    return dateFromKey(key).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        ...options
    });
}

function friendlyDate(key) {
    const today = localDateKey(new Date());
    const yesterday = localDateKey(new Date(Date.now() - 86400000));
    const tomorrow = localDateKey(new Date(Date.now() + 86400000));

    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
    if (key === tomorrow) return "Tomorrow";
    return formatDate(key, { weekday: "short" });
}

function getEntries(key = selectedDate) {
    return state.logs[key] || [];
}

function totalsFor(entries) {
    return entries.reduce((acc, entry) => {
        acc.calories += Number(entry.calories) || 0;
        acc.protein += Number(entry.protein) || 0;
        acc.carbs += Number(entry.carbs) || 0;
        acc.fat += Number(entry.fat) || 0;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function groupedEntries(key) {
    const groups = {};
    for (const meal of mealOrder) groups[meal] = [];
    for (const entry of getEntries(key)) {
        if (!groups[entry.meal]) groups[entry.meal] = [];
        groups[entry.meal].push(entry);
    }
    return groups;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}

function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function updateDashboard() {
    const totals = totalsFor(getEntries());
    const goals = state.goals;
    const left = goals.calories - totals.calories;
    const percent = goals.calories > 0 ? Math.min((totals.calories / goals.calories) * 100, 100) : 0;

    $("#caloriesLeft").textContent = formatNumber(Math.max(left, 0));
    $("#caloriesConsumed").textContent = formatNumber(totals.calories);
    $("#calorieGoalText").textContent = formatNumber(goals.calories);
    $("#proteinValue").textContent = formatNumber(totals.protein, 1);
    $("#carbsValue").textContent = formatNumber(totals.carbs, 1);
    $("#fatValue").textContent = formatNumber(totals.fat, 1);

    $("#proteinGoalText").textContent = `${formatNumber(goals.protein)}g`;
    $("#carbsGoalText").textContent = `${formatNumber(goals.carbs)}g`;
    $("#fatGoalText").textContent = `${formatNumber(goals.fat)}g`;

    setMeter("#proteinMeter", totals.protein, goals.protein);
    setMeter("#carbsMeter", totals.carbs, goals.carbs);
    setMeter("#fatMeter", totals.fat, goals.fat);

    $("#ringPercent").textContent = `${Math.round(percent)}%`;
    const angle = Math.round((percent / 100) * 360);
    const ringColor = getComputedStyle(document.body).getPropertyValue("--text").trim();
    const ringBg = getComputedStyle(document.body).getPropertyValue("--surface-2").trim();
    $("#calorieRing").style.background =
        `conic-gradient(${ringColor} 0deg ${angle}deg, ${ringBg} ${angle}deg 360deg)`;

    $("#todayLabel").textContent = formatDate(localDateKey(new Date()), { weekday: "short" });
    renderMealOverview();
    updateInsight(totals, left);
    drawWeeklyChart();
}

function setMeter(selector, value, goal) {
    const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    $(selector).style.width = `${pct}%`;
}

function renderMealOverview() {
    const entries = getEntries();
    const groups = groupedEntries(selectedDate);
    const container = $("#mealOverviewList");

    if (!entries.length) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>Your log is empty.</strong>
                <span>Start with breakfast, lunch, dinner, or a snack.</span>
            </div>`;
        return;
    }

    const rows = [];
    mealOrder.forEach(meal => {
        const items = groups[meal] || [];
        if (!items.length) return;
        const total = totalsFor(items);
        rows.push(`
            <div class="meal-row">
                <div>
                    <strong>${escapeHTML(meal)}</strong>
                    <small>${items.length} ${items.length === 1 ? "item" : "items"}</small>
                </div>
                <div class="meal-row-right">
                    <strong>${formatNumber(total.calories)} kcal</strong>
                    <small>${formatNumber(total.protein, 1)}g protein</small>
                </div>
            </div>`);
    });
    container.innerHTML = rows.join("");
}

function updateInsight(totals, left) {
    const title = $("#insightTitle");
    const text = $("#insightText");

    if (!getEntries().length) {
        title.textContent = "Nothing logged yet.";
        text.textContent = "Add your first meal and your day will start taking shape here.";
    } else if (left > 0) {
        title.textContent = `${formatNumber(left)} kcal remaining.`;
        text.textContent = totals.protein < state.goals.protein
            ? "You still have room today. Protein is currently below your target."
            : "You’re within your calorie target and protein is on track.";
    } else if (left === 0) {
        title.textContent = "You reached your calorie target.";
        text.textContent = "Your calorie total is right on target for today.";
    } else {
        title.textContent = `${formatNumber(Math.abs(left))} kcal over target.`;
        text.textContent = "That’s just a log, not a verdict. Look at the weekly pattern as well.";
    }
}

function renderFullLog() {
    $("#logDateLabel").textContent = friendlyDate(selectedDate);
    const groups = groupedEntries(selectedDate);
    const hasAny = Object.values(groups).some(items => items.length);

    if (!hasAny) {
        $("#fullMealList").innerHTML = `
            <div class="empty-state">
                <strong>No food logged for ${escapeHTML(friendlyDate(selectedDate).toLowerCase())}.</strong>
                <span>Use “Add food” to put your first meal on the board.</span>
            </div>`;
        return;
    }

    $("#fullMealList").innerHTML = mealOrder.map(meal => {
        const items = groups[meal] || [];
        if (!items.length) return "";
        const total = totalsFor(items);
        const itemMarkup = items.map(entry => `
            <div class="food-entry">
                <div>
                    <strong>${escapeHTML(entry.name)}</strong>
                    <div class="food-detail">${formatNumber(entry.quantity, 2)} serving${entry.quantity === 1 ? "" : "s"} · ${formatNumber(entry.protein, 1)}g P · ${formatNumber(entry.carbs, 1)}g C · ${formatNumber(entry.fat, 1)}g F</div>
                </div>
                <div class="entry-calories">${formatNumber(entry.calories)} kcal</div>
                <button type="button" class="delete-entry" data-delete-id="${entry.id}" aria-label="Delete ${escapeHTML(entry.name)}">×</button>
            </div>
        `).join("");

        return `
            <article class="meal-group">
                <div class="meal-group-header">
                    <strong>${escapeHTML(meal)}</strong>
                    <span>${formatNumber(total.calories)} kcal</span>
                </div>
                ${itemMarkup}
            </article>`;
    }).join("");
}

function updateHistory() {
    const keys = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        keys.push(localDateKey(d));
    }

    const rows = keys.map(key => {
        const totals = totalsFor(state.logs[key] || []);
        const logged = (state.logs[key] || []).length > 0;
        const goalDiff = totals.calories - state.goals.calories;
        const goalLabel = !logged ? "—" :
            goalDiff === 0 ? "On target" :
            goalDiff > 0 ? `+${formatNumber(goalDiff)}` : `−${formatNumber(Math.abs(goalDiff))}`;

        return `
            <tr>
                <td><strong>${friendlyDate(key)}</strong><br><small>${formatDate(key, { year: "numeric" })}</small></td>
                <td>${logged ? formatNumber(totals.calories) : "—"}</td>
                <td>${logged ? `${formatNumber(totals.protein, 1)}g` : "—"}</td>
                <td>${logged ? `${formatNumber(totals.carbs, 1)}g` : "—"}</td>
                <td>${logged ? `${formatNumber(totals.fat, 1)}g` : "—"}</td>
                <td>${goalLabel}</td>
            </tr>`;
    }).join("");

    $("#historyTable").innerHTML = rows;

    const loggedTotals = keys.map(key => totalsFor(state.logs[key] || []).calories).filter(v => v > 0);
    const avg = loggedTotals.length ? loggedTotals.reduce((a, b) => a + b, 0) / loggedTotals.length : 0;
    $("#historyAvg").textContent = avg ? `${formatNumber(avg)} kcal` : "—";
    $("#historyDays").textContent = String(loggedTotals.length);

    const dashboardLogged = keys.map(key => totalsFor(state.logs[key] || []).calories).filter(v => v > 0);
    const dashboardAvg = dashboardLogged.length ? dashboardLogged.reduce((a, b) => a + b, 0) / dashboardLogged.length : 0;
    $("#weeklyAverage").textContent = dashboardAvg ? `Avg ${formatNumber(dashboardAvg)} kcal` : "Avg — kcal";
}

function drawWeeklyChart() {
    const canvas = $("#weeklyChart");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(rect.width, 260);
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const css = getComputedStyle(document.body);
    const text = css.getPropertyValue("--text").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const line = css.getPropertyValue("--line").trim();
    const accent = css.getPropertyValue("--accent").trim();

    const left = 34;
    const right = 15;
    const top = 15;
    const bottom = 34;
    const chartW = width - left - right;
    const chartH = height - top - bottom;
    const goal = state.goals.calories || 2000;

    const values = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = localDateKey(d);
        values.push({
            key,
            value: totalsFor(state.logs[key] || []).calories,
            label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)
        });
    }

    const max = Math.max(goal, ...values.map(v => v.value), 1) * 1.12;

    ctx.lineWidth = 1;
    ctx.strokeStyle = line;
    [0, 0.5, 1].forEach(t => {
        const y = top + chartH * t;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();
    });

    const goalY = top + chartH - (goal / max) * chartH;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = muted;
    ctx.beginPath();
    ctx.moveTo(left, goalY);
    ctx.lineTo(width - right, goalY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = muted;
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.fillText(`${goal} goal`, left, Math.max(12, goalY - 7));

    const step = chartW / 6;
    values.forEach((item, index) => {
        const x = left + step * index;
        const barW = Math.min(30, step * 0.55);
        const barH = Math.max(item.value ? 5 : 0, (item.value / max) * chartH);
        const y = top + chartH - barH;

        ctx.fillStyle = item.key === selectedDate ? accent : text;
        roundRect(ctx, x - barW / 2, y, barW, barH, 8);
        ctx.fill();

        ctx.fillStyle = muted;
        ctx.textAlign = "center";
        ctx.fillText(item.label, x, height - 10);

        if (item.value) {
            ctx.fillStyle = text;
            ctx.font = "10px Inter, system-ui, sans-serif";
            ctx.fillText(Math.round(item.value), x, Math.max(11, y - 7));
        }
    });
    ctx.textAlign = "start";
}

function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function switchSection(id) {
    const target = document.getElementById(id);
    if (!target) return;

    $$(".section-panel").forEach(section => section.classList.remove("active"));
    target.classList.add("active");

    $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.section === id));

    const titles = {
        dashboard: "Dashboard",
        "food-log": "Food log",
        history: "History",
        goals: "Goals"
    };
    $("#pageTitle").textContent = titles[id] || "Dashboard";
    history.replaceState(null, "", `#${id}`);

    if (id === "dashboard") updateDashboard();
    if (id === "food-log") renderFullLog();
    if (id === "history") updateHistory();
    if (id === "goals") fillGoalForm();

    $("#sidebar").classList.remove("open");
}

function openFoodModal() {
    resetFoodForm();
    $("#foodModal").showModal();
    $("#foodSearch").focus();
    renderFoodResults("");
}

function resetFoodForm() {
    $("#foodForm").reset();
    $("#foodQuantity").value = "1";
    $("#selectedFoodName").textContent = "Custom food";
    $("#selectedFoodMeta").textContent = "Enter the nutrition for your serving.";
}

function selectQuickFood(food) {
    $("#foodName").value = food.name;
    $("#foodCalories").value = food.calories;
    $("#foodProtein").value = food.protein;
    $("#foodCarbs").value = food.carbs;
    $("#foodFat").value = food.fat;
    $("#selectedFoodName").textContent = food.name;
    $("#selectedFoodMeta").textContent =
        `${food.calories} kcal · ${food.protein}g protein · ${food.unit}`;
}

function renderFoodResults(query) {
    const normalized = query.trim().toLowerCase();
    const matches = quickFoods
        .filter(food => !normalized || food.name.toLowerCase().includes(normalized))
        .slice(0, 6);

    if (!matches.length) {
        $("#foodResults").innerHTML = "";
        return;
    }

    $("#foodResults").innerHTML = matches.map((food, index) => `
        <button type="button" class="food-result" data-food-index="${quickFoods.indexOf(food)}">
            <strong>${escapeHTML(food.name)}</strong>
            <span>${food.calories} kcal · ${food.unit}</span>
        </button>`).join("");
}

function addFoodFromForm(event) {
    event.preventDefault();

    const quantity = Number($("#foodQuantity").value);
    const baseCalories = Number($("#foodCalories").value);
    const baseProtein = Number($("#foodProtein").value);
    const baseCarbs = Number($("#foodCarbs").value);
    const baseFat = Number($("#foodFat").value);

    const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        meal: $("#mealType").value,
        name: $("#foodName").value.trim(),
        calories: Math.round(baseCalories * quantity),
        protein: +(baseProtein * quantity).toFixed(1),
        carbs: +(baseCarbs * quantity).toFixed(1),
        fat: +(baseFat * quantity).toFixed(1),
        quantity
    };

    if (!entry.name) return;

    if (!state.logs[selectedDate]) state.logs[selectedDate] = [];
    state.logs[selectedDate].push(entry);
    saveState();

    $("#foodModal").close();
    renderAll();
    showToast(`${entry.name} added to ${entry.meal.toLowerCase()}.`);
}

function deleteEntry(id) {
    const entries = getEntries();
    const entry = entries.find(item => item.id === id);
    state.logs[selectedDate] = entries.filter(item => item.id !== id);

    if (!state.logs[selectedDate].length) delete state.logs[selectedDate];
    saveState();
    renderAll();
    if (entry) showToast(`${entry.name} removed from your log.`);
}

function fillGoalForm() {
    $("#goalCalories").value = state.goals.calories;
    $("#goalProtein").value = state.goals.protein;
    $("#goalCarbs").value = state.goals.carbs;
    $("#goalFat").value = state.goals.fat;
}

function saveGoals(event) {
    event.preventDefault();
    state.goals = {
        calories: Number($("#goalCalories").value),
        protein: Number($("#goalProtein").value),
        carbs: Number($("#goalCarbs").value),
        fat: Number($("#goalFat").value)
    };
    saveState();
    $("#goalStatus").textContent = "Saved.";
    renderAll();
    showToast("Daily goals updated.");
    setTimeout(() => $("#goalStatus").textContent = "", 1800);
}

function shiftSelectedDate(delta) {
    const date = dateFromKey(selectedDate);
    date.setDate(date.getDate() + delta);
    selectedDate = localDateKey(date);
    renderAll();
}

function exportCSV() {
    const rows = [["date", "meal", "food", "servings", "calories", "protein_g", "carbs_g", "fat_g"]];
    Object.entries(state.logs)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, entries]) => {
            entries.forEach(entry => {
                rows.push([
                    date, entry.meal, entry.name, entry.quantity,
                    entry.calories, entry.protein, entry.carbs, entry.fat
                ]);
            });
        });

    if (rows.length === 1) {
        showToast("There is nothing to export yet.");
        return;
    }

    const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calory-food-log.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported.");
}

function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderAll() {
    updateDashboard();
    renderFullLog();
    updateHistory();
    fillGoalForm();
}

function toggleTheme() {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}

function restoreTheme() {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark");
    }
}

$("#foodForm").addEventListener("submit", addFoodFromForm);
$("#goalsForm").addEventListener("submit", saveGoals);

$("#foodSearch").addEventListener("input", (event) => {
    renderFoodResults(event.target.value);
});

$("#foodResults").addEventListener("click", (event) => {
    const button = event.target.closest("[data-food-index]");
    if (!button) return;
    const food = quickFoods[Number(button.dataset.foodIndex)];
    selectQuickFood(food);
});

$("#clearSelection").addEventListener("click", resetFoodForm);

$("#cancelFood").addEventListener("click", () => $("#foodModal").close());

$("#addFoodBtn").addEventListener("click", openFoodModal);
$("#quickAddBtn").addEventListener("click", openFoodModal);
$("#viewLogBtn").addEventListener("click", () => switchSection("food-log"));
$("#todayBtn").addEventListener("click", () => {
    selectedDate = localDateKey(new Date());
    renderAll();
});
$("#prevDayBtn").addEventListener("click", () => shiftSelectedDate(-1));
$("#nextDayBtn").addEventListener("click", () => shiftSelectedDate(1));
$("#logTodayBtn").addEventListener("click", () => {
    selectedDate = localDateKey(new Date());
    renderAll();
});

$("#fullMealList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-id]");
    if (button) deleteEntry(button.dataset.deleteId);
});

$("#exportBtn").addEventListener("click", exportCSV);
$("#themeBtn").addEventListener("click", toggleTheme);

$("#profileBtn").addEventListener("click", () => $("#profileModal").showModal());

$("#clearDataBtn").addEventListener("click", () => {
    const confirmed = window.confirm("Clear all locally stored food logs and goals?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    selectedDate = localDateKey(new Date());
    $("#profileModal").close();
    renderAll();
    showToast("Local data cleared.");
});

$("#menuBtn").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
});

$$(".nav-link").forEach(link => {
    link.addEventListener("click", () => switchSection(link.dataset.section));
});

window.addEventListener("resize", drawWeeklyChart);

restoreTheme();
const initialSection = location.hash.replace("#", "") || "dashboard";
switchSection(document.getElementById(initialSection) ? initialSection : "dashboard");
renderAll();
