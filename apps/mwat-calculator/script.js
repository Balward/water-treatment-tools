const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const monthSelect = document.getElementById("monthSelect");
const processButton = document.getElementById("processButton");
const messages = document.getElementById("messages");
const summarySection = document.getElementById("summarySection");
const resultsSection = document.getElementById("resultsSection");
const dailySection = document.getElementById("dailySection");
const recordCount = document.getElementById("recordCount");
const dayCount = document.getElementById("dayCount");
const dateRange = document.getElementById("dateRange");
const metricsPanel = document.getElementById("metricsPanel");
const mwatValue = document.getElementById("mwatValue");
const mwatRange = document.getElementById("mwatRange");
const mwatContext = document.getElementById("mwatContext");
const dailyMaxValue = document.getElementById("dailyMaxValue");
const dailyMaxRange = document.getElementById("dailyMaxRange");
const dailyMaxContext = document.getElementById("dailyMaxContext");
const windowTableContainer = document.getElementById("windowTableContainer");
const dailyTableContainer = document.getElementById("dailyTableContainer");

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function initMonthOptions() {
  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = name;
    monthSelect.append(option);
  });
}

initMonthOptions();

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === "\r") {
      continue;
    }

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(value);
      value = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      current.push(value);
      rows.push(current);
      current = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || current.length > 0) {
    current.push(value);
    rows.push(current);
  }

  return rows;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDateFormatter(options = {}) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...options
  });
}

const dateFormatter = createDateFormatter();

function formatDateRange(start, end) {
  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

function formatSingleDate(date) {
  return dateFormatter.format(date);
}

function formatNumber(value, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function clearSections() {
  messages.textContent = "";
  messages.className = "";
  summarySection.classList.add("hidden");
  resultsSection.classList.add("hidden");
  dailySection.classList.add("hidden");
  metricsPanel.classList.add("hidden");
  mwatValue.textContent = "—";
  mwatRange.textContent = "";
  mwatContext.textContent = "";
  dailyMaxValue.textContent = "—";
  dailyMaxRange.textContent = "";
  dailyMaxContext.textContent = "";
  windowTableContainer.innerHTML = "";
  dailyTableContainer.innerHTML = "";
}

function showMessage(text, type = "success") {
  messages.textContent = text;
  messages.className = type;
}

function buildTable(columns, rows) {
  if (!rows.length) {
    return "<p>No data available.</p>";
  }

  const thead = `<thead><tr>${columns
    .map((col) => `<th scope="col">${col}</th>`)
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;

  return `<div class="table-wrapper"><table class="table">${thead}${tbody}</table></div>`;
}

function computeDailyAverages(records) {
  const byDay = new Map();

  for (const record of records) {
    const key = toDateKey(record.date);
    if (!byDay.has(key)) {
      byDay.set(key, {
        date: new Date(record.date.getFullYear(), record.date.getMonth(), record.date.getDate()),
        temps: []
      });
    }
    byDay.get(key).temps.push(record.temperature);
  }

  const daily = Array.from(byDay.values())
    .map((entry) => {
      if (entry.temps.length < 3) {
        return null;
      }
      const total = entry.temps.reduce((sum, value) => sum + value, 0);
      const average = total / entry.temps.length;
      return {
        date: entry.date,
        average,
        count: entry.temps.length
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

  return daily;
}

function computeTwoHourWindows(records) {
  const windows = [];

  if (records.length < 8) {
    return windows;
  }

  for (let i = 7; i < records.length; i++) {
    const segment = records.slice(i - 7, i + 1);
    let consecutive = true;

    for (let j = 1; j < segment.length; j++) {
      const diff = segment[j].date.getTime() - segment[j - 1].date.getTime();
      if (diff !== FIFTEEN_MINUTES) {
        consecutive = false;
        break;
      }
    }

    if (!consecutive) {
      continue;
    }

    const average = segment.reduce((sum, item) => sum + item.temperature, 0) / segment.length;

    windows.push({
      start: segment[0].date,
      end: segment[segment.length - 1].date,
      average
    });
  }

  return windows;
}

function computeDailyMaxLookup(twoHourWindows) {
  const lookup = new Map();

  for (const window of twoHourWindows) {
    const end = window.end;
    const key = toDateKey(end);

    if (!lookup.has(key) || window.average > lookup.get(key).value) {
      lookup.set(key, {
        date: new Date(end.getFullYear(), end.getMonth(), end.getDate()),
        value: window.average,
        window
      });
    }
  }

  return lookup;
}

function formatDateTime(date) {
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return formatter.format(date);
}

function formatTimeRange(start, end) {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const timeFormatter = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const dayFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit"
  });

  if (sameDay) {
    return `${dayFormatter.format(start)} ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`;
  }

  return `${dayFormatter.format(start)} ${timeFormatter.format(start)} – ${dayFormatter.format(end)} ${timeFormatter.format(end)}`;
}

function computeSevenDayWindows(dailyAverages) {
  const windows = [];

  for (let i = 0; i <= dailyAverages.length - 7; i++) {
    const segment = dailyAverages.slice(i, i + 7);
    let consecutive = true;

    for (let j = 1; j < segment.length; j++) {
      const expected = segment[0].date.getTime() + j * 86400000;
      if (segment[j].date.getTime() !== expected) {
        consecutive = false;
        break;
      }
    }

    if (!consecutive) {
      continue;
    }

    const mean = segment.reduce((sum, day) => sum + day.average, 0) / segment.length;

    const monthCounts = new Map();
    for (const day of segment) {
      const month = day.date.getMonth();
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }

    let monthIndex = null;
    let maxCount = 0;
    for (const [month, count] of monthCounts.entries()) {
      if (count > maxCount) {
        monthIndex = month;
        maxCount = count;
      }
    }

    if (monthIndex === null || maxCount < 4) {
      continue;
    }

    windows.push({
      start: segment[0].date,
      end: segment[segment.length - 1].date,
      mean,
      days: segment,
      monthIndex
    });
  }

  return windows;
}

function summarizeRecords(records) {
  if (!records.length) {
    return {
      recordCount: 0,
      dayCount: 0,
      range: "—"
    };
  }

  const sorted = [...records].sort((a, b) => a.date - b.date);
  const uniqueDays = new Set(sorted.map((record) => toDateKey(record.date)));

  return {
    recordCount: records.length,
    dayCount: uniqueDays.size,
    range: formatDateRange(sorted[0].date, sorted[sorted.length - 1].date)
  };
}

function renderDailyTable(daily, dailyMaxLookup) {
  const rows = daily.map((day) => {
    const key = toDateKey(day.date);
    const dailyMax = dailyMaxLookup.get(key);

    let maxCell = "—";
    if (dailyMax) {
      const valueLabel = `${formatNumber(dailyMax.value, 3)} °C`;
      const windowLabel = formatTimeRange(dailyMax.window.start, dailyMax.window.end);
      maxCell = `${valueLabel}<div class="table__subtext">${windowLabel}</div>`;
    }

    return [
      formatSingleDate(day.date),
      day.count.toString(),
      `${formatNumber(day.average, 3)} °C`,
      maxCell
    ];
  });

  return buildTable(["Date", "Readings", "Daily Average", "2-hr Maximum"], rows);
}

function renderWindowTable(windows) {
  const sorted = windows.slice().sort((a, b) => a.end - b.end);
  const rows = sorted.map((window, index) => [
    (index + 1).toString(),
    formatDateRange(window.start, window.end),
    formatSingleDate(window.end),
    `${formatNumber(window.mean, 3)} °C`
  ]);
  return buildTable(["MWAT #", "7-Day Range", "Ending Day", "Rolling Average"], rows);
}

async function processFiles() {
  clearSections();

  const file1 = document.getElementById("csvFile1").files[0];
  const file2 = document.getElementById("csvFile2").files[0];
  const monthValue = monthSelect.value;

  if (!file1 || !file2) {
    showMessage("Please select two CSV files before calculating.", "error");
    return;
  }

  if (monthValue === "") {
    showMessage("Select a month to report before calculating.", "error");
    return;
  }

  try {
    const [text1, text2] = await Promise.all([readFile(file1), readFile(file2)]);
    const rows = [...parseCSV(text1), ...parseCSV(text2)];

    if (rows.length <= 1) {
      showMessage("No data rows were found in the provided files.", "error");
      return;
    }

    const dataRows = rows.slice(1);
    const records = [];

    for (const row of dataRows) {
      if (!row || row.length < 3) {
        continue;
      }

      const timestampRaw = row[1]?.trim();
      const temperatureRaw = row[2]?.trim();
      if (!timestampRaw || !temperatureRaw) {
        continue;
      }

      const parsedDate = new Date(timestampRaw);
      const temperature = Number.parseFloat(temperatureRaw);

      if (Number.isNaN(parsedDate.getTime()) || Number.isNaN(temperature)) {
        continue;
      }

      records.push({
        date: parsedDate,
        temperature
      });
    }

    if (!records.length) {
      showMessage("No valid timestamp and temperature pairs were found in columns B and C.", "error");
      return;
    }

    records.sort((a, b) => a.date - b.date);

    const dedupedMap = new Map();
    for (const record of records) {
      const key = record.date.getTime();
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, record);
      }
    }
    const uniqueRecords = Array.from(dedupedMap.values());
    uniqueRecords.sort((a, b) => a.date - b.date);

    const summary = summarizeRecords(uniqueRecords);
    recordCount.textContent = summary.recordCount.toString();
    dayCount.textContent = summary.dayCount.toString();
    dateRange.textContent = summary.range;
    summarySection.classList.remove("hidden");

    const daily = computeDailyAverages(uniqueRecords);
    const twoHourWindows = computeTwoHourWindows(uniqueRecords);
    const dailyMaxLookup = computeDailyMaxLookup(twoHourWindows);

    if (daily.length < 7) {
      showMessage("At least seven consecutive days of data are required to compute MWAT.", "error");
      return;
    }

    dailyTableContainer.innerHTML = renderDailyTable(daily, dailyMaxLookup);
    dailySection.classList.remove("hidden");

    const windows = computeSevenDayWindows(daily);

    if (!windows.length) {
      showMessage("No seven-day windows with consecutive daily averages were found.", "error");
      return;
    }

    const monthIndex = Number.parseInt(monthValue, 10);
    const monthlyDailyMaxima = Array.from(dailyMaxLookup.values()).filter(
      (entry) => entry.date.getMonth() === monthIndex
    );

    if (!monthlyDailyMaxima.length) {
      showMessage(
        "No qualifying two-hour windows were found within the selected month to compute a daily maximum temperature.",
        "error"
      );
      return;
    }

    const monthlyDailyMax = monthlyDailyMaxima.reduce((best, current) =>
      current.value > best.value ? current : best
    );

    const targetYear = monthlyDailyMax.date.getFullYear();
    const windowsForMonth = windows.filter((window) => window.monthIndex === monthIndex);

    if (!windowsForMonth.length) {
      showMessage(
        "No qualifying seven-day windows with at least four days in the selected month were found.",
        "error"
      );
      return;
    }

    const best = windowsForMonth.reduce((currentBest, candidate) =>
      candidate.mean > currentBest.mean ? candidate : currentBest
    );
    const rangeLabel = formatDateRange(best.start, best.end);
    const mwatYear = best.end.getFullYear();

    mwatValue.textContent = `${formatNumber(best.mean, 3)} °C`;
    mwatRange.textContent = `${rangeLabel}`;
    mwatContext.textContent = `Highest seven-day rolling average with at least four days in ${monthNames[monthIndex]} ${mwatYear}.`;

    const windowDetails = monthlyDailyMax.window;
    dailyMaxValue.textContent = `${formatNumber(monthlyDailyMax.value, 3)} °C`;
    dailyMaxRange.textContent = `${formatDateTime(windowDetails.start)} – ${formatDateTime(windowDetails.end)}`;
    dailyMaxContext.textContent = `Peak two-hour mean recorded for ${monthNames[monthIndex]} ${targetYear}.`;

    metricsPanel.classList.remove("hidden");

    windowTableContainer.innerHTML = renderWindowTable(windowsForMonth);
    resultsSection.classList.remove("hidden");
    showMessage("MWAT calculations complete.", "success");
  } catch (error) {
    console.error(error);
    showMessage("An error occurred while processing the files. Please try again.", "error");
  }
}

processButton.addEventListener("click", processFiles);
