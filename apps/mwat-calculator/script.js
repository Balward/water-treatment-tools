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

const csvFile1Input = document.getElementById("csvFile1");
const csvFile2Input = document.getElementById("csvFile2");
const monthSelect = document.getElementById("monthSelect");
const locationSelect = document.getElementById("locationSelect");
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
const dischargeTypeContainer = document.getElementById("dischargeTypeContainer");
const intermittentContainer = document.getElementById("intermittentContainer");
const dischargeTypeInputs = Array.from(
  document.querySelectorAll('input[name="dischargeType"]')
);
const periodStartInput = document.getElementById("periodStart");
const periodEndInput = document.getElementById("periodEnd");
const addPeriodButton = document.getElementById("addPeriodButton");
const periodError = document.getElementById("periodError");
const periodList = document.getElementById("periodList");
const exportPdfButton = document.getElementById("exportPdfButton");

const DISCHARGE_LOCATIONS = new Set(["001", "004", "007"]);
let dischargePeriods = [];
let exportPayload = null;

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function updatePeriodError(message = "") {
  if (!periodError) {
    return;
  }
  periodError.textContent = message;
  if (message) {
    periodError.classList.remove("hidden");
  } else {
    periodError.classList.add("hidden");
  }
}

function getSelectedDischargeType() {
  const selected = dischargeTypeInputs.find((input) => input.checked);
  return selected ? selected.value : null;
}

function clearDischargeRadios() {
  dischargeTypeInputs.forEach((input) => {
    input.checked = false;
  });
  syncRadioStates();
}

function syncRadioStates() {
  dischargeTypeInputs.forEach((input) => {
    const parent = input.parentElement;
    if (parent && parent.classList) {
      parent.classList.toggle("radio--checked", input.checked);
    }
  });
}

function renderPeriods() {
  if (!periodList) {
    return;
  }

  if (!dischargePeriods.length) {
    periodList.innerHTML = "";
    periodList.classList.add("hidden");
    return;
  }

  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  periodList.innerHTML = dischargePeriods
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((period) => {
      const startLabel = formatter.format(period.start);
      const endLabel = formatter.format(period.end);
      return `<li class="period-list__item"><span class="period-list__label">${startLabel} – ${endLabel}</span><button type="button" class="period-list__remove" data-id="${period.id}">Remove</button></li>`;
    })
    .join("");

  periodList.classList.remove("hidden");
}

function resetDischargeOptions() {
  dischargePeriods = [];
  renderPeriods();
  clearDischargeRadios();
  updatePeriodError("");
}

function updateDischargeVisibility() {
  const location = locationSelect.value;
  const requiresDischarge = DISCHARGE_LOCATIONS.has(location);
  if (requiresDischarge) {
    dischargeTypeContainer.classList.remove("hidden");
  } else {
    dischargeTypeContainer.classList.add("hidden");
    intermittentContainer.classList.add("hidden");
    resetDischargeOptions();
  }

  const dischargeType = getSelectedDischargeType();
  if (requiresDischarge && dischargeType === "intermittent") {
    intermittentContainer.classList.remove("hidden");
  } else {
    intermittentContainer.classList.add("hidden");
    updatePeriodError("");
  }

  syncRadioStates();
}

function updateProcessButtonState() {
  const monthSelected = monthSelect.value !== "";
  const locationSelected = locationSelect.value !== "";
  const requiresDischarge = DISCHARGE_LOCATIONS.has(locationSelect.value);
  const dischargeType = getSelectedDischargeType();

  let dischargeReady = true;
  if (requiresDischarge) {
    if (!dischargeType) {
      dischargeReady = false;
    } else if (dischargeType === "intermittent" && dischargePeriods.length === 0) {
      dischargeReady = false;
    }
  }

  processButton.disabled = !(monthSelected && locationSelected && dischargeReady);
}

function initMonthOptions() {
  monthNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = name;
    monthSelect.append(option);
  });
}

initMonthOptions();
setExportAvailability(false);

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
  updatePeriodError("");
  exportPayload = null;
  setExportAvailability(false);
}

function showMessage(text, type = "success") {
  messages.textContent = text;
  messages.className = type;
}

function setExportAvailability(isReady) {
  if (!exportPdfButton) {
    return;
  }

  if (isReady) {
    exportPdfButton.disabled = false;
    exportPdfButton.classList.remove("hidden");
  } else {
    exportPdfButton.disabled = true;
    exportPdfButton.classList.add("hidden");
  }
}

function buildTable(columns, rows) {
  if (!rows.length) {
    return "<p>No data available.</p>";
  }

  const thead = `<thead><tr>${columns
    .map((col) => `<th scope="col">${col}</th>`)
    .join("")}</tr></thead>`;

  const tbodyRows = rows
    .map((row) => {
      const cells = Array.isArray(row) ? row : row.cells;
      const highlightIndices = new Set(
        Array.isArray(row.highlightIndices) ? row.highlightIndices : []
      );
      const rowClass = !Array.isArray(row) && row.rowClass ? ` class="${row.rowClass}"` : "";
      const cellMarkup = cells
        .map((cell, index) => {
          const isHighlighted = highlightIndices.has(index);
          const cellClass = isHighlighted ? " class=\"table__cell--highlight\"" : "";
          const badge = isHighlighted
            ? '<span class="table__badge" aria-label="Reported value" title="Reported value">Reported</span>'
            : "";
          const content = isHighlighted
            ? `<span class="table__cell-inner">${cell}</span>${badge}`
            : cell;
          return `<td${cellClass}>${content}</td>`;
        })
        .join("");
      return `<tr${rowClass}>${cellMarkup}</tr>`;
    })
    .join("");

  const tbody = `<tbody>${tbodyRows}</tbody>`;

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

function renderDailyTable(daily, dailyMaxLookup, highlightKey) {
  if (!daily.length) {
    return "<p>No daily averages were recorded in the selected month.</p>";
  }

  const rows = daily.map((day) => {
    const key = toDateKey(day.date);
    const dailyMax = dailyMaxLookup.get(key);

    let maxCell = "—";
    if (dailyMax) {
      const valueLabel = `${formatNumber(dailyMax.value, 3)} °C`;
      const windowLabel = formatTimeRange(dailyMax.window.start, dailyMax.window.end);
      maxCell = `${valueLabel}<div class="table__subtext">${windowLabel}</div>`;
    }

    const highlight = highlightKey && key === highlightKey;

    return {
      cells: [
        formatSingleDate(day.date),
        day.count.toString(),
        `${formatNumber(day.average, 3)} °C`,
        maxCell
      ],
      highlightIndices: highlight ? [3] : [],
      rowClass: highlight ? "table__row--highlight" : ""
    };
  });

  return buildTable(["Date", "Readings", "Daily Average", "2-hr Maximum"], rows);
}

function renderWindowTable(windows, highlightedWindow) {
  const sorted = windows.slice().sort((a, b) => a.end - b.end);
  const rows = sorted.map((window, index) => {
    const isHighlighted =
      highlightedWindow &&
      window.start.getTime() === highlightedWindow.start.getTime() &&
      window.end.getTime() === highlightedWindow.end.getTime();

    return {
      cells: [
        (index + 1).toString(),
        formatDateRange(window.start, window.end),
        formatSingleDate(window.end),
        `${formatNumber(window.mean, 3)} °C`
      ],
      highlightIndices: isHighlighted ? [3] : [],
      rowClass: isHighlighted ? "table__row--highlight" : ""
    };
  });
  return buildTable(["MWAT #", "7-Day Range", "Ending Day", "Rolling Average"], rows);
}

function buildTopWindowRowsForPdf(windows, reportedWindow) {
  return windows
    .slice()
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 10)
    .map((window, index) => {
      const isReported =
        reportedWindow &&
        window.start.getTime() === reportedWindow.start.getTime() &&
        window.end.getTime() === reportedWindow.end.getTime();

      const valueLabel = `${formatNumber(window.mean, 3)} °C${isReported ? " (Reported)" : ""}`;

      return [
        (index + 1).toString(),
        formatDateRange(window.start, window.end),
        formatSingleDate(window.end),
        valueLabel
      ];
    });
}

function buildTopDailyMaxRowsForPdf(dailyMaxima, reportedEntry) {
  return dailyMaxima
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((entry, index) => {
      const isReported =
        reportedEntry &&
        entry.window.start.getTime() === reportedEntry.window.start.getTime() &&
        entry.window.end.getTime() === reportedEntry.window.end.getTime();

      const valueLabel = `${formatNumber(entry.value, 3)} °C${isReported ? " (Reported)" : ""}`;

      return [
        (index + 1).toString(),
        formatSingleDate(entry.date),
        formatTimeRange(entry.window.start, entry.window.end),
        valueLabel
      ];
    });
}

function slugify(parts) {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function appendFieldValueSection(doc, marginX, cursorY, config) {
  const {
    title,
    headingColor,
    rows,
    alternateRowFill,
    afterSpacing = 12
  } = config;

  doc.setFontSize(12);
  doc.setTextColor(...headingColor);
  doc.text(title, marginX, cursorY);
  doc.setFontSize(8.5);
  doc.setTextColor(20);

  const tableConfig = {
    startY: cursorY + 12,
    head: [["Field", "Value"]],
    body: rows,
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
      overflow: "linebreak",
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: headingColor,
      textColor: 255,
      halign: "left",
      fontSize: 8
    },
    bodyStyles: { valign: "top" },
    margin: { left: marginX, right: marginX },
    columnStyles: {
      0: { cellWidth: 150 }
    }
  };

  if (alternateRowFill) {
    tableConfig.alternateRowStyles = { fillColor: alternateRowFill };
  }

  doc.autoTable(tableConfig);

  return doc.lastAutoTable.finalY + afterSpacing;
}

function appendRankedTableSection(doc, marginX, cursorY, config) {
  const {
    title,
    headingColor,
    head,
    body,
    alternateRowFill,
    styles = {
      fontSize: 7.5,
      cellPadding: { top: 1, bottom: 1, left: 2.5, right: 2.5 },
      overflow: "linebreak",
      lineWidth: 0.1
    },
    headStyles = {},
    columnStyles,
    afterSpacing = 12
  } = config;

  doc.setFontSize(12);
  doc.setTextColor(...headingColor);
  doc.text(title, marginX, cursorY);
  doc.setFontSize(8.5);
  doc.setTextColor(20);

  const tableConfig = {
    startY: cursorY + 12,
    head,
    body,
    styles,
    headStyles: { fillColor: headingColor, textColor: 255, fontSize: 7.5, ...headStyles },
    margin: { left: marginX, right: marginX }
  };

  if (alternateRowFill) {
    tableConfig.alternateRowStyles = { fillColor: alternateRowFill };
  }

  if (columnStyles) {
    tableConfig.columnStyles = columnStyles;
  }

  doc.autoTable(tableConfig);

  return doc.lastAutoTable.finalY + afterSpacing;
}

function appendDischargeDetailsSection(doc, marginX, cursorY, dischargeMetadata) {
  if (!dischargeMetadata) {
    return cursorY;
  }

  const dischargeRows = [["Discharge type", dischargeMetadata.typeLabel]];

  if (Array.isArray(dischargeMetadata.periods) && dischargeMetadata.periods.length) {
    dischargeRows.push([
      "Discharge periods",
      dischargeMetadata.periods.join("\n")
    ]);
  }

  return appendFieldValueSection(doc, marginX, cursorY, {
    title: "Discharge details",
    headingColor: [79, 70, 229],
    rows: dischargeRows,
    alternateRowFill: [236, 233, 254]
  });
}

function exportResultsToPdf() {
  if (!exportPayload) {
    return;
  }

  const jspdfGlobal = window.jspdf;
  if (!jspdfGlobal || typeof jspdfGlobal.jsPDF !== "function") {
    window.alert("PDF export is unavailable because the jsPDF library did not load.");
    return;
  }

  if (!jspdfGlobal.jsPDF.API || typeof jspdfGlobal.jsPDF.API.autoTable !== "function") {
    window.alert("PDF export is unavailable because the jsPDF autoTable plugin did not load.");
    return;
  }

  const doc = new jspdfGlobal.jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "landscape"
  });
  const marginX = 30;
  let cursorY = marginX;
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = exportPayload.generatedAt
    ? new Date(exportPayload.generatedAt)
    : new Date();
  const generatedLabel = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(generatedAt);

  doc.setFontSize(15);
  doc.text("MWAT & Daily Maximum Report", marginX, cursorY);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Generated ${generatedLabel}`, pageWidth - marginX, cursorY, { align: "right" });
  cursorY += 18;

  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Monitoring location: ${exportPayload.metadata.location}`, marginX, cursorY);
  cursorY += 12;
  doc.text(`Reporting month: ${exportPayload.metadata.monthLabel}`, marginX, cursorY);
  cursorY += 24;

  const pdfSections = [
    (currentY) =>
      appendFieldValueSection(doc, marginX, currentY, {
        title: "Reported MWAT",
        headingColor: [129, 140, 248],
        rows: [
          ["Value", exportPayload.reported.mwat.value],
          ["Seven-day range", exportPayload.reported.mwat.range],
          ["Notes", exportPayload.reported.mwat.context]
        ],
        alternateRowFill: [240, 242, 255]
      }),
    (currentY) =>
      appendFieldValueSection(doc, marginX, currentY, {
        title: "Reported Daily Maximum",
        headingColor: [249, 115, 22],
        rows: [
          ["Value", exportPayload.reported.dailyMax.value],
          ["Two-hour Window", exportPayload.reported.dailyMax.range],
          ["Notes", exportPayload.reported.dailyMax.context]
        ],
        alternateRowFill: [255, 245, 235]
      }),
    (currentY) =>
      appendRankedTableSection(doc, marginX, currentY, {
        title: "Top 10 MWAT Values",
        headingColor: [129, 140, 248],
        head: [exportPayload.tables.mwatTop.columns],
        body: exportPayload.tables.mwatTop.rows,
        alternateRowFill: [245, 246, 255]
      }),
    (currentY) =>
      appendRankedTableSection(doc, marginX, currentY, {
        title: "Top 10 Daily Maximum Values",
        headingColor: [249, 115, 22],
        head: [exportPayload.tables.dailyMaxTop.columns],
        body: exportPayload.tables.dailyMaxTop.rows,
        alternateRowFill: [255, 245, 235]
      }),
    (currentY) =>
      appendDischargeDetailsSection(
        doc,
        marginX,
        currentY,
        exportPayload.metadata.discharge
      )
  ];

  cursorY = pdfSections.reduce((currentY, appendSection) => appendSection(currentY), cursorY);

  const fileName = exportPayload.fileSlug ? `${exportPayload.fileSlug}.pdf` : "mwat-report.pdf";
  doc.save(fileName);
}

async function processFiles() {
  clearSections();

  const file1 = csvFile1Input.files[0];
  const file2 = csvFile2Input.files[0];
  const monthValue = monthSelect.value;
  const locationValue = locationSelect.value;

  if (!file1 || !file2) {
    showMessage("Please select two CSV files before calculating.", "error");
    return;
  }

  if (monthValue === "") {
    showMessage("Select a month to report before calculating.", "error");
    return;
  }

  if (!locationValue) {
    showMessage("Select a monitoring location before calculating.", "error");
    return;
  }

  const requiresDischargeChoice = DISCHARGE_LOCATIONS.has(locationValue);
  const dischargeType = getSelectedDischargeType();

  if (requiresDischargeChoice && !dischargeType) {
    showMessage("Choose a discharge type for the selected location before calculating.", "error");
    return;
  }

  if (requiresDischargeChoice && dischargeType === "intermittent" && dischargePeriods.length === 0) {
    showMessage("Add at least one discharge period for intermittent discharge locations before calculating.", "error");
    return;
  }

  const monthIndex = Number.parseInt(monthValue, 10);

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

    let workingRecords = uniqueRecords;

    if (requiresDischargeChoice && dischargeType === "intermittent") {
      const filtered = workingRecords.filter((record) =>
        dischargePeriods.some((period) => record.date >= period.start && record.date <= period.end)
      );

      if (!filtered.length) {
        showMessage(
          "No readings fall within the provided discharge periods. Adjust the periods and try again.",
          "error"
        );
        return;
      }

      workingRecords = filtered;
    }

    const summary = summarizeRecords(workingRecords);
    recordCount.textContent = summary.recordCount.toString();
    dayCount.textContent = summary.dayCount.toString();
    dateRange.textContent = summary.range;
    summarySection.classList.remove("hidden");

    const daily = computeDailyAverages(workingRecords);
    const twoHourWindows = computeTwoHourWindows(workingRecords);
    const dailyMaxLookup = computeDailyMaxLookup(twoHourWindows);

    if (daily.length < 7) {
      showMessage("At least seven consecutive days of data are required to compute MWAT.", "error");
      return;
    }

    const windows = computeSevenDayWindows(daily);

    if (!windows.length) {
      showMessage("No seven-day windows with consecutive daily averages were found.", "error");
      return;
    }

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

    const monthlyDaily = daily.filter((day) => day.date.getMonth() === monthIndex);
    const highlightKey = toDateKey(monthlyDailyMax.date);
    dailyTableContainer.innerHTML = renderDailyTable(monthlyDaily, dailyMaxLookup, highlightKey);
    dailySection.classList.remove("hidden");

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
    const mwatValueLabel = `${formatNumber(best.mean, 3)} °C`;
    const mwatRangeLabel = `${rangeLabel}`;
    const mwatContextLabel = `Highest seven-day rolling average with at least four days in ${monthNames[monthIndex]} ${mwatYear}.`;

    mwatValue.textContent = mwatValueLabel;
    mwatRange.textContent = mwatRangeLabel;
    mwatContext.textContent = mwatContextLabel;

    const windowDetails = monthlyDailyMax.window;
    const dailyMaxValueLabel = `${formatNumber(monthlyDailyMax.value, 3)} °C`;
    const dailyMaxRangeLabel = `${formatDateTime(windowDetails.start)} – ${formatDateTime(windowDetails.end)}`;
    const dailyMaxContextLabel = `Peak two-hour mean recorded for ${monthNames[monthIndex]} ${targetYear}.`;

    dailyMaxValue.textContent = dailyMaxValueLabel;
    dailyMaxRange.textContent = dailyMaxRangeLabel;
    dailyMaxContext.textContent = dailyMaxContextLabel;

    metricsPanel.classList.remove("hidden");

    windowTableContainer.innerHTML = renderWindowTable(windowsForMonth, best);
    resultsSection.classList.remove("hidden");

    const topWindowRowsForPdf = buildTopWindowRowsForPdf(windowsForMonth, best);
    const topDailyMaxRowsForPdf = buildTopDailyMaxRowsForPdf(
      monthlyDailyMaxima,
      monthlyDailyMax
    );
    const monthLabel = `${monthNames[monthIndex]} ${targetYear}`;
    const dischargeSummary = requiresDischargeChoice
      ? {
          typeLabel: dischargeType === "intermittent" ? "Intermittent discharge" : "Continuous discharge",
          periods:
            dischargeType === "intermittent"
              ? dischargePeriods.map((period) => `${formatDateTime(period.start)} – ${formatDateTime(period.end)}`)
              : []
        }
      : null;

    exportPayload = {
      generatedAt: new Date().toISOString(),
      metadata: {
        monthLabel,
        location: locationValue,
        discharge: dischargeSummary
      },
      reported: {
        mwat: {
          value: mwatValueLabel,
          range: mwatRangeLabel,
          context: mwatContextLabel
        },
        dailyMax: {
          value: dailyMaxValueLabel,
          range: dailyMaxRangeLabel,
          context: dailyMaxContextLabel
        }
      },
      tables: {
        mwatTop: {
          columns: ["Rank", "7-Day Range", "Ending Day", "Rolling Average"],
          rows: topWindowRowsForPdf
        },
        dailyMaxTop: {
          columns: ["Rank", "Date", "Two-hour Window", "2-hr Maximum"],
          rows: topDailyMaxRowsForPdf
        }
      },
      fileSlug: slugify(["mwat", monthNames[monthIndex], targetYear.toString(), locationValue])
    };

    setExportAvailability(true);
    showMessage("MWAT calculations complete.", "success");
  } catch (error) {
    console.error(error);
    showMessage("An error occurred while processing the files. Please try again.", "error");
  }
}

locationSelect.addEventListener("change", () => {
  updateDischargeVisibility();
  updateProcessButtonState();
});

monthSelect.addEventListener("change", updateProcessButtonState);

dischargeTypeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateDischargeVisibility();
    updateProcessButtonState();
  });
});

addPeriodButton.addEventListener("click", () => {
  updatePeriodError("");
  const startValue = periodStartInput.value;
  const endValue = periodEndInput.value;

  if (!startValue || !endValue) {
    updatePeriodError("Enter both a start and stop date/time before adding the discharge period.");
    return;
  }

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    updatePeriodError("The provided start or stop time is invalid. Please adjust the values.");
    return;
  }

  if (end <= start) {
    updatePeriodError("The stop time must be after the start time for a discharge period.");
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  dischargePeriods.push({ id, start, end });
  dischargePeriods.sort((a, b) => a.start - b.start);
  renderPeriods();
  updateProcessButtonState();
  periodStartInput.value = "";
  periodEndInput.value = "";
});

periodList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches(".period-list__remove")) {
    const id = target.getAttribute("data-id");
    if (!id) {
      return;
    }

    dischargePeriods = dischargePeriods.filter((period) => period.id !== id);
    renderPeriods();
    updateProcessButtonState();
  }
});

csvFile1Input.addEventListener("change", updateProcessButtonState);
csvFile2Input.addEventListener("change", updateProcessButtonState);

syncRadioStates();
updateDischargeVisibility();
updateProcessButtonState();

processButton.addEventListener("click", processFiles);

if (exportPdfButton) {
  exportPdfButton.addEventListener("click", exportResultsToPdf);
}
