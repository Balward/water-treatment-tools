(() => {
  /* ===== Global navigation (reused pattern) ===== */
  const globalNav = document.querySelector(".global-nav");
  const globalNavMenu = globalNav ? globalNav.querySelector(".global-nav__menu") : null;
  const globalNavMenuToggle = globalNav ? globalNav.querySelector(".global-nav__menu-toggle") : null;
  const navDropdownToggles = Array.from(document.querySelectorAll(".global-nav__toggle"));

  if (globalNav) {
    const shouldUseFallbackLinks = window.location.protocol === "file:" || window.location.pathname.includes("/apps/");
    if (shouldUseFallbackLinks) {
      document.querySelectorAll("[data-rel-href]").forEach((link) => {
        const relHref = link.getAttribute("data-rel-href");
        if (relHref) {
          link.setAttribute("href", relHref);
        }
      });
    }
  }

  function closeAllDropdowns() {
    navDropdownToggles.forEach((toggle) => {
      const item = toggle.closest(".global-nav__item--dropdown");
      if (item) {
        item.classList.remove("global-nav__item--open");
      }
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  if (globalNav && globalNavMenu && globalNavMenuToggle) {
    globalNavMenuToggle.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = globalNav.classList.toggle("global-nav--menu-open");
      globalNavMenuToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("has-mobile-nav-open", isOpen);
      if (!isOpen) {
        closeAllDropdowns();
      }
    });

    navDropdownToggles.forEach((toggle) => {
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        const item = toggle.closest(".global-nav__item--dropdown");
        if (!item) {
          return;
        }
        const shouldOpen = !item.classList.contains("global-nav__item--open");
        closeAllDropdowns();
        if (shouldOpen) {
          item.classList.add("global-nav__item--open");
          toggle.setAttribute("aria-expanded", "true");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!globalNav.contains(event.target)) {
        globalNav.classList.remove("global-nav--menu-open");
        document.body.classList.remove("has-mobile-nav-open");
        closeAllDropdowns();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1040) {
        globalNav.classList.remove("global-nav--menu-open");
        document.body.classList.remove("has-mobile-nav-open");
      }
    });
  }

  /* ===== App state ===== */
  const state = {
    records: [],
    includeWeekday: true,
    includeWeekend: true,
    baseAverageKey: "overall",
    thresholdMultiplier: 1.0,
    dateRange: { start: null, end: null },
    extents: { start: null, end: null },
    shouldResetZoom: true,
    stats: {
      overallAverage: null,
      weekdayAverage: null,
      weekendAverage: null,
      weekdayRange: null,
      weekendRange: null,
      peakValue: null,
      peakTimestamp: null,
      latestSample: null,
      totalRecords: 0,
    },
  };

  const els = {
    fileInput: document.getElementById("fileInput"),
    useDemoButton: document.getElementById("useDemoButton"),
    loadStatus: document.getElementById("loadStatus"),
    baseAverageSelect: document.getElementById("baseAverageSelect"),
    thresholdSlider: document.getElementById("thresholdSlider"),
    thresholdNumber: document.getElementById("thresholdNumber"),
    thresholdValue: document.getElementById("thresholdValue"),
    thresholdPercent: document.getElementById("thresholdPercent"),
    startDateInput: document.getElementById("startDateInput"),
    endDateInput: document.getElementById("endDateInput"),
    resetDateRange: document.getElementById("resetDateRange"),
    dateRangeHint: document.getElementById("dateRangeHint"),
    weekdayToggle: document.getElementById("weekdayToggle"),
    weekendToggle: document.getElementById("weekendToggle"),
    totalRecords: document.getElementById("totalRecords"),
    overallAverage: document.getElementById("overallAverage"),
    weekdayAverage: document.getElementById("weekdayAverage"),
    weekendAverage: document.getElementById("weekendAverage"),
    weekdayRange: document.getElementById("weekdayRange"),
    weekendRange: document.getElementById("weekendRange"),
    peakValue: document.getElementById("peakValue"),
    latestSample: document.getElementById("latestSample"),
    thresholdSummary: document.getElementById("exceedanceSummary"),
    resetZoomButton: document.getElementById("resetZoomButton"),
    timeSeriesCanvas: document.getElementById("timeSeriesChart"),
    timeSeriesTooltip: document.getElementById("timeSeriesTooltip"),
    hourlyBarCanvas: document.getElementById("hourlyBarChart"),
    hourTableBody: document.getElementById("hourTableBody"),
    previewTableBody: document.getElementById("previewTableBody"),
  };

  const colorVars = getComputedStyle(document.documentElement);
  const colors = {
    weekday: colorVars.getPropertyValue("--accent-weekday").trim() || "#2f84e8",
    weekend: colorVars.getPropertyValue("--accent-weekend").trim() || "#f28c38",
    threshold: colorVars.getPropertyValue("--accent-threshold").trim() || "#f04563",
    neutral: colorVars.getPropertyValue("--accent-primary").trim() || "#1ea4bf",
  };

  const weekendBackgroundPlugin = {
    id: "weekendBackground",
    beforeDraw(chart, args, pluginOptions = {}) {
      const ranges = Array.isArray(pluginOptions.ranges) ? pluginOptions.ranges : [];
      if (!ranges.length) {
        return;
      }

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales || !scales.x || !Number.isFinite(chartArea.left) || !Number.isFinite(chartArea.right)) {
        return;
      }

      const xScale = scales.x;
      const fillStyle = pluginOptions.fillStyle || `${colors.weekend}20`;
      const top = chartArea.top;
      const height = chartArea.bottom - chartArea.top;

      ctx.save();
      ctx.fillStyle = fillStyle;

      ranges.forEach((range) => {
        if (!range || !range.start || !range.end) {
          return;
        }
        const startValue = range.start instanceof Date ? range.start : new Date(range.start);
        const endValue = range.end instanceof Date ? range.end : new Date(range.end);
        if (Number.isNaN(startValue.getTime()) || Number.isNaN(endValue.getTime())) {
          return;
        }

        const rawStart = xScale.getPixelForValue(startValue);
        const rawEnd = xScale.getPixelForValue(endValue);
        if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
          return;
        }

        const left = Math.max(chartArea.left, Math.min(rawStart, rawEnd));
        const right = Math.min(chartArea.right, Math.max(rawStart, rawEnd));
        if (right <= left) {
          return;
        }

        ctx.fillRect(left, top, right - left, height);
      });

      ctx.restore();
    },
  };

  if (typeof Chart !== "undefined" && typeof Chart.register === "function") {
    Chart.register(weekendBackgroundPlugin);
  }

  const zoomPluginGlobal =
    (window.ChartZoom && (window.ChartZoom.default || window.ChartZoom)) ||
    (window["chartjs-plugin-zoom"] && (window["chartjs-plugin-zoom"].default || window["chartjs-plugin-zoom"]));
  if (zoomPluginGlobal && typeof Chart !== "undefined" && typeof Chart.register === "function") {
    Chart.register(zoomPluginGlobal);
  }
  const zoomEnabled = Boolean(zoomPluginGlobal);

  let timeSeriesChart = null;
  let hourlyBarChart = null;
  const timeSeriesTooltipController = createExternalTooltipController(els.timeSeriesTooltip, { delay: 0 });

  /* ===== Helpers ===== */
  function formatNumber(value, options = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      ...options,
    });
    return formatter.format(value);
  }

  function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    const formatter = new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(value);
  }

  function formatTimestamp(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "—";
    }
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date);
  }

  function createExternalTooltipController(element, { delay = 0 } = {}) {
    if (!element) {
      return {
        handler() {},
        hide() {},
      };
    }

    let timeoutId = null;

    function hide() {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      element.classList.add("chart-tooltip--hidden");
      element.innerHTML = "";
    }

    function handler(context) {
      const { tooltip } = context;
      if (!tooltip || tooltip.opacity === 0) {
        hide();
        return;
      }

      const dataPoints = tooltip.dataPoints || [];
      if (!dataPoints.length) {
        return;
      }

      const firstPoint = dataPoints[0];
      const rawTimestamp =
        firstPoint.raw && firstPoint.raw.x instanceof Date
          ? firstPoint.raw.x
          : Number.isFinite(firstPoint.parsed?.x)
          ? new Date(firstPoint.parsed.x)
          : null;
      const timestamp =
        rawTimestamp instanceof Date && !Number.isNaN(rawTimestamp.getTime())
          ? rawTimestamp
          : tooltip.title && tooltip.title.length
          ? new Date(tooltip.title[0])
          : null;
      const timestampLabel =
        timestamp instanceof Date && !Number.isNaN(timestamp.getTime())
          ? formatTimestamp(timestamp)
          : tooltip.title && tooltip.title.length
          ? tooltip.title[0]
          : "";

      const itemsHtml = dataPoints
        .map((point) => {
          const datasetLabel = point.dataset?.label ?? "";
          const color =
            typeof point.dataset?.borderColor === "string" && point.dataset.borderColor
              ? point.dataset.borderColor
              : colors.neutral;
          const valueNumber = typeof point.parsed?.y === "number" ? point.parsed.y : null;
          const formattedValue =
            valueNumber !== null
              ? `${formatNumber(valueNumber)}${datasetLabel.includes("Threshold") ? "" : " lbs/day"}`
              : point.formattedValue ?? "";
          return `
            <div class="chart-tooltip__item">
              <span class="chart-tooltip__bullet" style="background:${color}"></span>
              <span class="chart-tooltip__label">${datasetLabel}</span>
              <span class="chart-tooltip__value">${formattedValue}</span>
            </div>
          `;
        })
        .join("");

      const content = `
        <div class="chart-tooltip__title">${timestampLabel}</div>
        <div class="chart-tooltip__body">${itemsHtml}</div>
      `;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (delay <= 0) {
        element.innerHTML = content;
        element.classList.remove("chart-tooltip--hidden");
        return;
      }

      timeoutId = window.setTimeout(() => {
        element.innerHTML = content;
        element.classList.remove("chart-tooltip--hidden");
      }, delay);
    }

    return { handler, hide };
  }

  function formatShortDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "—";
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatDateForInput(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startOfDay(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return null;
    }
    const result = new Date(date.getTime());
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function endOfDay(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return null;
    }
    const result = new Date(date.getTime());
    result.setHours(23, 59, 59, 999);
    return result;
  }

  function createDateFromInputValue(value, { end = false } = {}) {
    if (!value) {
      return null;
    }
    const parts = value.split("-");
    if (parts.length !== 3) {
      return null;
    }
    const [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    return end ? endOfDay(date) : startOfDay(date);
  }

  function cloneDate(date) {
    return date ? new Date(date.getTime()) : null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function parseValue(raw) {
    if (typeof raw === "number") {
      return Number.isNaN(raw) ? null : raw;
    }
    if (typeof raw === "string") {
      const cleaned = raw.replace(/,/g, "");
      const parsed = Number.parseFloat(cleaned);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  function parseTimestamp(raw) {
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === "number") {
      const parsed = XLSX.SSF ? XLSX.SSF.parse_date_code(raw) : null;
      if (!parsed) {
        return null;
      }
      const { y, m, d, H, M, S } = parsed;
      return new Date(Date.UTC(y, m - 1, d, H, M, S || 0));
    }
    if (typeof raw === "string") {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function mean(values) {
    if (!values.length) {
      return null;
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  function getWorkbookFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = XLSX.read(event.target.result, {
            type: "array",
            cellDates: true,
            dateNF: 'yyyy-mm-dd"T"HH:MM:ss',
          });
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
      reader.readAsArrayBuffer(file);
    });
  }

  function getWorkbookFromUrl(url) {
    return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch demo dataset (${response.status})`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) =>
        XLSX.read(buffer, {
          type: "array",
          cellDates: true,
          dateNF: 'yyyy-mm-dd"T"HH:MM:ss',
        }),
      );
  }

  function parseWorkbook(workbook) {
    if (!workbook || !workbook.SheetNames.length) {
      return [];
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return [];
    }
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    const records = [];
    for (let i = 3; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length < 2) {
        continue;
      }
      const timestamp = parseTimestamp(row[0]);
      const value = parseValue(row[1]);
      if (!timestamp || value === null) {
        continue;
      }
      const localTimestamp = new Date(timestamp);
      const isWeekend = localTimestamp.getDay() === 0 || localTimestamp.getDay() === 6;
      const hour = localTimestamp.getHours();
      records.push({
        timestamp: localTimestamp,
        value,
        isWeekend,
        hour,
      });
    }

    records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return records;
  }

  /* ===== Analytics ===== */
  function computeStatistics(records) {
    const totals = { weekday: [], weekend: [], all: [] };
    const weekdayValues = [];
    const weekendValues = [];
    let peak = { value: null, timestamp: null };

    records.forEach((record) => {
      totals.all.push(record.value);
      if (record.isWeekend) {
        weekendValues.push(record.value);
      } else {
        weekdayValues.push(record.value);
      }
      if (peak.value === null || record.value > peak.value) {
        peak = { value: record.value, timestamp: record.timestamp };
      }
    });

    const weekdayRange = weekdayValues.length
      ? {
          min: Math.min(...weekdayValues),
          max: Math.max(...weekdayValues),
        }
      : null;
    const weekendRange = weekendValues.length
      ? {
          min: Math.min(...weekendValues),
          max: Math.max(...weekendValues),
        }
      : null;

    return {
      totalRecords: records.length,
      overallAverage: mean(totals.all),
      weekdayAverage: mean(weekdayValues),
      weekendAverage: mean(weekendValues),
      weekdayRange,
      weekendRange,
      peakValue: peak.value,
      peakTimestamp: peak.timestamp,
      latestSample: records.length ? records[records.length - 1].timestamp : null,
    };
  }

  function updateSummary(statistics) {
    const {
      totalRecords,
      overallAverage,
      weekdayAverage,
      weekendAverage,
      weekdayRange,
      weekendRange,
      peakValue,
      peakTimestamp,
      latestSample,
    } = statistics;

    els.totalRecords.textContent = totalRecords ? formatNumber(totalRecords, { maximumFractionDigits: 0 }) : "—";
    els.overallAverage.textContent = overallAverage !== null ? `${formatNumber(overallAverage)} lbs/day` : "—";
    els.weekdayAverage.textContent = weekdayAverage !== null ? `${formatNumber(weekdayAverage)} lbs/day` : "—";
    els.weekendAverage.textContent = weekendAverage !== null ? `${formatNumber(weekendAverage)} lbs/day` : "—";

    els.weekdayRange.textContent = weekdayRange
      ? `${formatNumber(weekdayRange.min)} – ${formatNumber(weekdayRange.max)} lbs/day`
      : "No weekday data";
    els.weekendRange.textContent = weekendRange
      ? `${formatNumber(weekendRange.min)} – ${formatNumber(weekendRange.max)} lbs/day`
      : "No weekend data";

    els.peakValue.textContent =
      peakValue !== null ? `${formatNumber(peakValue)} lbs/day @ ${formatTimestamp(peakTimestamp)}` : "—";
    els.latestSample.textContent = latestSample ? formatTimestamp(latestSample) : "—";
  }

  function deriveBaseAverage() {
    const { overallAverage, weekdayAverage, weekendAverage } = state.stats;
    let base = null;
    if (state.baseAverageKey === "weekday") {
      base = weekdayAverage;
    } else if (state.baseAverageKey === "weekend") {
      base = weekendAverage;
    } else {
      base = overallAverage;
    }

    if (base === null) {
      base = overallAverage !== null ? overallAverage : weekdayAverage ?? weekendAverage;
    }
    return base;
  }

  function getFilteredRecords() {
    const startMs = state.dateRange.start ? state.dateRange.start.getTime() : null;
    const endMs = state.dateRange.end ? state.dateRange.end.getTime() : null;

    return state.records.filter((record) => {
      const timestamp = record.timestamp.getTime();

      if (startMs !== null && timestamp < startMs) {
        return false;
      }

      if (endMs !== null && timestamp > endMs) {
        return false;
      }

      if (record.isWeekend) {
        return state.includeWeekend;
      }
      return state.includeWeekday;
    });
  }

  function calculateHourAnalytics(filteredRecords, thresholdValue) {
    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total: 0,
      exceedances: 0,
      values: [],
    }));

    filteredRecords.forEach((record) => {
      const bucket = hours[record.hour];
      bucket.total += 1;
      bucket.values.push(record.value);
      if (thresholdValue !== null && record.value >= thresholdValue) {
        bucket.exceedances += 1;
      }
    });

    hours.forEach((bucket) => {
      bucket.average = bucket.values.length ? mean(bucket.values) : null;
      bucket.share = bucket.total ? bucket.exceedances / bucket.total : null;
    });

    return hours;
  }

  function deriveWeekendBands(records) {
    if (!state.includeWeekend || !Array.isArray(records) || !records.length) {
      return [];
    }

    const weekendStarts = new Set();
    records.forEach((record) => {
      if (!record || !record.isWeekend) {
        return;
      }
      const dayStart = startOfDay(record.timestamp);
      if (dayStart) {
        weekendStarts.add(dayStart.getTime());
      }
    });

    if (!weekendStarts.size) {
      return [];
    }

    const sortedStarts = Array.from(weekendStarts).sort((a, b) => a - b);
    const bands = [];
    sortedStarts.forEach((startMs) => {
      const start = new Date(startMs);
      const end = endOfDay(start);
      if (!bands.length) {
        bands.push({ start, end });
        return;
      }
      const lastBand = bands[bands.length - 1];
      if (startMs <= lastBand.end.getTime() + 1) {
        if (end.getTime() > lastBand.end.getTime()) {
          lastBand.end = end;
        }
      } else {
        bands.push({ start, end });
      }
    });

    return bands;
  }

  /* ===== Charts ===== */
  function buildTimeSeriesDataset(records, thresholdValue) {
    const points = Array.isArray(records)
      ? records.map((record) => ({ x: record.timestamp, y: record.value }))
      : [];
    const weekendBands = deriveWeekendBands(records);

    const datasets = [];
    if (points.length) {
      datasets.push({
        label: "NH4 loading",
        data: points,
        parsing: false,
        borderColor: colors.weekday,
        backgroundColor: `${colors.weekday}20`,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      });
    }

    if (thresholdValue !== null && points.length) {
      const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      datasets.push({
        label: `Threshold (${formatNumber(thresholdValue)} lbs/day)`,
        data: sortedRecords.map((record) => ({ x: record.timestamp, y: thresholdValue })),
        parsing: false,
        borderColor: colors.threshold,
        borderWidth: 2,
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
      });
    }

    return { datasets, weekendBands };
  }

  function updateTimeSeriesChart(filteredRecords, thresholdValue, options = {}) {
    const { datasets, weekendBands } = buildTimeSeriesDataset(filteredRecords, thresholdValue);
    if (timeSeriesTooltipController) {
      timeSeriesTooltipController.hide();
    }
    const minTimestamp = filteredRecords.length ? filteredRecords[0].timestamp.getTime() : undefined;
    const maxTimestamp = filteredRecords.length
      ? filteredRecords[filteredRecords.length - 1].timestamp.getTime()
      : undefined;
    const zoomLimits = { x: {} };
    if (typeof minTimestamp === "number" && Number.isFinite(minTimestamp)) {
      zoomLimits.x.min = minTimestamp;
    }
    if (typeof maxTimestamp === "number" && Number.isFinite(maxTimestamp)) {
      zoomLimits.x.max = maxTimestamp;
    }

    if (!timeSeriesChart) {
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false,
        },
        scales: {
          x: {
            type: "time",
            min: minTimestamp,
            max: maxTimestamp,
            time: {
              tooltipFormat: "MMM d, HH:mm",
              displayFormats: {
                hour: "MMM d HH:mm",
                day: "MMM d",
              },
            },
            title: {
              display: true,
              text: "Timestamp",
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
            },
            grid: {
              color: "rgba(14, 42, 54, 0.08)",
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "NH4 loading (lbs/day)",
            },
            grid: {
              color: "rgba(14, 42, 54, 0.08)",
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            enabled: false,
            external: timeSeriesTooltipController.handler,
          },
          weekendBackground: {
            ranges: weekendBands,
            fillStyle: `${colors.weekend}20`,
          },
        },
      };

      if (zoomEnabled) {
        chartOptions.plugins.zoom = {
          limits: zoomLimits,
          pan: {
            enabled: true,
            mode: "x",
            threshold: 4,
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x",
          },
        };
      }

      timeSeriesChart = new Chart(els.timeSeriesCanvas, {
        type: "line",
        data: { datasets },
        options: chartOptions,
      });
    } else {
      timeSeriesChart.data.datasets = datasets;
      timeSeriesChart.options.scales.x.min = minTimestamp;
      timeSeriesChart.options.scales.x.max = maxTimestamp;
      if (zoomEnabled && timeSeriesChart.options.plugins && timeSeriesChart.options.plugins.zoom) {
        timeSeriesChart.options.plugins.zoom.limits = zoomLimits;
        if (!timeSeriesChart.options.plugins.zoom.pan) {
          timeSeriesChart.options.plugins.zoom.pan = {};
        }
        timeSeriesChart.options.plugins.zoom.pan.enabled = true;
        timeSeriesChart.options.plugins.zoom.pan.mode = "x";
        timeSeriesChart.options.plugins.zoom.pan.threshold = 4;
      }
      if (!timeSeriesChart.options.plugins) {
        timeSeriesChart.options.plugins = {};
      }
      if (!timeSeriesChart.options.plugins.tooltip) {
        timeSeriesChart.options.plugins.tooltip = {};
      }
      timeSeriesChart.options.plugins.tooltip.enabled = false;
      timeSeriesChart.options.plugins.tooltip.external = timeSeriesTooltipController.handler;
      if (!timeSeriesChart.options.plugins.weekendBackground) {
        timeSeriesChart.options.plugins.weekendBackground = {};
      }
      timeSeriesChart.options.plugins.weekendBackground.ranges = weekendBands;
      timeSeriesChart.options.plugins.weekendBackground.fillStyle = `${colors.weekend}20`;
      timeSeriesChart.update();
    }

    if (options.resetZoom && timeSeriesChart && typeof timeSeriesChart.resetZoom === "function") {
      timeSeriesChart.resetZoom();
    }
  }

  function updateHourlyBarChart(hourAnalytics) {
    const labels = hourAnalytics.map((bucket) => bucket.hour.toString().padStart(2, "0"));
    const exceedances = hourAnalytics.map((bucket) => bucket.exceedances);
    const totals = hourAnalytics.map((bucket) => bucket.total);

    if (!hourlyBarChart) {
      hourlyBarChart = new Chart(els.hourlyBarCanvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Exceedances",
              data: exceedances,
              backgroundColor: `${colors.threshold}66`,
              borderColor: colors.threshold,
              borderWidth: 1,
            },
            {
              label: "Total samples",
              data: totals,
              backgroundColor: `${colors.neutral}33`,
              borderColor: colors.neutral,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: "Hour of day (24h)" },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Sample count" },
              grid: { color: "rgba(14, 42, 54, 0.08)" },
            },
          },
          plugins: {
            legend: { position: "bottom" },
          },
        },
      });
    } else {
      hourlyBarChart.data.labels = labels;
      hourlyBarChart.data.datasets[0].data = exceedances;
      hourlyBarChart.data.datasets[1].data = totals;
      hourlyBarChart.update();
    }
  }

  /* ===== Tables and UI updates ===== */
  function updateHourTable(hourAnalytics) {
    const rowsWithData = hourAnalytics.filter((bucket) => bucket.total > 0);
    if (!rowsWithData.length) {
      els.hourTableBody.innerHTML =
        '<tr><td colspan="4" class="hours-placeholder">No records available with the current filters.</td></tr>';
      return;
    }

    const ranked = [...rowsWithData].sort((a, b) => {
      if (b.exceedances !== a.exceedances) {
        return b.exceedances - a.exceedances;
      }
      if ((b.share ?? 0) !== (a.share ?? 0)) {
        return (b.share ?? 0) - (a.share ?? 0);
      }
      return (b.average ?? 0) - (a.average ?? 0);
    });

    const rows = ranked
      .map((bucket) => {
        const hourLabel = bucket.hour.toString().padStart(2, "0");
        const shareText = bucket.share !== null ? formatPercent(bucket.share) : "—";
        const avgText = bucket.average !== null ? `${formatNumber(bucket.average)} lbs/day` : "—";
        return `
          <tr>
            <td>${hourLabel}:00</td>
            <td>${bucket.exceedances}</td>
            <td>${shareText}</td>
            <td>${avgText}</td>
          </tr>
        `;
      })
      .join("");

    els.hourTableBody.innerHTML = rows;
  }

  function updatePreviewTable(records) {
    if (!records.length) {
      els.previewTableBody.innerHTML =
        '<tr><td colspan="3" class="preview-placeholder">Waiting for data…</td></tr>';
      return;
    }

    const rows = records
      .slice(0, 15)
      .map((record) => {
        const timestamp = formatTimestamp(record.timestamp);
        const value = `${formatNumber(record.value)} lbs/day`;
        const segment = record.isWeekend ? "Weekend" : "Weekday";
        return `
          <tr>
            <td>${timestamp}</td>
            <td>${value}</td>
            <td>${segment}</td>
          </tr>
        `;
      })
      .join("");

    els.previewTableBody.innerHTML = rows;
  }

  function updateDateControls() {
    if (!els.startDateInput || !els.endDateInput) {
      return;
    }
    const hasData = Boolean(state.extents.start && state.extents.end);
    els.startDateInput.disabled = !hasData;
    els.endDateInput.disabled = !hasData;
    if (els.resetDateRange) {
      els.resetDateRange.disabled = !hasData;
    }

    if (!hasData) {
      els.startDateInput.value = "";
      els.endDateInput.value = "";
      if (els.dateRangeHint) {
        els.dateRangeHint.textContent = "Load data to enable range selection.";
      }
      return;
    }

    const minValue = formatDateForInput(state.extents.start);
    const maxValue = formatDateForInput(state.extents.end);
    els.startDateInput.min = minValue;
    els.startDateInput.max = maxValue;
    els.endDateInput.min = minValue;
    els.endDateInput.max = maxValue;

    const startValue = formatDateForInput(state.dateRange.start ?? state.extents.start);
    const endValue = formatDateForInput(state.dateRange.end ?? state.extents.end);
    els.startDateInput.value = startValue;
    els.endDateInput.value = endValue;

    if (els.dateRangeHint) {
      els.dateRangeHint.textContent = `Dataset spans ${formatShortDate(state.extents.start)} – ${formatShortDate(state.extents.end)}. Scroll to zoom (hold Shift to pan) or choose specific dates.`;
    }
  }

  function handleDateRangeChange() {
    if (!state.extents.start || !state.extents.end) {
      return;
    }
    const startValue = els.startDateInput ? els.startDateInput.value : "";
    const endValue = els.endDateInput ? els.endDateInput.value : "";

    let start = createDateFromInputValue(startValue, { end: false }) || cloneDate(state.extents.start);
    let end = createDateFromInputValue(endValue, { end: true }) || cloneDate(state.extents.end);

    if (start && end && start.getTime() > end.getTime()) {
      const swappedStart = startOfDay(end);
      const swappedEnd = endOfDay(start);
      start = swappedStart;
      end = swappedEnd;
    }

    state.dateRange = {
      start: start ? cloneDate(start) : null,
      end: end ? cloneDate(end) : null,
    };

    state.shouldResetZoom = true;
    updateDateControls();
    recalculateAndRender();
  }

  function handleResetDateRange() {
    if (!state.extents.start || !state.extents.end) {
      return;
    }
    state.dateRange = {
      start: cloneDate(state.extents.start),
      end: cloneDate(state.extents.end),
    };
    state.shouldResetZoom = true;
    updateDateControls();
    recalculateAndRender();
  }

  function handleResetZoom() {
    if (timeSeriesChart && typeof timeSeriesChart.resetZoom === "function") {
      timeSeriesChart.resetZoom();
    }
  }

  function updateThresholdSummary(filteredRecords, thresholdValue) {
    if (!filteredRecords.length) {
      els.thresholdSummary.textContent = "No dataset loaded yet";
      return;
    }
    if (thresholdValue === null) {
      els.thresholdSummary.textContent = "Threshold unavailable (no base average)";
      return;
    }
    const exceedances = filteredRecords.filter((record) => record.value >= thresholdValue);
    const share = exceedances.length / filteredRecords.length;
    els.thresholdSummary.textContent =
      exceedances.length > 0
        ? `${exceedances.length} of ${filteredRecords.length} samples (${formatPercent(share)}) exceed ${formatNumber(
            thresholdValue,
          )} lbs/day`
        : `No samples exceed ${formatNumber(thresholdValue)} lbs/day`;
  }

  function updateThresholdLabels(thresholdValue, multiplier) {
    els.thresholdValue.textContent =
      thresholdValue !== null ? `${formatNumber(thresholdValue)} lbs/day` : "N/A (no base available)";
    els.thresholdPercent.textContent = `${Math.round(multiplier * 100)}%`;
  }

  function recalculateAndRender() {
    const baseAverage = deriveBaseAverage();
    const thresholdValue =
      baseAverage !== null ? Math.round(baseAverage * state.thresholdMultiplier * 10) / 10 : null;

    updateThresholdLabels(thresholdValue, state.thresholdMultiplier);

    const filteredRecords = getFilteredRecords();
    const hourAnalytics = calculateHourAnalytics(filteredRecords, thresholdValue);
    const shouldResetZoom = state.shouldResetZoom;
    state.shouldResetZoom = false;

    updateTimeSeriesChart(filteredRecords, thresholdValue, { resetZoom: shouldResetZoom });
    updateHourlyBarChart(hourAnalytics);
    updateHourTable(hourAnalytics);
    updateThresholdSummary(filteredRecords, thresholdValue);
    updatePreviewTable(state.records);
    if (els.resetZoomButton) {
      els.resetZoomButton.disabled = !filteredRecords.length;
    }
  }

  function handleDataset(records) {
    state.records = records;
    state.stats = computeStatistics(records);
    if (records.length) {
      const earliest = startOfDay(records[0].timestamp);
      const latest = endOfDay(records[records.length - 1].timestamp);
      state.extents = {
        start: cloneDate(earliest),
        end: cloneDate(latest),
      };
      state.dateRange = {
        start: cloneDate(earliest),
        end: cloneDate(latest),
      };
    } else {
      state.extents = { start: null, end: null };
      state.dateRange = { start: null, end: null };
    }
    state.shouldResetZoom = true;
    updateDateControls();
    updateSummary(state.stats);
    recalculateAndRender();
  }

  /* ===== Event handlers ===== */
  function handleFileUpload(event) {
    const { files } = event.target;
    if (!files || !files[0]) {
      return;
    }
    const file = files[0];
    els.loadStatus.textContent = `Loading ${file.name}…`;
    getWorkbookFromFile(file)
      .then((workbook) => {
        const records = parseWorkbook(workbook);
        if (!records.length) {
          throw new Error("No valid records found. Confirm the timestamp and NH4 columns are populated.");
        }
        handleDataset(records);
        els.loadStatus.textContent = `Loaded ${records.length} records from ${file.name}.`;
      })
      .catch((error) => {
        console.error(error);
        els.loadStatus.textContent = error.message || "Unable to read that workbook.";
      })
      .finally(() => {
        event.target.value = "";
      });
  }

  function handleDemoLoad() {
    els.loadStatus.textContent = "Loading demo dataset…";
    getWorkbookFromUrl("../../sample-data/NH4 Loading - Original.xlsx")
      .then((workbook) => {
        const records = parseWorkbook(workbook);
        if (!records.length) {
          throw new Error("Demo workbook did not contain readable data.");
        }
        handleDataset(records);
        els.loadStatus.textContent = `Loaded ${records.length} demo records.`;
      })
      .catch((error) => {
        console.error(error);
        els.loadStatus.textContent = error.message || "Unable to load the demo dataset.";
      });
  }

  function handleBaseAverageChange(event) {
    state.baseAverageKey = event.target.value;
    recalculateAndRender();
  }

  function syncMultiplierInputs(value) {
    const clamped = clamp(Number.parseFloat(value), 0.5, 2.5);
    if (Number.isNaN(clamped)) {
      return;
    }
    state.thresholdMultiplier = clamped;
    els.thresholdSlider.value = clamped.toString();
    els.thresholdNumber.value = clamped.toString();
    recalculateAndRender();
  }

  function handleThresholdSlider(event) {
    syncMultiplierInputs(event.target.value);
  }

  function handleThresholdNumber(event) {
    syncMultiplierInputs(event.target.value);
  }

  function handleWeekdayToggle(event) {
    state.includeWeekday = event.target.checked;
    recalculateAndRender();
  }

  function handleWeekendToggle(event) {
    state.includeWeekend = event.target.checked;
    recalculateAndRender();
  }

  function initialiseControls() {
    if (els.fileInput) {
      els.fileInput.addEventListener("change", handleFileUpload);
    }
    if (els.useDemoButton) {
      els.useDemoButton.addEventListener("click", handleDemoLoad);
    }
    if (els.baseAverageSelect) {
      els.baseAverageSelect.addEventListener("change", handleBaseAverageChange);
    }
    if (els.thresholdSlider) {
      els.thresholdSlider.addEventListener("input", handleThresholdSlider);
    }
    if (els.thresholdNumber) {
      els.thresholdNumber.addEventListener("change", handleThresholdNumber);
      els.thresholdNumber.addEventListener("blur", handleThresholdNumber);
    }
    if (els.weekdayToggle) {
      els.weekdayToggle.addEventListener("change", handleWeekdayToggle);
    }
    if (els.weekendToggle) {
      els.weekendToggle.addEventListener("change", handleWeekendToggle);
    }
    if (els.startDateInput) {
      els.startDateInput.addEventListener("change", handleDateRangeChange);
    }
    if (els.endDateInput) {
      els.endDateInput.addEventListener("change", handleDateRangeChange);
    }
    if (els.resetDateRange) {
      els.resetDateRange.addEventListener("click", handleResetDateRange);
    }
    if (els.resetZoomButton) {
      els.resetZoomButton.addEventListener("click", handleResetZoom);
    }
  }

  function initialise() {
    updateDateControls();
    updateSummary(state.stats);
    updatePreviewTable([]);
    initialiseControls();
    recalculateAndRender();
  }

  initialise();
})();
