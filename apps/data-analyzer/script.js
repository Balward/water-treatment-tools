// Wait for all scripts to load, then register zoom plugin
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔄 Data Analyzer Script v20250820003 loaded - with AI provider selection");
  console.log("Chart.js version:", Chart.version);
  console.log(
    "Available on window:",
    Object.keys(window).filter(
      (key) => key.includes("Chart") || key.includes("zoom")
    )
  );

  // Wait a bit more for plugins to load
  setTimeout(() => {
    console.log("Attempting zoom plugin registration...");

    // Check various possible plugin locations
    const possiblePlugins = [
      window.ChartZoom,
      window["chartjs-plugin-zoom"],
      window.chartjsPluginZoom,
    ];

    let pluginRegistered = false;

    for (let plugin of possiblePlugins) {
      if (plugin) {
        try {
          Chart.register(plugin);
          console.log("✅ Zoom plugin registered successfully:", plugin);
          pluginRegistered = true;
          break;
        } catch (error) {
          console.log("❌ Failed to register plugin:", error);
        }
      }
    }

    if (!pluginRegistered) {
      console.log(
        "⚠️ No zoom plugin found. Available keys:",
        Object.keys(window)
      );
    }

    // Test if zoom is working by checking registered plugins
    console.log("Registered Chart.js plugins:", Chart.registry.plugins.items);
  }, 100);
});

// Global variables
let data = [];
let variables = [];
let units = {};

// Set Chart.js default font to Source Sans Pro
Chart.defaults.font.family =
  "'SourceSansPro', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.font.size = 14;

// Chart instances
let correlationChart = null;
let timeSeriesChart = null;
let distributionChart = null;
let optimizationChart = null;

// Initialize application
window.addEventListener("load", function () {
  loadData();
});

// Load and parse Excel data
async function loadData() {
  try {
    // Enhanced loading sequence with realistic timing
    await updateLoadingProgress(5, "Initializing data analyzer...");
    await new Promise((resolve) => setTimeout(resolve, 300));

    await updateLoadingProgress(15, "Connecting to data source...");
    await new Promise((resolve) => setTimeout(resolve, 400));

    await updateLoadingProgress(25, "Fetching Excel file...");
    const response = await fetch(
      "../../sample-data/Streaming_Current_Data.xlsx"
    );
    if (!response.ok) throw new Error("Failed to fetch data file");

    await updateLoadingProgress(40, "Downloading spreadsheet data...");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const arrayBuffer = await response.arrayBuffer();

    await updateLoadingProgress(55, "Parsing Excel workbook...");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    await updateLoadingProgress(70, "Extracting variables and units...");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });

    if (jsonData.length < 4) {
      throw new Error(
        "Data file must have at least 4 rows (WIMS numbers, variable names, units, and data)"
      );
    }

    // New format:
    // Row 1 (index 0): WIMS system numbers - ignore
    // Row 2 (index 1): Variable names (except column A which is empty, Date is in row 3)
    // Row 3 (index 2): Units (Date label is here for column A)
    // Row 4+ (index 3+): Data starts here

    const wimsRow = jsonData[0]; // Row 1 - ignore
    const variableRow = jsonData[1]; // Row 2 - variable names
    const unitsRow = jsonData[2]; // Row 3 - units and "Date" label
    const dataRows = jsonData.slice(3); // Row 4+ - actual data

    // Extract variables and units
    variables = [];
    units = {};

    variableRow.forEach((variableName, index) => {
      if (index === 0) {
        // Column A: Date column - get name from units row (row 3)
        const dateName = unitsRow[0] && unitsRow[0].toString().trim();
        if (dateName) {
          variables.push(dateName);
          units[dateName] = "";
        }
      } else if (variableName && variableName.toString().trim()) {
        // Other columns: Variable name from row 2, unit from row 3
        const varName = variableName.toString().trim();
        const unit =
          (unitsRow[index] && unitsRow[index].toString().trim()) || "";
        variables.push(varName);
        units[varName] = unit;
      }
    });

    // Process data rows
    data = dataRows
      .filter((row) => {
        // Filter out completely empty rows
        return (
          row &&
          row.some((cell) => cell !== null && cell !== undefined && cell !== "")
        );
      })
      .map((row) => {
        const dataPoint = {};
        variables.forEach((variable, index) => {
          let value = row[index];

          if (value !== null && value !== undefined && value !== "") {
            // Handle Date column specially (first column is always date/time)
            if (
              index === 0 ||
              variable.toLowerCase().includes("date") ||
              variable.toLowerCase().includes("timestamp")
            ) {
              if (typeof value === "string") {
                dataPoint[variable] = value;
              } else {
                // Excel date number - convert to date string
                const date = new Date((value - 25569) * 86400 * 1000);
                dataPoint[variable] =
                  date.toLocaleDateString("en-US") +
                  " " +
                  date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
              }
            } else {
              // Numeric values
              const numValue =
                typeof value === "number" ? value : parseFloat(value);
              dataPoint[variable] = !isNaN(numValue) ? numValue : value;
            }
          } else {
            dataPoint[variable] = null;
          }
        });
        return dataPoint;
      });

    await updateLoadingProgress(85, "Processing data rows...");
    await new Promise((resolve) => setTimeout(resolve, 400));

    await updateLoadingProgress(95, "Setting up interface...");
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Initialize UI
    populateSelectors();
    displayDataInfo();
    setDefaultSelections();
    showMainContent();

    await updateLoadingProgress(100, "Analysis ready!");
    await new Promise((resolve) => setTimeout(resolve, 600));

    hideLoadingScreen();
  } catch (error) {
    console.error("Error loading data:", error);
    hideLoadingScreen();
    showNotification("Error loading data: " + error.message, "error");
  }
}

// Update loading progress with smooth animation
async function updateLoadingProgress(targetPercentage, text) {
  const progressFill = document.getElementById("progressFill");
  const loadingText = document.getElementById("loadingText");

  if (loadingText) {
    loadingText.textContent = text;
  }

  if (progressFill) {
    const currentWidth = parseInt(progressFill.style.width) || 0;
    const difference = targetPercentage - currentWidth;
    const steps = 20;
    const increment = difference / steps;

    for (let i = 0; i <= steps; i++) {
      const newWidth = currentWidth + increment * i;
      progressFill.style.width = Math.min(newWidth, targetPercentage) + "%";
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
}

// Hide loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }
}

// Show main content
function showMainContent() {
  const mainContent = document.getElementById("mainContent");
  if (mainContent) {
    mainContent.classList.remove("hidden");
  }
}

// Populate all selector dropdowns
function populateSelectors() {
  const selectorIds = [
    "corrXAxis",
    "corrYAxis",
    "corrColorBy",
    "timeVar1",
    "timeVar2",
    "timeVar3",
    "timeVar4",
    "distVariable",
    "targetVariable",
  ];

  selectorIds.forEach((selectorId) => {
    const selector = document.getElementById(selectorId);
    if (!selector) return;

    // Keep first option, clear rest
    const firstOption = selector.querySelector("option");
    selector.innerHTML = "";
    if (firstOption) {
      selector.appendChild(firstOption);
    }

    // Add variable options (skip date column for all selectors)
    variables.forEach((variable) => {
      const isDateColumn = variables.indexOf(variable) === 0; // First column is always date
      if (isDateColumn) return;

      const option = document.createElement("option");
      option.value = variable;
      const unit =
        units[variable] && units[variable].trim()
          ? ` (${units[variable]})`
          : "";
      option.textContent = `${variable}${unit}`;
      selector.appendChild(option);
    });
  });
}

// Display dataset information
function displayDataInfo() {
  const dataInfo = document.getElementById("dataInfo");
  const totalRows = data.length;
  const totalVariables = variables.length;
  const dateRange = getDateRange();

  // Calculate total individual datapoints (sum of all non-null numeric values)
  let totalDatapoints = 0;
  data.forEach((row) => {
    variables.forEach((variable) => {
      if (
        variable !== "Date" &&
        typeof row[variable] === "number" &&
        !isNaN(row[variable])
      ) {
        totalDatapoints++;
      }
    });
  });

  dataInfo.innerHTML = `
        <div class="dataset-summary">
            <div class="stat-item date-range-full-width">
                <div class="stat-number date-range-dates">${dateRange}</div>
                <div class="stat-label">Collection Period</div>
            </div>
            <div class="stats-grid stats-grid-three">
                <div class="stat-item">
                    <div class="stat-number">${totalRows.toLocaleString()}</div>
                    <div class="stat-label">Total Records</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${totalDatapoints.toLocaleString()}</div>
                    <div class="stat-label">Data Points</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${totalVariables}</div>
                    <div class="stat-label">Variables</div>
                </div>
            </div>
        </div>
    `;
}

// Get date range from data
function getDateRange() {
  const dateColumn = variables[0]; // First column is always date/time
  const dates = data.map((d) => d[dateColumn]).filter((d) => d !== null);
  if (dates.length === 0) return "No dates";

  // Parse dates and sort chronologically
  const parsedDates = dates
    .map((dateStr) => {
      // Parse M/D/YYYY H:MM format
      const match = dateStr.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
      );
      if (match) {
        const [, month, day, year, hour, minute] = match;
        return new Date(year, month - 1, day, hour, minute);
      }
      return new Date(dateStr); // Fallback for other formats
    })
    .filter((date) => !isNaN(date));

  if (parsedDates.length === 0) return "No valid dates";

  // Sort chronologically
  parsedDates.sort((a, b) => a - b);

  // Format back to strings
  const formatDate = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, "0");
    return `${month}/${day}/${year} ${hour}:${minute}`;
  };

  return `${formatDate(parsedDates[0])} to ${formatDate(
    parsedDates[parsedDates.length - 1]
  )}`;
}

// Set default selections
function setDefaultSelections() {
  // Find common variables
  const streamingVar = variables.find(
    (v) =>
      v.toLowerCase().includes("streaming current") ||
      v.toLowerCase().includes("streaming_current")
  );
  const alumVar = variables.find(
    (v) =>
      v.toLowerCase().includes("aluminum") || v.toLowerCase().includes("alum")
  );

  // Set correlation defaults
  if (streamingVar && alumVar) {
    document.getElementById("corrXAxis").value = alumVar;
    document.getElementById("corrYAxis").value = streamingVar;
    updateCorrelationChart();
  }

  // Set time series defaults
  if (streamingVar) {
    document.getElementById("timeVar1").value = streamingVar;
  }
  if (alumVar) {
    document.getElementById("timeVar2").value = alumVar;
  }
  updateTimeSeriesChart();

  // Set distribution default
  if (streamingVar) {
    document.getElementById("distVariable").value = streamingVar;
    updateDistributionChart();
  }

  // Set optimization default to streaming current
  if (streamingVar) {
    document.getElementById("targetVariable").value = streamingVar;
    updateOptimizationChart();
  }
}

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.classList.remove("active"));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  // Update tab content
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));
  document.getElementById(`${tabName}-tab`).classList.add("active");

  // Update charts based on current selections
  switch (tabName) {
    case "correlation":
      updateCorrelationChart();
      break;
    case "timeseries":
      updateTimeSeriesChart();
      break;
    case "distribution":
      updateDistributionChart();
      break;
    case "optimization":
      updateOptimizationChart();
      break;
  }
}

// Get decimal places from data values
function getDecimalPlaces(values) {
  let maxDecimals = 0;
  values.forEach((value) => {
    if (typeof value === "number") {
      const str = value.toString();
      const decimalIndex = str.indexOf(".");
      if (decimalIndex !== -1) {
        const decimals = str.length - decimalIndex - 1;
        maxDecimals = Math.max(maxDecimals, decimals);
      }
    }
  });
  return Math.min(maxDecimals, 4); // Cap at 4 decimal places
}

// Format value based on detected decimal places
function formatValue(value, variable) {
  if (typeof value !== "number" || isNaN(value)) return value;

  // Get sample values for this variable to determine decimal places
  const sampleValues = data
    .slice(0, 100)
    .map((d) => d[variable])
    .filter((v) => typeof v === "number");
  const decimals = getDecimalPlaces(sampleValues);

  return value.toFixed(decimals);
}

// Update correlation chart
function updateCorrelationChart() {
  const xVar = document.getElementById("corrXAxis").value;
  const yVar = document.getElementById("corrYAxis").value;
  const colorVar = document.getElementById("corrColorBy").value;

  const emptyState = document.getElementById("correlationEmpty");
  const chart = document.getElementById("correlationChart");

  if (!xVar || !yVar) {
    document.getElementById("correlationTitle").textContent =
      "Select variables to view correlation";
    document.getElementById("correlationSubtitle").textContent = "";
    // Show empty state, hide chart
    emptyState.style.display = "block";
    chart.style.display = "none";
    return;
  }

  // Hide empty state, show chart
  emptyState.style.display = "none";
  chart.style.display = "block";

  // Get valid data points with color variable if specified
  let validData = data
    .map((d) => ({
      x: d[xVar],
      y: d[yVar],
      color: colorVar ? d[colorVar] : null,
    }))
    .filter(
      (point) =>
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        !isNaN(point.x) &&
        !isNaN(point.y) &&
        (!colorVar || (typeof point.color === "number" && !isNaN(point.color)))
    );

  if (validData.length === 0) {
    showNotification(
      "No valid data points found for selected variables",
      "warning"
    );
    return;
  }

  let datasets = [];

  if (colorVar) {
    // Group data by color variable ranges
    const colorValues = validData.map((d) => d.color);
    const colorRanges = createColorRanges(colorValues, colorVar);
    const colors = [
      "#667eea",
      "#764ba2",
      "#f093fb",
      "#f5576c",
      "#4facfe",
      "#00d2ff",
      "#667eea",
      "#764ba2",
    ];

    colorRanges.forEach((range, index) => {
      const rangeData = validData.filter(
        (d) => d.color >= range.min && d.color <= range.max
      );
      if (rangeData.length > 0) {
        const bubbleData = createBubbleData(rangeData);
        datasets.push({
          label: range.label,
          data: bubbleData,
          backgroundColor: colors[index] + "80",
          borderColor: colors[index],
          borderWidth: 2,
        });
      }
    });
  } else {
    // Single dataset with bubble sizing
    const bubbleData = createBubbleData(validData);
    datasets.push({
      label: `${yVar} vs ${xVar}`,
      data: bubbleData,
      backgroundColor: "rgba(102, 126, 234, 0.6)",
      borderColor: "rgba(102, 126, 234, 1)",
      borderWidth: 2,
    });
  }

  // Destroy existing chart
  if (correlationChart) {
    correlationChart.destroy();
  }

  // Calculate axis ranges with 10% buffer
  const xValues = validData.map((d) => d.x);
  const yValues = validData.map((d) => d.y);
  const xRange = calculateAxisRange(xValues, xVar);
  const yRange = calculateAxisRange(yValues, yVar);

  const ctx = document.getElementById("correlationChart").getContext("2d");
  correlationChart = new Chart(ctx, {
    type: "bubble",
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              const x = formatValue(context.parsed.x, xVar);
              const y = formatValue(context.parsed.y, yVar);
              const count = context.raw.count || 1;
              const countText = count > 1 ? ` (${count} points)` : "";
              return `(${x}, ${y})${countText}`;
            },
          },
        },
        ...getNoZoomConfig(),
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: `${xVar}${units[xVar] ? ` (${units[xVar]})` : ""}`,
          },
          min: xRange.min,
          max: xRange.max,
          ticks: {
            callback: function (value) {
              return formatValue(value, xVar);
            },
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: `${yVar}${units[yVar] ? ` (${units[yVar]})` : ""}`,
          },
          min: yRange.min,
          max: yRange.max,
          ticks: {
            callback: function (value) {
              return formatValue(value, yVar);
            },
          },
        },
      },
    },
  });

  // Calculate correlation coefficient and update title/subtitle
  const correlation = calculateCorrelation(xValues, yValues);
  const xUnit = units[xVar] ? ` (${units[xVar]})` : "";
  const yUnit = units[yVar] ? ` (${units[yVar]})` : "";

  // Main title: Variable comparison
  document.getElementById(
    "correlationTitle"
  ).textContent = `${yVar}${yUnit} vs ${xVar}${xUnit}`;

  // Subtitle: R-value and color info
  const colorText = colorVar
    ? ` • Colored by ${colorVar}${
        units[colorVar] ? ` (${units[colorVar]})` : ""
      }`
    : "";
  const correlationText = isNaN(correlation)
    ? "undefined (constant values)"
    : correlation.toFixed(3);
  document.getElementById(
    "correlationSubtitle"
  ).textContent = `R = ${correlationText}${colorText}`;
}

// Create color ranges (maximum 5)
function createColorRanges(values, variable) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    return [{ min: min, max: max, label: formatValue(min, variable) }];
  }

  const numRanges = Math.min(
    5,
    Math.max(2, Math.ceil(Math.sqrt(values.length / 10)))
  );
  const rangeSize = range / numRanges;
  const ranges = [];

  for (let i = 0; i < numRanges; i++) {
    const rangeMin = min + i * rangeSize;
    const rangeMax = i === numRanges - 1 ? max : min + (i + 1) * rangeSize;
    const unit = units[variable] ? ` ${units[variable]}` : "";

    ranges.push({
      min: rangeMin,
      max: rangeMax,
      label: `${formatValue(rangeMin, variable)} - ${formatValue(
        rangeMax,
        variable
      )}${unit}`,
    });
  }

  return ranges;
}

// Create bubble data with frequency-based sizing
function createBubbleData(validData) {
  // Group points by coordinates to count frequency
  const pointMap = {};
  const tolerance = 1e-6; // Small tolerance for floating point comparison

  validData.forEach((point) => {
    const key = `${Math.round(point.x / tolerance) * tolerance},${
      Math.round(point.y / tolerance) * tolerance
    }`;
    if (!pointMap[key]) {
      pointMap[key] = { x: point.x, y: point.y, count: 0 };
    }
    pointMap[key].count++;
  });

  // Convert to bubble format with size based on frequency
  return Object.values(pointMap).map((point) => ({
    x: point.x,
    y: point.y,
    r: Math.max(3, Math.min(20, 3 + Math.log(point.count) * 3)), // Logarithmic scaling
    count: point.count,
  }));
}

// Calculate axis range with 10% buffer and minimum 0 (except streaming current)
function calculateAxisRange(values, variable) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Handle constant values (when all values are the same)
  let buffer;
  if (range === 0) {
    // If all values are the same, create a reasonable buffer around that value
    buffer = Math.abs(min) * 0.1 || 0.1; // 10% of the value, or 0.1 if value is 0
  } else {
    buffer = range * 0.1;
  }

  const allowsNegativeValues =
    variable.toLowerCase().includes("streaming current") ||
    variable.toLowerCase().includes("streaming_current") ||
    variable.toLowerCase().includes("zeta potential") ||
    variable.toLowerCase().includes("zeta_potential");

  return {
    min: allowsNegativeValues ? min - buffer : Math.max(0, min - buffer),
    max: max + buffer,
  };
}

// Update time series chart
function updateTimeSeriesChart() {
  const selectedVars = [1, 2, 3, 4]
    .map((i) => document.getElementById(`timeVar${i}`).value)
    .filter((v) => v && v !== "");

  if (selectedVars.length === 0) {
    document.getElementById("timeSeriesTitle").textContent =
      "Select variables to view time series";
    return;
  }

  // Process date column for time axis
  const dateColumn = variables[0]; // First column is always date/time
  const timeData = data
    .map((d, index) => {
      const dateStr = d[dateColumn];
      if (!dateStr) return null;

      // Parse M/D/YYYY H:MM format
      const match = dateStr.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
      );
      if (match) {
        const [, month, day, year, hour, minute] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute)
        );
      }
      return null;
    })
    .filter((d) => d !== null);

  if (timeData.length === 0) {
    showNotification("No valid dates found in Date column", "error");
    return;
  }

  const colors = [
    "#667eea",
    "#764ba2",
    "#f093fb",
    "#f5576c",
    "#4facfe",
    "#00d2ff",
    "#667eea",
    "#764ba2",
  ];
  const datasets = [];

  // Determine y-axis assignments
  const { assignments, axes } = determineYAxisAssignments(
    selectedVars,
    datasets
  );

  selectedVars.forEach((variable, index) => {
    const dataPoints = [];

    data.forEach((point, rowIndex) => {
      const dateStr = point.Date;
      const value = point[variable];

      if (dateStr && typeof value === "number" && !isNaN(value)) {
        const match = dateStr.match(
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
        );
        if (match) {
          const [, month, day, year, hour, minute] = match;
          const date = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );
          dataPoints.push({ x: date, y: value });
        }
      }
    });

    if (dataPoints.length > 0) {
      datasets.push({
        label: `${variable}${units[variable] ? ` (${units[variable]})` : ""}`,
        data: dataPoints,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + "20",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
        yAxisID: assignments[variable] || "y",
      });
    }
  });

  if (datasets.length === 0) {
    showNotification("No valid data found for time series", "error");
    return;
  }

  // Destroy existing chart
  if (timeSeriesChart) {
    timeSeriesChart.destroy();
  }

  const ctx = document.getElementById("timeSeriesChart").getContext("2d");
  timeSeriesChart = new Chart(ctx, {
    type: "line",
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (context) {
              const variable = context.dataset.label.split(" (")[0];
              const value = formatValue(context.parsed.y, variable);
              return `${context.dataset.label}: ${value}`;
            },
          },
        },
        ...getTimeSeriesZoomConfig(),
      },
      scales: {
        x: {
          type: "time",
          display: true,
          title: { display: true, text: "Date" },
          time: {
            displayFormats: {
              hour: "M/d HH:mm",
              day: "M/d",
              week: "M/d",
              month: "M/yyyy",
            },
          },
        },
        ...Object.fromEntries(
          Object.entries(axes).map(([axisId, axisInfo]) => {
            // Calculate buffered range for this axis
            const allValues = [];
            axisInfo.variables.forEach((variable) => {
              const values = data
                .map((d) => d[variable])
                .filter((v) => typeof v === "number" && !isNaN(v));
              allValues.push(...values);
            });

            // Check if any variable on this axis allows negative values
            const allowsNegative = axisInfo.variables.some(
              (variable) =>
                variable.toLowerCase().includes("streaming current") ||
                variable.toLowerCase().includes("streaming_current") ||
                variable.toLowerCase().includes("zeta potential") ||
                variable.toLowerCase().includes("zeta_potential")
            );

            // Calculate range manually to handle mixed variable types on same axis
            let axisRange = null;
            if (allValues.length > 0) {
              const min = Math.min(...allValues);
              const max = Math.max(...allValues);
              const range = max - min;
              const buffer =
                range === 0 ? Math.abs(min) * 0.1 || 0.1 : range * 0.1;

              axisRange = {
                min: allowsNegative ? min - buffer : Math.max(0, min - buffer),
                max: max + buffer,
              };
            }

            return [
              axisId,
              {
                type: "linear",
                display: true,
                position:
                  axisId === "y" ? "left" : axisId === "y1" ? "right" : "right",
                title: { display: true, text: axisInfo.title },
                ...(axisRange
                  ? { min: axisRange.min, max: axisRange.max }
                  : {}),
                ticks: {
                  callback: function (value) {
                    // Use the first variable's format for this axis
                    const variable = axisInfo.variables[0];
                    return formatValue(value, variable);
                  },
                },
                grid: {
                  drawOnChartArea: axisId === "y", // Only show grid for primary axis
                },
              },
            ];
          })
        ),
      },
      interaction: {
        mode: "index",
        intersect: false,
      },
    },
  });

  // Update chart title with variable names
  const titleVars = selectedVars
    .map((v) => {
      // Truncate long variable names for title display
      return v.length > 20 ? v.substring(0, 17) + "..." : v;
    })
    .join(", ");
  document.getElementById(
    "timeSeriesTitle"
  ).textContent = `${titleVars} over Time`;
}

// Update distribution chart
function updateDistributionChart() {
  const variable = document.getElementById("distVariable").value;
  const binCount = document.getElementById("distBins").value;

  if (!variable) {
    document.getElementById("distributionTitle").textContent =
      "Select variable to view distribution";
    return;
  }

  // Get valid numeric values
  const values = data
    .map((d) => d[variable])
    .filter((v) => typeof v === "number" && !isNaN(v));

  if (values.length === 0) {
    showNotification(
      "No valid numeric data found for selected variable",
      "warning"
    );
    return;
  }

  // Calculate bins
  let bins =
    binCount === "auto"
      ? Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))))
      : parseInt(binCount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binWidth = range / bins;

  // Create histogram data
  const histogram = new Array(bins).fill(0);
  const binLabels = [];
  const decimals = getDecimalPlaces(values);

  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    binLabels.push(
      `${binStart.toFixed(decimals)} - ${binEnd.toFixed(decimals)}`
    );
  }

  values.forEach((value) => {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
    histogram[binIndex]++;
  });

  // Destroy existing chart
  if (distributionChart) {
    distributionChart.destroy();
  }

  const ctx = document.getElementById("distributionChart").getContext("2d");
  distributionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [
        {
          label: "Frequency",
          data: histogram,
          backgroundColor: "rgba(0, 103, 127, 0.6)",
          borderColor: "rgba(0, 103, 127, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        ...getNoZoomConfig(),
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: `${variable}${
              units[variable] ? ` (${units[variable]})` : ""
            } Range`,
          },
        },
        y: {
          display: true,
          title: { display: true, text: "Frequency" },
          beginAtZero: true,
        },
      },
    },
  });

  // Display statistics
  displayStats(values, variable);

  const unit = units[variable] ? ` (${units[variable]})` : "";
  document.getElementById(
    "distributionTitle"
  ).textContent = `Distribution of ${variable}${unit}`;
}

// Display statistics
function displayStats(values, variable) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const stats = {
    count: n,
    mean: mean,
    median: sorted[Math.floor(n / 2)],
    stdDev: stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    q1: sorted[Math.floor(n * 0.25)],
    q3: sorted[Math.floor(n * 0.75)],
  };

  const unit = units[variable] ? ` ${units[variable]}` : "";

  document.getElementById("distributionStats").innerHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <div><strong>Count:</strong> ${stats.count.toLocaleString()}</div>
            <div><strong>Mean:</strong> ${formatValue(
              stats.mean,
              variable
            )}${unit}</div>
            <div><strong>Median:</strong> ${formatValue(
              stats.median,
              variable
            )}${unit}</div>
            <div><strong>Std Dev:</strong> ${formatValue(
              stats.stdDev,
              variable
            )}${unit}</div>
            <div><strong>Min:</strong> ${formatValue(
              stats.min,
              variable
            )}${unit}</div>
            <div><strong>Max:</strong> ${formatValue(
              stats.max,
              variable
            )}${unit}</div>
            <div><strong>Q1:</strong> ${formatValue(
              stats.q1,
              variable
            )}${unit}</div>
            <div><strong>Q3:</strong> ${formatValue(
              stats.q3,
              variable
            )}${unit}</div>
        </div>
    `;
}

// Update optimization chart
function updateOptimizationChart() {
  const targetVar = document.getElementById("targetVariable").value;
  const minCorr = parseFloat(document.getElementById("minCorrelation").value);

  if (!targetVar) {
    document.getElementById("optimizationTitle").textContent =
      "Select target variable for optimization analysis";
    document.getElementById("optimizationSubtitle").textContent = "";
    return;
  }

  // Calculate correlations with target variable
  const correlations = {};

  variables.forEach((variable) => {
    const isDateColumn = variables.indexOf(variable) === 0; // First column is always date
    if (variable === targetVar || isDateColumn) return;

    // Get paired data points where both variables have valid values
    const pairedData = data
      .map((d) => ({
        target: d[targetVar],
        var: d[variable],
      }))
      .filter(
        (pair) =>
          typeof pair.target === "number" &&
          !isNaN(pair.target) &&
          typeof pair.var === "number" &&
          !isNaN(pair.var)
      );

    if (pairedData.length > 1) {
      const targetValues = pairedData.map((d) => d.target);
      const varValues = pairedData.map((d) => d.var);
      const correlation = calculateCorrelation(targetValues, varValues);
      if (Math.abs(correlation) >= minCorr) {
        correlations[variable] = correlation;
      }
    }
  });

  // Display correlation matrix (will auto-create chart for strongest correlation)
  displayCorrelationMatrix(correlations, targetVar);

  // If no correlations found, clear the chart
  if (Object.keys(correlations).length === 0) {
    if (optimizationChart) {
      optimizationChart.destroy();
      optimizationChart = null;
    }
    document.getElementById(
      "optimizationTitle"
    ).textContent = `No correlations ≥ ${minCorr} found for ${targetVar}`;
    document.getElementById("optimizationSubtitle").textContent = "";

    // Hide AI Insights panel
    hideAIInsightsPanel();
  }
}

// Handle correlation variable button selection
function selectCorrelationVariable(variable, targetVar, buttonElement) {
  // Remove active class from all buttons
  document
    .querySelectorAll(".correlation-button")
    .forEach((btn) => btn.classList.remove("active"));

  // Add active class to clicked button
  buttonElement.classList.add("active");

  // Update the chart with selected variable
  createOptimizationScatter(targetVar, variable);
}

// Display correlation matrix as interactive buttons
function displayCorrelationMatrix(correlations, targetVar) {
  const container = document.getElementById("correlationMatrix");

  if (Object.keys(correlations).length === 0) {
    container.innerHTML =
      "<p>No significant correlations found with current threshold.</p>";
    return;
  }

  const sortedCorr = Object.entries(correlations).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1])
  );

  let html = "<div>";
  sortedCorr.forEach(([variable, corr], index) => {
    const direction = corr > 0 ? "↗️" : "↘️";
    const isFirst = index === 0; // First (strongest) correlation is active by default
    const activeClass = isFirst ? "active" : "";

    html += `
            <button class="correlation-button ${activeClass}" onclick="selectCorrelationVariable('${variable}', '${targetVar}', this)">
                <span class="variable-name">${variable}</span>
                <span class="correlation-value">
                    <span class="correlation-direction">${direction}</span>
                    ${Math.abs(corr).toFixed(3)}
                </span>
            </button>
        `;
  });
  html += "</div>";

  container.innerHTML = html;

  // Auto-select the first (strongest) correlation for the graph
  if (sortedCorr.length > 0) {
    const strongestVar = sortedCorr[0][0];
    createOptimizationScatter(targetVar, strongestVar);
  }
}

// Create optimization scatter plot
function createOptimizationScatter(targetVar, strongestVar) {
  // Set current variables for AI explanation
  currentTargetVariable = targetVar;
  currentPredictorVariable = strongestVar;

  const chartData = data
    .map((d) => ({
      x: d[strongestVar],
      y: d[targetVar],
    }))
    .filter(
      (point) =>
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        !isNaN(point.x) &&
        !isNaN(point.y)
    );

  if (chartData.length === 0) {
    showNotification(
      "No valid data points found for optimization chart",
      "warning"
    );
    return;
  }

  // Calculate linear regression for trend line
  const xValues = chartData.map((d) => d.x);
  const yValues = chartData.map((d) => d.y);
  const regression = calculateLinearRegression(xValues, yValues);

  // Calculate axis ranges with buffer
  const xRange = calculateAxisRange(xValues, strongestVar);
  const yRange = calculateAxisRange(yValues, targetVar);

  // Create trend line points across data range
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const trendLineData = [
    { x: minX, y: regression.slope * minX + regression.intercept },
    { x: maxX, y: regression.slope * maxX + regression.intercept },
  ];

  // Destroy existing chart
  if (optimizationChart) {
    optimizationChart.destroy();
  }

  const ctx = document.getElementById("optimizationChart").getContext("2d");
  optimizationChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${targetVar} vs ${strongestVar}`,
          data: chartData,
          backgroundColor: "rgba(220, 38, 38, 0.6)",
          borderColor: "rgba(220, 38, 38, 1)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
        },
        {
          label: "Trend Line",
          data: trendLineData,
          backgroundColor: "transparent",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          showLine: true,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          filter: function (tooltipItem) {
            // Hide tooltip for trend line
            return tooltipItem.datasetIndex === 0;
          },
          callbacks: {
            label: function (context) {
              const x = formatValue(context.parsed.x, strongestVar);
              const y = formatValue(context.parsed.y, targetVar);
              return `(${x}, ${y})`;
            },
          },
        },
        ...getNoZoomConfig(),
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: `${strongestVar}${
              units[strongestVar] ? ` (${units[strongestVar]})` : ""
            }`,
          },
          min: xRange.min,
          max: xRange.max,
          ticks: {
            callback: function (value) {
              return formatValue(value, strongestVar);
            },
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: `${targetVar}${
              units[targetVar] ? ` (${units[targetVar]})` : ""
            }`,
          },
          min: yRange.min,
          max: yRange.max,
          ticks: {
            callback: function (value) {
              return formatValue(value, targetVar);
            },
          },
        },
      },
    },
  });

  // Update title with correlation and R² values
  const correlation = calculateCorrelation(xValues, yValues);
  currentCorrelationValue = correlation; // Store for AI explanation

  const xUnit = units[strongestVar] ? ` (${units[strongestVar]})` : "";
  const yUnit = units[targetVar] ? ` (${units[targetVar]})` : "";
  document.getElementById(
    "optimizationTitle"
  ).textContent = `${targetVar}${yUnit} vs ${strongestVar}${xUnit}`;

  // Create subtitle with correlation info
  const subtitleElement = document.getElementById("optimizationSubtitle");
  if (subtitleElement) {
    subtitleElement.textContent = `R = ${correlation.toFixed(
      3
    )} • R² = ${regression.r2.toFixed(3)}`;
  }

  // Show AI Insights panel and populate correlation info
  showAIInsightsPanel(strongestVar, targetVar, correlation);
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

// Calculate linear regression (best fit line)
function calculateLinearRegression(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
  const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
  const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
  const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const correlation = calculateCorrelation(x, y);
  const r2 = correlation * correlation;

  return { slope, intercept, r2 };
}

// Get zoom configuration for time series charts only
function getTimeSeriesZoomConfig() {
  return {
    zoom: {
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: false,
        },
        drag: {
          enabled: false,
        },
        mode: "x",
      },
      pan: {
        enabled: true,
        mode: "x",
      },
    },
  };
}

// Get empty configuration for other charts (no zoom/pan)
function getNoZoomConfig() {
  return {};
}

// Determine y-axis assignments for time series variables
function determineYAxisAssignments(selectedVars, datasets) {
  if (selectedVars.length <= 1) {
    return {
      assignments: { [selectedVars[0]]: "y" },
      axes: { y: { variables: selectedVars, title: "Values" } },
    };
  }

  // Check for manual axis assignments first
  const manualAssignments = {};
  selectedVars.forEach((variable, index) => {
    const checkbox = document.getElementById(`timeVar${index + 1}Axis`);
    if (checkbox && checkbox.checked) {
      manualAssignments[variable] = true;
    }
  });

  // Calculate ranges for each variable
  const varRanges = {};
  selectedVars.forEach((variable) => {
    const values = data
      .map((d) => d[variable])
      .filter((v) => typeof v === "number" && !isNaN(v));
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      const magnitude = Math.log10(Math.abs(max) || 1);
      varRanges[variable] = { min, max, range, magnitude, values };
    }
  });

  // Group variables by similar magnitude and range, respecting manual assignments
  const axes = { y: { variables: [], title: "Primary Axis" } };
  const assignments = {};

  // Sort variables by magnitude
  const sortedVars = selectedVars
    .filter((v) => varRanges[v])
    .sort((a, b) => varRanges[a].magnitude - varRanges[b].magnitude);

  if (sortedVars.length === 0) return { assignments, axes };

  // Handle manual assignments first
  let nextAxisNumber = 1;
  sortedVars.forEach((currentVar) => {
    if (manualAssignments[currentVar]) {
      // Force this variable to its own axis
      const newAxisId = nextAxisNumber === 1 ? "y1" : `y${nextAxisNumber}`;
      axes[newAxisId] = {
        variables: [currentVar],
        title: `${currentVar} Axis`,
      };
      assignments[currentVar] = newAxisId;
      nextAxisNumber++;
    }
  });

  // Now handle automatic assignments for non-manual variables
  sortedVars.forEach((currentVar, index) => {
    if (manualAssignments[currentVar]) return; // Skip manually assigned variables

    const currentRange = varRanges[currentVar];
    let assignedAxis = null;

    // If this is the first auto-assigned variable and primary axis is empty, use it
    if (axes.y.variables.length === 0) {
      assignedAxis = "y";
    } else {
      // Check if this variable can share an existing axis (excluding manual axes)
      for (const [axisId, axisInfo] of Object.entries(axes)) {
        if (axisInfo.variables.length === 0) continue;

        // Skip axes that contain manually assigned variables
        const hasManualVar = axisInfo.variables.some(
          (v) => manualAssignments[v]
        );
        if (hasManualVar) continue;

        // Get representative variable from this axis
        const refVar = axisInfo.variables[0];
        const refRange = varRanges[refVar];

        // Check if magnitudes are similar (within 2 orders of magnitude)
        const magnitudeDiff = Math.abs(
          currentRange.magnitude - refRange.magnitude
        );

        // Check if ranges overlap significantly or are similar scale
        const overlapCheck =
          currentRange.min <= refRange.max && currentRange.max >= refRange.min;
        const scaleCheck = magnitudeDiff < 2;

        if (scaleCheck || overlapCheck) {
          assignedAxis = axisId;
          break;
        }
      }
    }

    if (assignedAxis) {
      // Add to existing axis
      axes[assignedAxis].variables.push(currentVar);
      assignments[currentVar] = assignedAxis;
    } else {
      // Create new axis if we haven't hit the limit
      if (Object.keys(axes).length < 4) {
        const newAxisId = `y${nextAxisNumber}`;
        axes[newAxisId] = { variables: [currentVar], title: "Auto Axis" };
        assignments[currentVar] = newAxisId;
        nextAxisNumber++;
      } else {
        // Fallback to primary axis if we've hit the limit
        axes.y.variables.push(currentVar);
        assignments[currentVar] = "y";
      }
    }
  });

  // Update axis titles based on variables
  for (const [axisId, axisInfo] of Object.entries(axes)) {
    if (axisInfo.variables.length === 1) {
      const variable = axisInfo.variables[0];
      axisInfo.title = `${variable}${
        units[variable] ? ` (${units[variable]})` : ""
      }`;
    } else if (axisInfo.variables.length > 1) {
      // Check if all variables have the same unit
      const variableUnits = axisInfo.variables
        .map((v) => units[v])
        .filter((u) => u);
      const uniqueUnits = [...new Set(variableUnits)];

      if (uniqueUnits.length === 1 && uniqueUnits[0]) {
        // All variables have the same unit - show names on separate lines with shared unit at bottom
        const variableLines = axisInfo.variables.map((v) => {
          return v.length > 20 ? v.substring(0, 17) + "..." : v;
        });
        axisInfo.title = `${variableLines.join("\n")} (${uniqueUnits[0]})`;
      } else if (uniqueUnits.length === 0) {
        // No units available - show variable names on separate lines
        const variableLines = axisInfo.variables.map((v) => {
          return v.length > 20 ? v.substring(0, 17) + "..." : v;
        });
        axisInfo.title = variableLines.join("\n");
      } else {
        // Mixed units - show each variable with unit on separate lines
        const variableWithUnits = axisInfo.variables.map((v) => {
          const varName = v.length > 20 ? v.substring(0, 17) + "..." : v;
          return units[v] ? `${varName} (${units[v]})` : varName;
        });
        axisInfo.title = variableWithUnits.join("\n");
      }
    }
  }

  return { assignments, axes };
}

// Show notification
function showNotification(message, type = "info") {
  const container = document.getElementById("notificationContainer");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 4000);
}

// Global variables for current correlation context
let currentTargetVariable = null;
let currentPredictorVariable = null;
let currentCorrelationValue = null;

// Show AI Insights panel with correlation information
function showAIInsightsPanel(predictorVar, targetVar, correlationValue) {
  // Store current correlation context
  currentTargetVariable = targetVar;
  currentPredictorVariable = predictorVar;
  currentCorrelationValue = correlationValue;

  // Show the AI Insights panel
  const aiInsightsPanel = document.getElementById("aiInsightsPanel");
  if (aiInsightsPanel) {
    aiInsightsPanel.style.display = "block";
  }

  // Show and populate correlation context
  const correlationContext = document.getElementById("correlationContext");
  const correlationDisplayText = document.getElementById("correlationDisplayText");
  const correlationDisplayValue = document.getElementById("correlationDisplayValue");
  
  if (correlationContext && correlationDisplayText && correlationDisplayValue) {
    correlationDisplayText.textContent = `${predictorVar} → ${targetVar}`;
    correlationDisplayValue.textContent = correlationValue.toFixed(3);
    correlationContext.style.display = "flex";
  }

  // Show the explain correlation button
  const explainBtn = document.getElementById("explainCorrelationBtn");
  if (explainBtn) {
    explainBtn.style.display = "block";
  }
}

// Hide AI Insights panel
function hideAIInsightsPanel() {
  const aiInsightsPanel = document.getElementById("aiInsightsPanel");
  if (aiInsightsPanel) {
    aiInsightsPanel.style.display = "none";
  }
}

// Claude Proxy Configuration - detects if running in container or locally
const CLAUDE_PROXY_URL = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return "http://localhost:3001/api/claude";  // Local development
  }
  
  // For production, try main domain first (if Traefik is configured to proxy /api/claude)
  // Otherwise fallback to port-based URL
  if (window.location.protocol === 'https:') {
    return `${window.location.protocol}//${window.location.hostname}/api/claude`;
  } else {
    return `${window.location.protocol}//${window.location.hostname}:6768/api/claude`;
  }
})();

console.log('Claude Proxy URL detected:', CLAUDE_PROXY_URL);

// Set to true to use Claude AI, false for hardcoded explanations
const USE_AI = true;

// Water Treatment Correlation Explanations Database
const CORRELATION_EXPLANATIONS = {
  // pH related correlations
  ph: {
    turbidity:
      "pH and turbidity often correlate because coagulation effectiveness depends heavily on pH levels. Optimal pH ranges (typically 6.5-7.5) promote better floc formation, reducing turbidity. When pH deviates from optimal ranges, coagulation efficiency decreases, leading to higher turbidity values.",
    alkalinity:
      "pH and alkalinity show strong correlation as alkalinity acts as a buffer system. Higher alkalinity provides greater pH stability and resistance to pH changes. This relationship is fundamental to water chemistry and treatment process control.",
    conductivity:
      "pH and conductivity can correlate due to ionization effects. Changes in pH affect the degree of ionization of weak acids and bases in water, which can influence electrical conductivity measurements.",
    temperature:
      "pH and temperature correlation occurs because temperature affects chemical equilibrium and ionization constants. As temperature increases, the ionization of water and dissolved substances changes, affecting pH measurements.",
  },

  // Turbidity correlations
  turbidity: {
    suspended_solids:
      "Turbidity and suspended solids show strong positive correlation as both measure particle content in water. Turbidity is an optical measurement of water clarity, while suspended solids is a gravimetric measurement. Higher particle concentrations increase both parameters.",
    coagulant_dose:
      "Turbidity and coagulant dose typically show negative correlation when treatment is optimized. As coagulant dose increases (within optimal range), turbidity decreases due to improved particle removal through coagulation and flocculation processes.",
    filter_performance:
      "Turbidity correlation with filtration parameters reflects filter efficiency. Increasing turbidity in filtered water may indicate filter breakthrough, need for backwashing, or declining filter media effectiveness.",
  },

  // Chlorine residual correlations
  chlorine_residual: {
    chlorine_demand:
      "Chlorine residual and chlorine demand show inverse correlation. Higher chlorine demand (from organic matter, ammonia, or other oxidizable substances) consumes more chlorine, leaving lower residual concentrations for disinfection.",
    temperature:
      "Chlorine residual and temperature typically show negative correlation. Higher temperatures accelerate chlorine decay reactions, reducing residual chlorine concentrations over time.",
    ph: "Chlorine residual effectiveness correlates with pH because the ratio of hypochlorous acid to hypochlorite ion changes with pH. Lower pH favors more effective hypochlorous acid formation.",
    contact_time:
      "Chlorine residual and contact time correlation reflects the CT concept (concentration × time) crucial for disinfection. Longer contact times may show declining residuals due to natural decay processes.",
  },

  // Flow rate correlations
  flow_rate: {
    detention_time:
      "Flow rate and detention time show inverse correlation in treatment processes. Higher flow rates reduce detention time in treatment units, potentially affecting treatment efficiency and requiring process adjustments.",
    filter_headloss:
      "Flow rate and filter head loss typically show positive correlation. Higher flow rates through filters increase hydraulic resistance and head loss, potentially triggering more frequent backwash cycles.",
    mixing_intensity:
      "Flow rate correlations with mixing parameters affect coagulation and flocculation efficiency. Optimal mixing intensity must be maintained across varying flow conditions for consistent treatment performance.",
  },

  // Temperature correlations
  temperature: {
    viscosity:
      "Temperature and water viscosity show inverse correlation. Higher temperatures reduce water viscosity, affecting settling rates, filtration efficiency, and chemical mixing characteristics in treatment processes.",
    dissolved_oxygen:
      "Temperature and dissolved oxygen typically show negative correlation. Warmer water holds less dissolved oxygen, which can affect biological processes and oxidation reactions in treatment systems.",
    chemical_reaction_rates:
      "Temperature affects all chemical reaction rates in water treatment. Higher temperatures generally increase reaction rates for coagulation, oxidation, and disinfection processes.",
  },

  // Default explanations for common parameter types
  default: {
    strong_positive:
      "This strong positive correlation suggests these parameters are closely linked in your treatment process. They likely respond similarly to operational changes or influent water quality variations, indicating a direct process relationship.",
    moderate_positive:
      "This moderate positive correlation indicates these parameters tend to increase or decrease together, but other factors also influence their relationship. This suggests some shared process dependencies or similar responses to operational conditions.",
    weak_positive:
      "This weak positive correlation suggests a slight tendency for these parameters to move in the same direction, but the relationship is influenced by many other variables in your treatment system.",
    strong_negative:
      "This strong negative correlation indicates these parameters have an inverse relationship, where increases in one typically result in decreases in the other. This often reflects control mechanisms or competing process effects.",
    moderate_negative:
      "This moderate negative correlation shows these parameters tend to move in opposite directions, suggesting some process antagonism or control relationship, though other factors also play significant roles.",
    weak_negative:
      "This weak negative correlation indicates a slight inverse relationship between these parameters, but the connection is influenced by many other operational and water quality variables.",
  },
};

// Hardcoded Explanation Functions
async function explainCorrelation() {
  if (!currentTargetVariable || !currentPredictorVariable) {
    showNotification("No correlation selected for explanation", "warning");
    return;
  }

  showExplanationModal();
}

function showExplanationModal() {
  const modal = document.getElementById("explanationModal");
  const titleElement = document.getElementById("modalCorrelationTitle");
  const detailsElement = document.getElementById("modalCorrelationDetails");
  const loadingElement = document.getElementById("explanationLoading");
  const textElement = document.getElementById("explanationText");

  // Set correlation info
  titleElement.textContent = `${currentTargetVariable} vs ${currentPredictorVariable}`;

  const correlationStrength = Math.abs(currentCorrelationValue);
  let strengthDesc =
    correlationStrength > 0.7
      ? "Strong"
      : correlationStrength > 0.5
      ? "Moderate"
      : correlationStrength > 0.3
      ? "Weak"
      : "Very Weak";

  const direction = currentCorrelationValue > 0 ? "positive" : "negative";
  detailsElement.textContent = `${strengthDesc} ${direction} correlation (R = ${currentCorrelationValue.toFixed(
    3
  )})`;

  // Show modal and loading
  modal.style.display = "flex";
  loadingElement.style.display = "flex";
  textElement.innerHTML = "";

  // Get hardcoded explanation
  getHardcodedExplanation();
}

function closeExplanationModal() {
  const modal = document.getElementById("explanationModal");
  modal.style.display = "none";
}

async function getHardcodedExplanation() {
  const loadingElement = document.getElementById("explanationLoading");
  const textElement = document.getElementById("explanationText");

  if (USE_AI) {
    // Get selected AI provider
    const selectedProvider = document.querySelector('input[name="aiProvider"]:checked')?.value || 'claude';
    
    // Use selected AI provider via proxy server
    try {
      console.log(`Making ${selectedProvider.toUpperCase()} proxy request...`);

      const response = await fetch(CLAUDE_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetVariable: currentTargetVariable,
          predictorVariable: currentPredictorVariable,
          correlationValue: currentCorrelationValue,
          provider: selectedProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`${selectedProvider.toUpperCase()} proxy error:`, errorData);
        throw new Error(`${selectedProvider.toUpperCase()} API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log(`${selectedProvider.toUpperCase()} proxy response:`, data);

      if (data.success && data.explanation) {
        loadingElement.style.display = "none";
        
        // Format the explanation text with proper paragraph breaks
        const formattedExplanation = formatAIExplanation(data.explanation);
        
        const providerName = selectedProvider === 'claude' ? 'Claude AI' : 'OpenAI GPT-4';
        const providerIcon = selectedProvider === 'claude' ? '🤖' : '🧠';
        
        textElement.innerHTML = `
          ${formattedExplanation}
          <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px; padding: 0.75rem; margin-top: 1rem; font-size: 0.9rem;">
            <strong>${providerIcon} AI-Generated:</strong> Explanation provided by ${providerName}
          </div>
        `;
        return;
      } else {
        throw new Error("Invalid proxy response structure");
      }
    } catch (error) {
      console.error("Error with Claude proxy:", error);
      loadingElement.style.display = "none";

      let errorMessage = "AI service temporarily unavailable";
      if (error.message.includes("Failed to fetch")) {
        errorMessage = "Proxy server not running - start the proxy server first";
      } else if (error.message.includes("401")) {
        errorMessage = "Claude API authentication failed";
      } else if (error.message.includes("429")) {
        errorMessage = "Claude API rate limit exceeded - please try again later";
      } else if (error.message.includes("Proxy server error")) {
        errorMessage = error.message;
      }

      textElement.innerHTML = `
        <div style="color: #d32f2f; padding: 1rem; background: #ffebee; border-radius: 4px; margin-bottom: 1rem;">
          <strong>AI Error:</strong> ${errorMessage}
        </div>
        <p><strong>Fallback Explanation:</strong></p>
        <p>${findCorrelationExplanation(
          currentTargetVariable,
          currentPredictorVariable,
          currentCorrelationValue
        )}</p>
      `;
      return;
    }
  }

  // Use hardcoded explanations
  setTimeout(() => {
    loadingElement.style.display = "none";

    const explanation = findCorrelationExplanation(
      currentTargetVariable,
      currentPredictorVariable,
      currentCorrelationValue
    );
    textElement.innerHTML = `<p>${explanation}</p>`;
  }, 1500);
}

function formatAIExplanation(explanation) {
  // Split by double line breaks (paragraph separators)
  let paragraphs = explanation.split(/\n\s*\n/);
  
  // If no double line breaks, try splitting by single line breaks and group sentences
  if (paragraphs.length === 1) {
    // Split by periods followed by space and capital letter (sentence boundaries)
    const sentences = explanation.split(/\.\s+(?=[A-Z])/);
    
    // Group sentences into paragraphs (roughly 2-3 sentences per paragraph)
    paragraphs = [];
    for (let i = 0; i < sentences.length; i += 2) {
      let paragraph = sentences[i];
      if (i + 1 < sentences.length) {
        paragraph += '. ' + sentences[i + 1];
      }
      if (!paragraph.endsWith('.')) {
        paragraph += '.';
      }
      paragraphs.push(paragraph);
    }
  }
  
  // Clean up and format paragraphs
  const formattedParagraphs = paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => {
      // Ensure paragraph ends with period
      if (!p.endsWith('.') && !p.endsWith('!') && !p.endsWith('?')) {
        p += '.';
      }
      return `<p style="margin-bottom: 1rem; line-height: 1.6;">${p}</p>`;
    });
  
  return formattedParagraphs.join('');
}

function findCorrelationExplanation(var1, var2, correlationValue) {
  // Normalize variable names for lookup (lowercase, remove spaces/special chars)
  const normalizeVarName = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const norm1 = normalizeVarName(var1);
  const norm2 = normalizeVarName(var2);

  // Check for specific parameter combinations
  if (
    CORRELATION_EXPLANATIONS[norm1] &&
    CORRELATION_EXPLANATIONS[norm1][norm2]
  ) {
    return CORRELATION_EXPLANATIONS[norm1][norm2];
  }

  if (
    CORRELATION_EXPLANATIONS[norm2] &&
    CORRELATION_EXPLANATIONS[norm2][norm1]
  ) {
    return CORRELATION_EXPLANATIONS[norm2][norm1];
  }

  // Check for partial matches (contains keywords)
  for (const [key1, correlations] of Object.entries(CORRELATION_EXPLANATIONS)) {
    if (key1 === "default") continue;

    if (norm1.includes(key1) || norm2.includes(key1)) {
      for (const [key2, explanation] of Object.entries(correlations)) {
        if (norm1.includes(key2) || norm2.includes(key2)) {
          return explanation;
        }
      }
    }
  }

  // Fall back to generic explanations based on correlation strength and direction
  const absCorr = Math.abs(correlationValue);
  const direction = correlationValue > 0 ? "positive" : "negative";

  let strengthKey;
  if (absCorr > 0.7) {
    strengthKey = `strong_${direction}`;
  } else if (absCorr > 0.5) {
    strengthKey = `moderate_${direction}`;
  } else {
    strengthKey = `weak_${direction}`;
  }

  let explanation = CORRELATION_EXPLANATIONS.default[strengthKey];

  // Add specific context about the variables
  explanation += `\n\nIn this case, the relationship between ${var1} and ${var2} with a correlation of ${correlationValue.toFixed(
    3
  )} suggests operational or process connections that warrant further investigation. Consider how changes in one parameter might influence the other through direct process effects, shared environmental factors, or control system interactions.`;

  return explanation;
}

// Click outside modal to close
window.onclick = function (event) {
  const modal = document.getElementById("explanationModal");
  if (event.target === modal) {
    closeExplanationModal();
  }
};

// Make functions globally available
window.switchTab = switchTab;
window.updateCorrelationChart = updateCorrelationChart;
window.updateTimeSeriesChart = updateTimeSeriesChart;
window.updateDistributionChart = updateDistributionChart;
window.updateOptimizationChart = updateOptimizationChart;
window.selectCorrelationVariable = selectCorrelationVariable;
window.explainCorrelation = explainCorrelation;
window.closeExplanationModal = closeExplanationModal;
