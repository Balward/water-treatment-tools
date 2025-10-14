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
const mwatHighlight = document.getElementById("mwatHighlight");
const windowTableContainer = document.getElementById("windowTableContainer");
const dailyTableContainer = document.getElementById("dailyTableContainer");

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

function formatDateRange(start, end) {
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
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
  mwatHighlight.innerHTML = "";
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

    const total = segment.reduce((sum, day) => sum + day.average, 0);
    const mean = total / segment.length;
    const monthCounts = segment.reduce((counts, day) => {
      const month = day.date.getMonth();
      counts[month] = (counts[month] || 0) + 1;
      return counts;
    }, {});

    const monthIndex = Object.entries(monthCounts).reduce((best, current) => {
      const [month, count] = current.map(Number);
      if (best === null) {
        return month;
      }
      const bestCount = monthCounts[best];
      return count > bestCount ? month : best;
    }, null);

    if (monthIndex === null || monthCounts[monthIndex] < 4) {
      continue;
    }

    windows.push({
      start: segment[0].date,
      end: segment[segment.length - 1].date,
      mean,
      monthIndex: Number(monthIndex),
      days: segment
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

function renderDailyTable(daily) {
  const formatter = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });

  const rows = daily.map((day) => [
    formatter.format(day.date),
    day.count.toString(),
    `${formatNumber(day.average, 3)} °C`
  ]);

  return buildTable(["Date", "Readings", "Daily Average"], rows);
}

function renderWindowTable(windows) {
  const rows = windows.map((window) => [
    formatDateRange(window.start, window.end),
    `${formatNumber(window.mean, 3)} °C`
  ]);
  return buildTable(["7-Day Range", "Rolling Average"], rows);
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

    if (daily.length < 7) {
      showMessage("At least seven consecutive days of data are required to compute MWAT.", "error");
      return;
    }

    dailyTableContainer.innerHTML = renderDailyTable(daily);
    dailySection.classList.remove("hidden");

    const windows = computeSevenDayWindows(daily);

    if (!windows.length) {
      showMessage("No seven-day windows with consecutive daily averages were found.", "error");
      return;
    }

    const monthIndex = Number.parseInt(monthValue, 10);
    const windowsForMonth = windows
      .filter((window) => window.monthIndex === monthIndex)
      .sort((a, b) => b.mean - a.mean);

    if (!windowsForMonth.length) {
      showMessage("No qualifying seven-day windows were attributed to the selected month.", "error");
      return;
    }

    const best = windowsForMonth[0];
    const rangeLabel = formatDateRange(best.start, best.end);
    mwatHighlight.innerHTML = `
      <h3>${monthNames[monthIndex]} MWAT</h3>
      <p><strong>${formatNumber(best.mean, 3)} °C</strong> (${rangeLabel})</p>
      <p>The highest rolling seven-day average temperature attributed to ${monthNames[monthIndex]}.</p>
    `;

    windowTableContainer.innerHTML = renderWindowTable(windowsForMonth);
    resultsSection.classList.remove("hidden");
    showMessage("MWAT calculations complete.", "success");
  } catch (error) {
    console.error(error);
    showMessage("An error occurred while processing the files. Please try again.", "error");
  }
}

processButton.addEventListener("click", processFiles);
