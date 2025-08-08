let workbookData = {};
let currentChart = null;
let processedData = {};
let fileName = "";
let savedCharts = {};
let currentForecastMetrics = null;
let currentStatistics = null;
let selectedParametersForPdf = new Set([
  "mean volume",
  "mean diameter",
  "concentration",
  "particle",
]);

// Notification System
function showNotification(message, type = "info", duration = 5000) {
  const container = document.getElementById("notificationContainer");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Icon mapping
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="closeNotification(this)">×</button>
    `;

  container.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add("show"), 10);

  // Auto remove after duration
  setTimeout(() => {
    if (notification.parentNode) {
      closeNotification(notification.querySelector(".notification-close"));
    }
  }, duration);

  // Click to dismiss
  notification.addEventListener("click", (e) => {
    if (e.target !== notification.querySelector(".notification-close")) {
      closeNotification(notification.querySelector(".notification-close"));
    }
  });
}

function closeNotification(closeButton) {
  const notification = closeButton.parentNode;
  notification.classList.remove("show");
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

document.getElementById("fileInput").addEventListener("change", handleFile);

// Chart regeneration notification system
let chartsGenerated = false;
let regenerationNotificationShown = false;

function showRegenerationNotification() {
  if (chartsGenerated && !regenerationNotificationShown) {
    showNotification(
      "Chart settings changed. Click 'Generate Charts' to apply changes.",
      "warning",
      8000
    );
    regenerationNotificationShown = true;
    
    // Highlight the Generate Charts button
    const generateBtn = document.getElementById("generateChartsHeader");
    if (generateBtn) {
      generateBtn.style.animation = "pulse 2s infinite";
    }
  }
}

function clearRegenerationNotification() {
  regenerationNotificationShown = false;
  const generateBtn = document.getElementById("generateChartsHeader");
  if (generateBtn) {
    generateBtn.style.animation = "";
  }
}

// Add event listeners for chart configuration changes
document.addEventListener("DOMContentLoaded", function() {
  const chartConfigControls = [
    "chartType",
    "includeRPM", 
    "enableForecast",
    "polynomialOrder",
    "forecastStart",
    "forecastWindow"
  ];
  
  chartConfigControls.forEach(controlId => {
    const control = document.getElementById(controlId);
    if (control) {
      control.addEventListener("change", showRegenerationNotification);
    }
  });
});

// Global functions for modal control
window.openMetricsHelp = function () {
  const modal = document.getElementById("metricsHelpModal");
  modal.style.display = "flex";
  modal.scrollTop = 0;
};

window.closeMetricsHelp = function () {
  document.getElementById("metricsHelpModal").style.display = "none";
};

window.openStatsHelp = function () {
  const modal = document.getElementById("statsHelpModal");
  modal.style.display = "flex";
  modal.scrollTop = 0;
};

window.closeStatsHelp = function () {
  document.getElementById("statsHelpModal").style.display = "none";
};

// PDF Export Modal Functions
window.openPdfExportModal = function () {
  const modal = document.getElementById("pdfExportModal");
  modal.style.display = "flex";
  modal.scrollTop = 0;
  updateParameterCheckboxes();
};

window.closePdfExportModal = function () {
  document.getElementById("pdfExportModal").style.display = "none";
};

function updateParameterCheckboxes() {
  // Update checkboxes based on current selection
  document.getElementById("includeMeanVolume").checked =
    selectedParametersForPdf.has("Mean Volume");
  document.getElementById("includeMeanDiameter").checked =
    selectedParametersForPdf.has("Mean Diameter");
  document.getElementById("includeConcentration").checked =
    selectedParametersForPdf.has("Concentration");
  document.getElementById("includeParticleCount").checked =
    selectedParametersForPdf.has("Particle Count");

  // Add event listeners for parameter checkboxes
  const parameterCheckboxes = [
    "includeMeanVolume",
    "includeMeanDiameter",
    "includeConcentration",
    "includeParticleCount",
  ];
  parameterCheckboxes.forEach((id) => {
    const checkbox = document.getElementById(id);
    checkbox.onchange = function () {
      const parameterValue = this.value;
      if (this.checked) {
        selectedParametersForPdf.add(parameterValue);
      } else {
        selectedParametersForPdf.delete(parameterValue);
      }
    };
  });
}

// PDF Generation Function
window.generatePdfReport = function () {
  if (selectedParametersForPdf.size === 0) {
    showNotification(
      "Please select at least one parameter to include in the PDF report.",
      "warning"
    );
    return;
  }

  const reportTitle =
    document.getElementById("reportTitle").value ||
    "RoboJar Data Analysis Report";
  const includeStatistics =
    document.getElementById("includeStatistics").checked;


  // Close modal and generate PDF
  closePdfExportModal();

  setTimeout(async () => {
    await createStyledPdfReport(reportTitle, includeStatistics);
  }, 100);
};

async function createStyledPdfReport(reportTitle, includeStatistics) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("portrait", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let yPosition = margin;

  // Header section with branding
  function addHeader() {
    // Background header
    pdf.setFillColor(90, 122, 149); // #5A7A95
    pdf.rect(0, 0, pageWidth, 35, "F");

    // Title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("RoboJar Data Analyzer", margin, 15);

    // Report title
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "normal");
    pdf.text(reportTitle, margin, 25);

    // Generated timestamp
    pdf.setFontSize(10);
    const timestamp = new Date().toLocaleString();
    pdf.text(`Generated: ${timestamp}`, margin, 32);

    return 45; // Return Y position after header
  }

  yPosition = addHeader();

  // File information section
  if (fileName) {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Data Source", margin, yPosition);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    yPosition += 8;
    pdf.text(`File: ${fileName}`, margin + 5, yPosition);
    yPosition += 6;

    const parameterList = Array.from(selectedParametersForPdf).join(", ");
    pdf.text(`Selected Parameters: ${parameterList}`, margin + 5, yPosition);
    yPosition += 10;
  }

  // Add statistics table if requested
  if (includeStatistics && currentStatistics) {
    yPosition = addStatisticsTable(pdf, yPosition, margin, contentWidth);
  }

  // Add selected charts
  yPosition = await addSelectedCharts(pdf, yPosition, margin, contentWidth);

  // Save the PDF
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, "-");
  const filename = `RoboJar_Report_${timestamp}.pdf`;
  pdf.save(filename);

  showNotification(
    `PDF report "${filename}" generated successfully!`,
    "success"
  );
}

function addStatisticsTable(pdf, yPosition, margin, contentWidth) {
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Data Statistics", margin, yPosition);
  yPosition += 10;

  // Target columns for the PDF report - always show all 4
  const targetColumns = [
    "mean volume",
    "mean diameter",
    "concentration",
    "particle",
  ];

  // Find matching statistics entries for all target columns
  const relevantStats = [];
  targetColumns.forEach((targetColumn) => {
    Object.keys(currentStatistics).forEach((sheetName) => {
      const data = currentStatistics[sheetName];
      const sheetNameLower = sheetName.toLowerCase();

      // Check if this sheet matches the target column
      if (sheetNameLower.includes(targetColumn)) {
        relevantStats.push({
          name: data.legendLabel || sheetName,
          stats: data.stats,
          parameter: targetColumn,
        });
      }
    });
  });

  if (relevantStats.length === 0) {
    // If no targeted stats found, show all available statistics
    Object.keys(currentStatistics).forEach((sheetName) => {
      const data = currentStatistics[sheetName];
      if (data.stats) {
        relevantStats.push({
          name: data.legendLabel || sheetName,
          stats: data.stats,
          parameter: "general",
        });
      }
    });
  }

  if (relevantStats.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.text("No statistics available.", margin + 5, yPosition);
    return yPosition + 15;
  }

  // Table styling
  const tableStartY = yPosition;
  const rowHeight = 10;
  const colWidths = [40, 15, 15, 20, 20, 18, 18, 18];
  const headers = [
    "Parameter",
    "Count",
    "Min",
    "Max",
    "Mean",
    "Median",
    "Std Dev",
    "CV (%)",
  ];

  console.log(
    "Rendering statistics table with",
    relevantStats.length,
    "entries"
  );

  // Table header
  pdf.setFillColor(248, 249, 250); // Light gray background like HTML
  pdf.rect(margin, yPosition, contentWidth, rowHeight, "F");

  pdf.setTextColor(0, 0, 0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);

  let xPos = margin + 2;
  headers.forEach((header, i) => {
    pdf.text(header, xPos, yPosition + 6);
    xPos += colWidths[i];
  });

  yPosition += rowHeight;

  // Table rows
  pdf.setFont("helvetica", "normal");
  relevantStats.forEach((item, rowIndex) => {
    const stats = item.stats;
    if (!stats) return;

    // Alternate row colors
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(248, 249, 250);
      pdf.rect(margin, yPosition, contentWidth, rowHeight, "F");
    }

    const precision = getDecimalPrecision(item.parameter);
    const rowData = [
      item.name.substring(0, 20), // Truncate long names
      stats.count.toString(),
      formatStatistic(stats.min, item.parameter),
      formatStatistic(stats.max, item.parameter),
      formatStatistic(stats.mean, item.parameter),
      formatStatistic(stats.median, item.parameter),
      formatStatistic(stats.stdDev, item.parameter),
      stats.cv.toFixed(1),
    ];

    xPos = margin + 2;
    rowData.forEach((value, i) => {
      // Highlight Max and Mean columns (indices 3 and 4)
      if (i === 3 || i === 4) {
        pdf.setFillColor(255, 243, 205); // Yellow highlight like HTML
        pdf.rect(xPos - 1, yPosition, colWidths[i], rowHeight, "F");
      }

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8);
      pdf.text(value, xPos, yPosition + 6);
      xPos += colWidths[i];
    });

    yPosition += rowHeight;
  });

  // Table border
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(margin, tableStartY, contentWidth, yPosition - tableStartY);

  return yPosition + 15;
}

async function addSelectedCharts(pdf, yPosition, margin, contentWidth) {
  const selectedParameters = Array.from(selectedParametersForPdf);
  const chartsPerPage = 1; // 1 chart per page for better quality
  let chartCount = 0;

  for (let i = 0; i < selectedParameters.length; i++) {
    const parameter = selectedParameters[i];

    // Find matching columns in processed data for this parameter
    const matchingColumns = [];
    Object.keys(processedData).forEach((sheetName) => {
      const sheetData = processedData[sheetName];
      sheetData.headers.forEach((header) => {
        if (header.toLowerCase().includes(parameter)) {
          matchingColumns.push({
            parameter: parameter,
            column: header,
            sheetName: sheetName,
            title: `${header} Over Time - RoboJar`,
          });
        }
      });
    });

    // Generate charts for matching columns
    for (let j = 0; j < matchingColumns.length; j++) {
      const chartInfo = matchingColumns[j];

      // Add new page if needed (except for first chart)
      if (chartCount > 0) {
        pdf.addPage();
        yPosition = 20;
      }

      // Chart title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text(chartInfo.title, margin, yPosition);
      yPosition += 10;

      // Generate chart for this parameter
      try {
        const chartImageData = await generateChartForParameter(
          chartInfo.column
        );
        if (chartImageData) {
          const chartWidth = contentWidth;
          const chartHeight = chartWidth * 0.6; // Maintain aspect ratio

          pdf.addImage(
            chartImageData,
            "PNG",
            margin,
            yPosition,
            chartWidth,
            chartHeight
          );
          yPosition += chartHeight + 15;
        } else {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(10);
          pdf.text(
            `No data available for ${chartInfo.column}`,
            margin + 5,
            yPosition
          );
          yPosition += 20;
        }
      } catch (error) {
        console.error("Error generating chart for PDF:", error);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(10);
        pdf.text(
          `Error generating chart for ${chartInfo.column}`,
          margin + 5,
          yPosition
        );
        yPosition += 20;
      }

      chartCount++;
    }
  }

  return yPosition;
}

function getTotalChartCount() {
  let count = 0;
  selectedParametersForPdf.forEach((parameter) => {
    Object.keys(processedData).forEach((sheetName) => {
      const sheetData = processedData[sheetName];
      sheetData.headers.forEach((header) => {
        if (header.toLowerCase().includes(parameter)) {
          count++;
        }
      });
    });
  });
  return count;
}

// Function to generate chart for a specific parameter and return image data
async function generateChartForParameter(columnName) {
  if (!columnName || !processedData) return null;

  // Find the column data
  let chartData = null;
  let sheetName = null;

  Object.keys(processedData).forEach((sheet) => {
    const sheetData = processedData[sheet];
    const columnIndex = sheetData.headers.indexOf(columnName);
    if (columnIndex !== -1) {
      chartData = sheetData.data.map((row, index) => ({
        x: index * 5,
        y: parseFloat(row[columnIndex]) || 0,
      }));
      sheetName = sheet;
    }
  });

  if (!chartData || chartData.length === 0) return null;

  // Create a temporary canvas for chart generation
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 800;
  tempCanvas.height = 480;
  tempCanvas.style.display = "none";
  document.body.appendChild(tempCanvas);

  try {
    const ctx = tempCanvas.getContext("2d");

    // Create temporary chart
    const tempChart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: columnName,
            data: chartData,
            borderColor: "#5A7A95",
            backgroundColor: "#5A7A95" + "20",
            fill: false,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: true,
            position: "top",
          },
        },
        scales: {
          x: {
            type: "linear",
            title: {
              display: true,
              text: "Time (seconds)",
            },
          },
          y: {
            title: {
              display: true,
              text: columnName,
            },
          },
        },
      },
    });

    // Wait for chart to render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get image data
    const imageData = tempCanvas.toDataURL("image/png");

    // Clean up
    tempChart.destroy();
    document.body.removeChild(tempCanvas);

    return imageData;
  } catch (error) {
    console.error("Error generating chart:", error);
    document.body.removeChild(tempCanvas);
    return null;
  }
}

// Event listeners
document
  .getElementById("enableForecast")
  .addEventListener("change", function () {
    const polynomialGroup = document.getElementById("polynomialOrderGroup");
    const startGroup = document.getElementById("forecastStartGroup");
    const windowGroup = document.getElementById("forecastWindowGroup");
    const infoDiv = document.getElementById("forecastInfo");

    if (this.value !== "false") {
      polynomialGroup.style.display = "flex";
      startGroup.style.display = "flex";
      infoDiv.style.display = "block";

      if (this.value === "windowed") {
        windowGroup.style.display = "flex";
      } else {
        windowGroup.style.display = "none";
      }

      updateForecastInfo();
    } else {
      polynomialGroup.style.display = "none";
      startGroup.style.display = "none";
      windowGroup.style.display = "none";
      infoDiv.style.display = "none";
    }
  });

document.getElementById("timeWindow").addEventListener("change", function () {
  const customGroup = document.getElementById("customRangeGroup");
  if (this.value === "custom") {
    customGroup.style.display = "flex";
  } else {
    customGroup.style.display = "none";
  }

  // Statistics updated automatically in tabbed interface
});

document.getElementById("noiseFilter").addEventListener("change", function () {
  // Statistics updated automatically in tabbed interface
});

document.getElementById("startTime").addEventListener("change", function () {
  // Statistics updated automatically in tabbed interface
});

document.getElementById("endTime").addEventListener("change", function () {
  // Statistics updated automatically in tabbed interface
});

document
  .getElementById("forecastWindow")
  .addEventListener("change", updateForecastInfo);

document
  .getElementById("forecastStart")
  .addEventListener("change", updateForecastInfo);

// Column select removed - now handled by generateAllCharts()

function updateForecastInfo() {
  const method = document.getElementById("enableForecast").value;
  const window = document.getElementById("forecastWindow").value;
  const infoDiv = document.getElementById("forecastInfo");

  let info = "";
  switch (method) {
    case "adaptive":
      info =
        "🧠 Adaptive: Automatically detects trend changes and adjusts forecast window accordingly";
      break;
    case "windowed":
      const windowSize =
        window === "all"
          ? "all available"
          : `${window} (${window * 5} seconds)`;
      info = `🪟 Windowed: Uses last ${windowSize} data points for more stable predictions`;
      break;
    case "weighted":
      info =
        "⚖️ Weighted: Gives more importance to recent data points using exponential weighting";
      break;
    case "simple":
      info = "📊 Simple: Uses all available data (original behavior)";
      break;
  }
  infoDiv.textContent = info;
}

// Statistical Analysis Functions
function calculateAndDisplayStatistics(columnName) {
  if (!columnName || !processedData) return;

  currentStatistics = {};

  Object.keys(processedData).forEach((sheetName) => {
    const sheetData = processedData[sheetName];
    const columnIndex = sheetData.headers.indexOf(columnName);

    if (columnIndex !== -1) {
      let rawData = sheetData.data
        .map((row, index) => ({
          time: index * 5,
          value: parseFloat(row[columnIndex]) || 0,
        }))
        .filter((point) => !isNaN(point.value));

      const filteredData = applyTimeWindow(rawData);
      const processedResult = applyNoiseFilter(filteredData);
      const stats = calculateStatistics(
        processedResult.values,
        processedResult.filtered
      );

      currentStatistics[sheetName] = {
        ...sheetData.metadata,
        rawCount: rawData.length,
        filteredCount: processedResult.values.length,
        outlierCount: processedResult.outlierCount,
        stats: stats,
        noiseLevel: assessNoiseLevel(stats),
      };
    }
  });

  displayStatisticsTable();
}

function applyTimeWindow(data) {
  const timeWindow = document.getElementById("timeWindow").value;

  switch (timeWindow) {
    case "steady":
      return data.filter((point) => point.time >= 300);
    case "final":
      const maxTime = Math.max(...data.map((p) => p.time));
      const cutoff = Math.max(0, maxTime - 600);
      return data.filter((point) => point.time >= cutoff);
    case "custom":
      const startSec =
        parseInt(document.getElementById("startTime").value) || 0;
      const endSec =
        parseInt(document.getElementById("endTime").value) || Infinity;
      return data.filter(
        (point) => point.time >= startSec && point.time <= endSec
      );
    case "all":
    default:
      return data;
  }
}

function applyNoiseFilter(data) {
  const filter = document.getElementById("noiseFilter").value;
  let values = data.map((point) => point.value);
  let outlierCount = 0;

  switch (filter) {
    case "outlier":
      const outlierResult = removeOutliers(values);
      values = outlierResult.filtered;
      outlierCount = outlierResult.outlierCount;
      break;
    case "smooth":
      values = applySmoothingFilter(values);
      break;
    case "both":
      const outlierResult2 = removeOutliers(values);
      values = applySmoothingFilter(outlierResult2.filtered);
      outlierCount = outlierResult2.outlierCount;
      break;
    case "none":
    default:
      break;
  }

  return {
    values: values,
    filtered: filter !== "none",
    outlierCount: outlierCount,
  };
}

function removeOutliers(data) {
  if (data.length < 4)
    return {
      filtered: data,
      outlierCount: 0,
    };

  const sorted = [...data].sort((a, b) => a - b);
  const q1Index = Math.floor(data.length * 0.25);
  const q3Index = Math.floor(data.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered = data.filter(
    (value) => value >= lowerBound && value <= upperBound
  );
  const outlierCount = data.length - filtered.length;

  return {
    filtered,
    outlierCount,
  };
}

function applySmoothingFilter(data) {
  if (data.length < 5) return data;

  const smoothed = [];
  const window = 5;
  const halfWindow = Math.floor(window / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(data.length - 1, i + halfWindow);
      j++
    ) {
      sum += data[j];
      count++;
    }

    smoothed.push(sum / count);
  }

  return smoothed;
}

function calculateStatistics(values, isFiltered) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  const p10Index = Math.floor(values.length * 0.1);
  const p25Index = Math.floor(values.length * 0.25);
  const p75Index = Math.floor(values.length * 0.75);
  const p90Index = Math.floor(values.length * 0.9);

  const p10 = sorted[p10Index];
  const p25 = sorted[p25Index];
  const p75 = sorted[p75Index];
  const p90 = sorted[p90Index];
  const iqr = p75 - p25;
  const range = max - min;

  return {
    count: values.length,
    min,
    max,
    mean,
    median,
    stdDev,
    cv,
    range,
    p10,
    p25,
    p75,
    p90,
    iqr,
    isFiltered,
  };
}

function assessNoiseLevel(stats) {
  if (!stats) return "unknown";
  if (stats.cv < 15) return "low";
  if (stats.cv < 30) return "medium";
  return "high";
}

// Helper function to determine decimal precision for statistics based on column type
function getDecimalPrecision(columnName) {
  if (!columnName) return 2; // default precision

  // Check for mean volume columns (case insensitive)
  const columnLower = columnName.toLowerCase();
  if (columnLower.includes("mean") && columnLower.includes("volume")) {
    return 3; // At least 3 decimals for mean volume
  }

  return 2; // Default precision for other columns
}

// Helper function to format number with appropriate precision
function formatStatistic(value, columnName) {
  if (value === null || value === undefined || isNaN(value)) {
    return "N/A";
  }
  const precision = getDecimalPrecision(columnName);
  return value.toFixed(precision);
}

function displayStatisticsTable(containerId, statistics, columnName) {
  const container = document.getElementById(containerId || "statisticsTable");
  if (!statistics || Object.keys(statistics).length === 0) {
    container.innerHTML = "<p>No statistics available.</p>";
    return;
  }

  // Use the provided column name for formatting precision
  const selectedColumn = columnName || "default";

  let html = `
               <table class="stats-table">
                   <thead>
                       <tr>
                           <th>Run</th>
                           <th>Count</th>
                           <th>Min</th>
                           <th>Max</th>
                           <th>Mean</th>
                           <th>Median</th>
                           <th>Std Dev</th>
                           <th>CV (%)</th>
                           <th>P10</th>
                           <th>P90</th>
                           <th>IQR</th>ean
                           <th>Noise</th>
                       </tr>
                   </thead>
                   <tbody>
           `;

  Object.keys(statistics).forEach((sheetName) => {
    const data = statistics[sheetName];
    const stats = data.stats;

    if (stats) {
      const noiseClass = `noise-${data.noiseLevel}`;

      html += `
                       <tr>
                           <td title="${data.protocol}">
                               <strong>${data.legendLabel || sheetName}</strong>
                               ${
                                 data.filteredCount !== data.rawCount
                                   ? `<br><small>(${
                                       data.rawCount - data.filteredCount
                                     } filtered)</small>`
                                   : ""
                               }
                           </td>
                           <td>${stats.count}</td>
                           <td>${formatStatistic(
                             stats.min,
                             selectedColumn
                           )}</td>
                           <td class="stats-highlight">${formatStatistic(
                             stats.max,
                             selectedColumn
                           )}</td>
                           <td class="stats-highlight">${formatStatistic(
                             stats.mean,
                             selectedColumn
                           )}</td>
                           <td>${formatStatistic(
                             stats.median,
                             selectedColumn
                           )}</td>
                           <td>${formatStatistic(
                             stats.stdDev,
                             selectedColumn
                           )}</td>
                           <td>${stats.cv.toFixed(1)}</td>
                           <td>${formatStatistic(
                             stats.p10,
                             selectedColumn
                           )}</td>
                           <td>${formatStatistic(
                             stats.p90,
                             selectedColumn
                           )}</td>
                           <td>${formatStatistic(
                             stats.iqr,
                             selectedColumn
                           )}</td>
                           <td><span class="noise-indicator ${noiseClass}"></span>${
        data.noiseLevel
      }</td>
                       </tr>
                   `;
    }
  });

  html += `
                   </tbody>
               </table>
               <div class="stats-tip">
                   <div class="stats-tip-text">
                       <span class="stats-tip-icon">💡</span>Max and Mean values are typically used for reporting.
                   </div>
                   ${
                     document.getElementById("noiseFilter").value !== "none"
                       ? `<div class="stats-tip-filter">Data has been processed with ${
                           document.getElementById("noiseFilter").value
                         } filtering.</div>`
                       : ""
                   }
               </div>
           `;

  container.innerHTML = html;
}

// File handling and processing functions (keeping original functionality)
function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  fileName = file.name;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {
        type: "array",
      });

      workbookData = workbook;
      processWorkbook(workbook);
    } catch (error) {
      showNotification(`Error reading file: ${error.message}`, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function processWorkbook(workbook) {
  const sheetNames = workbook.SheetNames;
  processedData = {};

  let generatedDateTime = "Unknown";
  const fileNameMatch = fileName.match(
    /RoboJarReportExcel\s+(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
  );
  if (fileNameMatch) {
    const [, year, month, day, hour, minute, second] = fileNameMatch;
    generatedDateTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  sheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
    });

    if (jsonData.length > 3) {
      const rawProtocol = jsonData[1] ? jsonData[1][0] : "";
      const protocol = rawProtocol.toString().includes("|")
        ? rawProtocol.toString().split("|")[1].trim()
        : rawProtocol;

      const rawChemistry = jsonData[1] ? jsonData[1][1] : "";
      const chemistry = rawChemistry.toString().includes("|")
        ? rawChemistry.toString().split("|")[1].trim()
        : rawChemistry;

      const rawDosage = jsonData[1] ? jsonData[1][2] : "";
      const dosage = rawDosage.toString().includes("|")
        ? rawDosage.toString().split("|")[1].trim()
        : rawDosage;

      const rawComments = jsonData[1] ? jsonData[1][3] : "";
      const comments = rawComments.toString().includes("|")
        ? rawComments.toString().split("|")[1].trim()
        : rawComments;

      const a4Value = jsonData[3]
        ? (jsonData[3][0] || "").toString().trim()
        : "";
      const b4Value = jsonData[3]
        ? (jsonData[3][1] || "").toString().trim()
        : "";

      // Parse and reformat the run title to MM-DD-YYYY HH:MM
      let formattedDateTime = "";
      const combinedTitle = [a4Value, b4Value]
        .filter((v) => v !== "")
        .join(" ");

      if (combinedTitle) {
        try {
          // Remove MDT/MST/PST etc timezone abbreviations
          const cleanTitle = combinedTitle.replace(
            /\s+(MDT|MST|PST|PDT|EDT|EST|CDT|CST)\s*$/i,
            ""
          );

          // Try to parse various date/time formats
          let parsedDate = null;

          // Pattern 1: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
          const isoPattern =
            /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
          const isoMatch = cleanTitle.match(isoPattern);
          if (isoMatch) {
            const [, year, month, day, hour, minute] = isoMatch;
            formattedDateTime = `${month}-${day}-${year} ${hour.padStart(
              2,
              "0"
            )}:${minute}`;
          }

          // Pattern 2: MM/DD/YYYY HH:MM:SS or MM/DD/YYYY HH:MM
          if (!formattedDateTime) {
            const usPattern =
              /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
            const usMatch = cleanTitle.match(usPattern);
            if (usMatch) {
              const [, month, day, year, hour, minute] = usMatch;
              formattedDateTime = `${month.padStart(2, "0")}-${day.padStart(
                2,
                "0"
              )}-${year} ${hour.padStart(2, "0")}:${minute}`;
            }
          }

          // Pattern 3: MM-DD-YYYY HH:MM:SS or MM-DD-YYYY HH:MM
          if (!formattedDateTime) {
            const dashPattern =
              /(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/;
            const dashMatch = cleanTitle.match(dashPattern);
            if (dashMatch) {
              const [, month, day, year, hour, minute] = dashMatch;
              formattedDateTime = `${month.padStart(2, "0")}-${day.padStart(
                2,
                "0"
              )}-${year} ${hour.padStart(2, "0")}:${minute}`;
            }
          }

          // Pattern 4: Try JavaScript Date parsing as fallback
          if (!formattedDateTime) {
            const jsDate = new Date(cleanTitle);
            if (!isNaN(jsDate.getTime())) {
              const month = (jsDate.getMonth() + 1).toString().padStart(2, "0");
              const day = jsDate.getDate().toString().padStart(2, "0");
              const year = jsDate.getFullYear();
              const hour = jsDate.getHours().toString().padStart(2, "0");
              const minute = jsDate.getMinutes().toString().padStart(2, "0");
              formattedDateTime = `${month}-${day}-${year} ${hour}:${minute}`;
            }
          }

          // If all parsing fails, use original format
          if (!formattedDateTime) {
            formattedDateTime = combinedTitle;
          }
        } catch (error) {
          // Fallback to original format if any error occurs
          formattedDateTime = combinedTitle;
        }
      }

      const sheetTitle =
        formattedDateTime ||
        [a4Value, b4Value].filter((v) => v !== "").join(" ");

      const headers = jsonData[2] || [];
      const dataRows = jsonData.slice(3);

      let chemistryDetails = "";
      let legendLabel = "";
      if (chemistry && dosage) {
        const chemTypes = chemistry.toString().split("/");
        const dosageValues = dosage.toString().split("/");

        chemistryDetails = chemTypes
          .map((chem, idx) => {
            const dose = dosageValues[idx] || "0";
            let unit = "mg/L";
            if (chem.toLowerCase().includes("reclaim")) {
              unit = "%";
            }
            return `${chem.trim()}: ${dose} ${unit}`;
          })
          .join(", ");

        legendLabel = chemTypes
          .map((chem, idx) => {
            const dose = dosageValues[idx] || "0";
            return `${chem.trim()} ${dose}`;
          })
          .join("/");
      }

      processedData[sheetName] = {
        metadata: {
          generatedDateTime: generatedDateTime,
          runDateTime: formattedDateTime,
          protocol: protocol,
          chemistry: chemistry,
          dosage: dosage,
          chemistryDetails: chemistryDetails,
          legendLabel: legendLabel,
          comments: comments,
          sheetTitle: sheetTitle || sheetName,
        },
        headers: headers.filter((h) => h && h.toString().trim() !== ""),
        data: dataRows,
        rowCount: dataRows.length,
      };
    }
  });

  updateUI();

  // Show success notification for file upload
  showNotification("File loaded successfully!", "success");
  
  // Show warning to generate charts
  showNotification("Click 'Generate Charts' to create visualizations!", "warning", 6000);
  
  // Make Generate Charts button pulse to indicate action needed
  const generateBtn = document.getElementById("generateChartsHeader");
  if (generateBtn) {
    generateBtn.style.animation = "pulse 2s infinite";
  }
}

function updateUI() {
  // Show sections progressively for better UX flow
  document.getElementById("infoPanel").style.display = "block";
  document.getElementById("basicConfig").style.display = "block";

  // Column selection removed - all charts generated automatically
  displaySheetInfo();

  // Update header actions to enable generate button
  updateHeaderActions();
}

function formatCommentsForDisplay(comments) {
  if (!comments || comments === "None") {
    return "None";
  }
  
  // Split on pattern: find metrics like "Sample Time: 07:45" followed by space and next metric
  // Look for: word(s) (possibly with parentheses): value, then space before next word(s):
  const formatted = comments.replace(/(\w[\w\s()]*:\s*[^\s]+(?:\.\d+)?)\s+(?=\w[\w\s()]*:)/g, '$1<br>');
  
  return formatted;
}

function displaySheetInfo() {
  const sheetInfo = document.getElementById("sheetInfo");

  // Create table structure wrapped in a card
  let tableHTML = `
    <div class="statistics-card">
      <h3>📋 Imported Run Summary</h3>
      <table class="stats-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Chemistry</th>
            <th>Dosage</th>
            <th>Data Points</th>
            <th>Duration</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(processedData).forEach((sheetName) => {
    const sheetData = processedData[sheetName];
    const metadata = sheetData.metadata;
    const durationMinutes = Math.round((sheetData.rowCount * 5) / 60);

    tableHTML += `
      <tr>
        <td><strong>${metadata.sheetTitle}</strong></td>
        <td>${metadata.chemistry || "N/A"}</td>
        <td>${metadata.dosage || "N/A"}</td>
        <td>${sheetData.rowCount}</td>
        <td>${durationMinutes} min</td>
        <td>${formatCommentsForDisplay(metadata.comments)}</td>
      </tr>
    `;
  });

  tableHTML += `
        </tbody>
      </table>
    </div>
  `;

  sheetInfo.innerHTML = tableHTML;
}

// Chart generation and remaining original functions
// Old generateChart function removed - replaced with generateAllCharts()

// Helper function for ordinal suffixes
function getOrdinalSuffix(num) {
  const suffixes = {
    1: "st",
    2: "nd",
    3: "rd",
  };
  return suffixes[num] || "th";
}

function createCustomLegend(datasets, includeRPM) {
  const legendContainer = document.getElementById("customLegend");
  legendContainer.innerHTML = "";

  const runMap = new Map();

  datasets.forEach((dataset, index) => {
    const isRPM = dataset.label.includes("- RPM");
    const isForecast = dataset.label.includes("- Forecast");
    let runName = dataset.label;

    if (isRPM) {
      runName = dataset.label.replace(" - RPM", "");
    } else if (isForecast) {
      runName = dataset.label.replace(" - Forecast", "");
    }

    if (!runMap.has(runName)) {
      runMap.set(runName, {
        main: null,
        rpm: null,
        forecast: null,
      });
    }

    const entry = {
      dataset,
      index,
    };

    if (isRPM) {
      runMap.get(runName).rpm = entry;
    } else if (isForecast) {
      runMap.get(runName).forecast = entry;
    } else {
      runMap.get(runName).main = entry;
    }
  });

  const runs = Array.from(runMap.values());

  runs.forEach((pair) => {
    if (pair.main) {
      const item = createLegendItem(
        pair.main.dataset,
        pair.main.index,
        false,
        false
      );
      legendContainer.appendChild(item);
    }
  });

  if (includeRPM) {
    runs.forEach((pair) => {
      if (pair.rpm) {
        const item = createLegendItem(
          pair.rpm.dataset,
          pair.rpm.index,
          true,
          false
        );
        legendContainer.appendChild(item);
      } else {
        const emptyCell = document.createElement("div");
        legendContainer.appendChild(emptyCell);
      }
    });
  }

  const hasForecast = runs.some((pair) => pair.forecast);
  if (hasForecast) {
    runs.forEach((pair) => {
      if (pair.forecast) {
        const item = createLegendItem(
          pair.forecast.dataset,
          pair.forecast.index,
          false,
          true
        );
        legendContainer.appendChild(item);
      } else {
        const emptyCell = document.createElement("div");
        legendContainer.appendChild(emptyCell);
      }
    });
  }
}

function createLegendItem(dataset, datasetIndex, isRPM, isForecast, chartInstance) {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.dataset.datasetIndex = datasetIndex;

  const marker = document.createElement("div");
  marker.className = "legend-marker";

  if (isRPM) {
    marker.style.borderColor = dataset.borderColor;
    marker.style.backgroundColor = dataset.borderColor;
  } else if (isForecast) {
    marker.style.borderColor = dataset.borderColor;
    marker.style.backgroundColor = "transparent";
    marker.style.borderStyle = "dashed";
  } else {
    marker.style.borderColor = dataset.borderColor;
    marker.style.backgroundColor = dataset.borderColor;
  }

  const text = document.createElement("span");
  text.className = "legend-text";
  text.textContent = dataset.label;

  item.appendChild(marker);
  item.appendChild(text);

  item.addEventListener("click", function () {
    const index = parseInt(this.dataset.datasetIndex);
    const targetChart = chartInstance || currentChart;
    if (targetChart) {
      const meta = targetChart.getDatasetMeta(index);
      meta.hidden = !meta.hidden;
      this.classList.toggle("hidden");
      targetChart.update();
    }
  });

  return item;
}

function exportChart(format) {
  if (!currentChart) {
    showNotification("Please generate a chart first.", "warning");
    return;
  }

  if (format === "png") {
    exportPNG();
  } else if (format === "pdf") {
    openPdfExportModal();
  }
}

function exportPNG() {
  // Get the currently active tab
  const activeTab = document.querySelector(".tab-content.active");
  const activeTabId = activeTab ? activeTab.id : "mean-diameter-tab";
  const selectedColumn = activeTabId.replace("-tab", "").replace("-", " ");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");

  tempCanvas.width = 1200;
  tempCanvas.height = 650;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  ctx.fillStyle = "#333";
  ctx.font = "bold 24px Segoe UI";
  ctx.textAlign = "center";
  const title = `${selectedColumn} Over Time - RoboJar`;
  ctx.fillText(title, tempCanvas.width / 2, 40);

  const canvasId = activeTabId.replace("-tab", "Chart");
  const chartCanvas = document.getElementById(canvasId);
  const chartAspectRatio = chartCanvas.width / chartCanvas.height;
  const chartWidth = tempCanvas.width - 100;
  const chartHeight = Math.min(chartWidth / chartAspectRatio, 450);

  ctx.drawImage(chartCanvas, 50, 160, chartWidth, chartHeight);

  const link = document.createElement("a");
  link.download = `RoboJar_${selectedColumn}_${timestamp}.png`;
  link.href = tempCanvas.toDataURL("image/png");
  link.click();

  // Show success notification for export
  showNotification("Chart exported as PNG successfully!", "success");
}

// Simplified forecast metrics display (placeholder)
function displayForecastMetrics(metrics) {
  // This would display the forecast quality metrics
  console.log("Forecast metrics would be displayed here:", metrics);
}

// Add these forecast functions to your JavaScript section:

// Main forecast function that routes to different methods
function generateForecast(data, order, startTime, endTime, method) {
  let result;
  switch (method) {
    case "adaptive":
      result = adaptivePolynomialForecast(data, order, startTime, endTime);
      break;
    case "windowed":
      result = windowedPolynomialForecast(data, order, startTime, endTime);
      break;
    case "weighted":
      result = weightedPolynomialForecast(data, order, startTime, endTime);
      break;
    case "simple":
    default:
      result = generatePolynomialForecast(data, order, startTime, endTime);
      break;
  }

  // Calculate quality metrics
  const metrics = calculateForecastMetrics(
    data,
    result.coefficients,
    result.trainingData || data
  );

  return {
    data: result.data || result,
    coefficients: result.coefficients,
    metrics: metrics,
    trainingData: result.trainingData || data,
  };
}

// Original simple polynomial forecast (uses all data)
function generatePolynomialForecast(data, order, startTime, endTime) {
  const coefficients = polynomialRegression(data, order);

  const forecast = [];
  for (let x = startTime; x <= endTime; x += 5) {
    const y = evaluatePolynomial(coefficients, x);
    const clampedY = Math.max(0, y);

    forecast.push({
      x: x,
      y: clampedY,
    });

    // Stop forecasting if we hit zero and the trend is downward
    if (clampedY === 0 && y <= 0) {
      break;
    }
  }

  return {
    data: forecast,
    coefficients: coefficients,
    trainingData: data,
  };
}

// Windowed polynomial forecast
function windowedPolynomialForecast(data, order, startTime, endTime) {
  const forecastWindow = document.getElementById("forecastWindow").value;

  let forecastData;
  if (forecastWindow === "all") {
    forecastData = data;
  } else {
    const windowSize = parseInt(forecastWindow);
    forecastData = data.slice(-windowSize);
  }

  const coefficients = polynomialRegression(forecastData, order);

  const forecast = [];
  for (let x = startTime; x <= endTime; x += 5) {
    const y = evaluatePolynomial(coefficients, x);
    const clampedY = Math.max(0, y);

    forecast.push({
      x: x,
      y: clampedY,
    });

    if (clampedY === 0 && y <= 0) {
      break;
    }
  }

  return {
    data: forecast,
    coefficients: coefficients,
    trainingData: forecastData,
  };
}

// Weighted polynomial forecast
function weightedPolynomialForecast(data, order, startTime, endTime) {
  const coefficients = weightedPolynomialRegression(data, order);

  const forecast = [];
  for (let x = startTime; x <= endTime; x += 5) {
    const y = evaluatePolynomial(coefficients, x);
    const clampedY = Math.max(0, y);

    forecast.push({
      x: x,
      y: clampedY,
    });

    if (clampedY === 0 && y <= 0) {
      break;
    }
  }

  return {
    data: forecast,
    coefficients: coefficients,
    trainingData: data,
  };
}

// Adaptive polynomial forecast
function adaptivePolynomialForecast(data, order, startTime, endTime) {
  const hasTrendChange = detectTrendChange(data);

  let forecastData;
  if (hasTrendChange) {
    forecastData = data.slice(-100); // Last 100 points
  } else {
    forecastData = data.slice(-200); // Last 200 points
  }

  const coefficients = polynomialRegression(forecastData, order);

  const forecast = [];
  for (let x = startTime; x <= endTime; x += 5) {
    const y = evaluatePolynomial(coefficients, x);
    const clampedY = Math.max(0, y);

    forecast.push({
      x: x,
      y: clampedY,
    });

    if (clampedY === 0 && y <= 0) {
      break;
    }
  }

  return {
    data: forecast,
    coefficients: coefficients,
    trainingData: forecastData,
  };
}

// Trend change detection
function detectTrendChange(data, windowSize = 50) {
  if (data.length < windowSize * 2) return false;

  const recent = data.slice(-windowSize);
  const previous = data.slice(-windowSize * 2, -windowSize);

  const recentSlope = calculateSlope(recent);
  const previousSlope = calculateSlope(previous);

  if (Math.abs(previousSlope) < 0.001) return false;
  const slopeChange =
    Math.abs(recentSlope - previousSlope) / Math.abs(previousSlope);

  return slopeChange > 0.5;
}

function calculateSlope(data) {
  if (data.length < 2) return 0;

  const n = data.length;
  const sumX = data.reduce((sum, point) => sum + point.x, 0);
  const sumY = data.reduce((sum, point) => sum + point.y, 0);
  const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = data.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 0.001) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

// Weighted polynomial regression
function weightedPolynomialRegression(data, order) {
  const n = data.length;
  const weights = data.map((_, index) => Math.exp(index / n));
  const x = data.map((point) => point.x);
  const y = data.map((point) => point.y);

  const A = [];
  const b = [];

  for (let i = 0; i <= order; i++) {
    const row = [];
    let rhs = 0;

    for (let j = 0; j <= order; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += weights[k] * Math.pow(x[k], i + j);
      }
      row.push(sum);
    }

    for (let k = 0; k < n; k++) {
      rhs += weights[k] * Math.pow(x[k], i) * y[k];
    }

    A.push(row);
    b.push(rhs);
  }

  return gaussianElimination(A, b);
}

// Mathematical helper functions
function evaluatePolynomial(coefficients, x) {
  let result = 0;
  for (let i = 0; i < coefficients.length; i++) {
    result += coefficients[i] * Math.pow(x, i);
  }
  return result;
}

function transpose(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = [];

  for (let j = 0; j < cols; j++) {
    const row = [];
    for (let i = 0; i < rows; i++) {
      row.push(matrix[i][j]);
    }
    result.push(row);
  }
  return result;
}

function matrixMultiply(A, B) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result = [];

  for (let i = 0; i < rowsA; i++) {
    const row = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      row.push(sum);
    }
    result.push(row);
  }
  return result;
}

function matrixVectorMultiply(matrix, vector) {
  const result = [];
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    for (let j = 0; j < vector.length; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result.push(sum);
  }
  return result;
}

function polynomialRegression(data, order) {
  const x = data.map((point) => point.x);
  const y = data.map((point) => point.y);
  const n = data.length;

  const A = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j <= order; j++) {
      row.push(Math.pow(x[i], j));
    }
    A.push(row);
  }

  const AT = transpose(A);
  const ATA = matrixMultiply(AT, A);
  const ATy = matrixVectorMultiply(AT, y);

  return gaussianElimination(ATA, ATy);
}

function gaussianElimination(A, b) {
  const n = A.length;

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }

    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i];
    for (let j = i + 1; j < n; j++) {
      x[i] -= A[i][j] * x[j];
    }
    x[i] /= A[i][i];
  }

  return x;
}

// Calculate forecast quality metrics
function calculateForecastMetrics(originalData, coefficients, trainingData) {
  const actualValues = trainingData.map((point) => point.y);
  const predictedValues = trainingData.map((point) =>
    evaluatePolynomial(coefficients, point.x)
  );

  const actualMean =
    actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length;

  const totalSumSquares = actualValues.reduce(
    (sum, val) => sum + Math.pow(val - actualMean, 2),
    0
  );
  const residualSumSquares = actualValues.reduce(
    (sum, val, i) => sum + Math.pow(val - predictedValues[i], 2),
    0
  );

  const rSquared = 1 - residualSumSquares / totalSumSquares;
  const rmse = Math.sqrt(residualSumSquares / actualValues.length);
  const mae =
    actualValues.reduce(
      (sum, val, i) => sum + Math.abs(val - predictedValues[i]),
      0
    ) / actualValues.length;

  const mape =
    (actualValues.reduce((sum, val, i) => {
      if (val !== 0) {
        return sum + Math.abs((val - predictedValues[i]) / val);
      }
      return sum;
    }, 0) /
      actualValues.length) *
    100;

  const dataRange = Math.max(...actualValues) - Math.min(...actualValues);
  const normalizedRMSE = (rmse / dataRange) * 100;

  return {
    rSquared: rSquared,
    rmse: rmse,
    mae: mae,
    mape: mape,
    normalizedRMSE: normalizedRMSE,
    dataPoints: trainingData.length,
    dataRange: dataRange,
    actualMean: actualMean,
  };
}

// Simplified forecast metrics display
function displayForecastMetrics(metrics) {
  const metricsGrid = document.getElementById("metricsGrid");
  const metricsSummary = document.getElementById("metricsSummary");

  if (!metricsGrid || !metricsSummary) return;

  metricsGrid.innerHTML = "";

  const metricItems = [
    {
      value: metrics.rSquared.toFixed(3),
      label: "R² (Goodness of Fit)",
      quality:
        metrics.rSquared >= 0.9
          ? "good"
          : metrics.rSquared >= 0.7
          ? "ok"
          : "poor",
    },
    {
      value: metrics.rmse.toFixed(2),
      label: "RMSE",
      quality: "good",
    },
    {
      value: metrics.mae.toFixed(2),
      label: "MAE",
      quality: "good",
    },
    {
      value: metrics.mape.toFixed(1) + "%",
      label: "MAPE",
      quality: metrics.mape <= 10 ? "good" : metrics.mape <= 25 ? "ok" : "poor",
    },
    {
      value: metrics.normalizedRMSE.toFixed(1) + "%",
      label: "Normalized RMSE",
      quality:
        metrics.normalizedRMSE <= 5
          ? "good"
          : metrics.normalizedRMSE <= 15
          ? "ok"
          : "poor",
    },
    {
      value: metrics.dataPoints.toString(),
      label: "Training Points",
      quality: "good",
    },
  ];

  metricItems.forEach((item) => {
    const metricDiv = document.createElement("div");
    metricDiv.className = `metric-item metric-${item.quality}`;
    metricDiv.innerHTML = `
            <div class="metric-value">${item.value}</div>
            <div class="metric-label">${item.label}</div>
        `;
    metricsGrid.appendChild(metricDiv);
  });

  const overallQuality =
    metrics.rSquared >= 0.9 && metrics.mape <= 10
      ? "excellent"
      : metrics.rSquared >= 0.7 && metrics.mape <= 25
      ? "good"
      : "fair";

  metricsSummary.innerHTML = `
        <strong>Forecast Quality Assessment:</strong> 
        <span class="quality-indicator quality-${overallQuality}">${
    overallQuality.charAt(0).toUpperCase() + overallQuality.slice(1)
  }</span>
    `;
}

function updateHeaderActions() {
  const hasPng = currentChart !== null;
  const hasData = Object.keys(processedData).length > 0;

  // Update header buttons
  const generateBtn = document.getElementById("generateChartsHeader");
  const pdfBtn = document.getElementById("exportPdfHeader");

  if (generateBtn) {
    generateBtn.disabled = !hasData;
  }
  if (pdfBtn) {
    pdfBtn.disabled = !hasPng;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  updateHeaderActions();
});

// Load test file function
async function loadTestFile() {
  try {

    // Fetch the test Excel file from data folder
    const response = await fetch(
      "../../data/RoboJarReportExcel 2025-07-25-10-09-36.xls"
    );
    if (!response.ok) {
      throw new Error("Test file not found in data folder");
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    // Store filename for reference
    fileName = "RoboJarReport.xlsx (Test File)";

    // Process the workbook
    processWorkbook(workbook);
  } catch (error) {
    console.error("Error loading test file:", error);
    showNotification(
      "Failed to load test file. Make sure RoboJarReport.xlsx exists in the data folder.",
      "error"
    );
  }
}

// New functions for tabbed interface

// Generate all charts simultaneously
async function generateAllCharts() {
  // Disable button during generation
  const generateButton = document.getElementById("generateChartsHeader");
  if (generateButton) {
    generateButton.disabled = true;
    generateButton.innerHTML = "<span>⏳</span><span>Generating...</span>";
  }

  try {
    const chartType = document.getElementById("chartType").value;
    const includeRPM = document.getElementById("includeRPM").value === "true";
    const forecastMethod = document.getElementById("enableForecast").value;
    const polynomialOrder = parseInt(
      document.getElementById("polynomialOrder").value
    );

    // Define the 4 main parameters to chart
    const parameters = [
      { name: "mean diameter", id: "meanDiameter", icon: "📏" },
      { name: "mean volume", id: "meanVolume", icon: "🔢" },
      { name: "particle count", id: "particleCount", icon: "🔴" },
      { name: "concentration", id: "concentration", icon: "💧" },
    ];

    // Find available columns that match our parameters
    const availableParams = parameters.filter((param) => {
      return Object.keys(processedData).some((sheetName) => {
        const sheetData = processedData[sheetName];
        return (
          sheetData.headers &&
          sheetData.headers.some((header) =>
            header.toLowerCase().includes(param.name.toLowerCase())
          )
        );
      });
    });

    if (availableParams.length === 0) {
      showNotification(
        "No compatible data columns found for charting.",
        "warning"
      );
      return;
    }


    // Generate chart for each parameter with small delays to prevent crashes
    for (let i = 0; i < availableParams.length; i++) {
      const param = availableParams[i];

      // Find the actual column name in the data
      let columnName = null;

      // Search through all sheets and headers to find matching column
      Object.keys(processedData).forEach((sheetName) => {
        const sheetData = processedData[sheetName];
        if (sheetData.headers) {
          const foundHeader = sheetData.headers.find((header) =>
            header.toLowerCase().includes(param.name.toLowerCase())
          );
          if (foundHeader && !columnName) {
            columnName = foundHeader;
          }
        }
      });

      if (columnName) {
        await generateChartForParameter(
          columnName,
          param.id,
          chartType,
          includeRPM,
          forecastMethod,
          polynomialOrder
        );

        // Add small delay between charts to prevent browser overload
        if (i < availableParams.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    // Show the tabbed container
    document.getElementById("tabbedChartsContainer").style.display = "block";

    // Update header actions
    updateHeaderActions();

    // Re-enable button
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.innerHTML = "<span>📊</span><span>Generate Charts</span>";
    }

    // Mark charts as generated and clear regeneration notification
    chartsGenerated = true;
    clearRegenerationNotification();
    
    showNotification("All charts generated successfully!", "success");
  } catch (error) {
    console.error("Error generating charts:", error);

    // Re-enable button even on error
    generateButton.disabled = false;
    generateButton.innerHTML =
      "<span>📊</span><span>Generate All Charts</span>";

    showNotification("Error generating charts. Please try again.", "error");
  }
}

// Modified generateChartForParameter to work with tabs
async function generateChartForParameter(
  columnName,
  parameterId,
  chartType,
  includeRPM,
  forecastMethod,
  polynomialOrder
) {
  const enableForecast = forecastMethod !== "false";
  const forecastStartTime = enableForecast
    ? parseInt(document.getElementById("forecastStart").value)
    : 1200;

  const datasets = [];
  
  // Enhanced color system with groups based on Alum dose (15-25 range)
  const colorGroups = {
    'alum15': ['#0d4f8c', '#1560bd', '#2471cd', '#3482dd', '#4493ed'], // Deep blues
    'alum16': ['#1565c0', '#1976d2', '#1e88e5', '#2196f3', '#42a5f5'], // Blue variants
    'alum17': ['#00695c', '#00796b', '#00897b', '#009688', '#26a69a'], // Teals
    'alum18': ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a'], // Greens
    'alum19': ['#558b2f', '#689f38', '#7cb342', '#8bc34a', '#9ccc65'], // Light greens
    'alum20': ['#827717', '#9e9d24', '#afb42b', '#cddc39', '#d4e157'], // Yellow-greens
    'alum21': ['#b7950b', '#d4ac0d', '#f1c40f', '#f4d03f', '#f7dc6f'], // Yellows
    'alum22': ['#e65100', '#f57c00', '#ff9800', '#ffb74d', '#ffcc02'], // Oranges
    'alum23': ['#d84315', '#e64a19', '#ff5722', '#ff7043', '#ff8a65'], // Red-oranges
    'alum24': ['#c62828', '#d32f2f', '#f44336', '#e57373', '#ef5350'], // Reds
    'alum25': ['#ad1457', '#c2185b', '#e91e63', '#f06292', '#f48fb1'], // Pinks
    'default': ['#5a7a95', '#7fb3b3', '#c9a96e', '#8b7fb3', '#95b3a9'] // Original colors
  };
  
  // Function to get color group based on chemistry
  function getColorGroup(chemistry) {
    if (!chemistry) return 'default';
    
    const chemString = chemistry.toLowerCase();
    // Match patterns like "alum 15", "alum 16.5", etc.
    const alumMatch = chemString.match(/alum\s*(\d+(?:\.\d+)?)/);
    if (alumMatch) {
      const dose = Math.round(parseFloat(alumMatch[1])); // Round to nearest whole number
      const groupKey = `alum${dose}`;
      if (colorGroups[groupKey]) {
        return groupKey;
      }
    }
    
    return 'default';
  }
  
  const colors = ["#5a7a95", "#7fb3b3", "#c9a96e", "#8b7fb3"]; // Fallback colors

  // Create separate series for each sheet
  const sheetSeries = [];

  Object.keys(processedData).forEach((sheet, sheetIndex) => {
    const sheetData = processedData[sheet];
    const columnIndex = sheetData.headers.indexOf(columnName);
    if (columnIndex !== -1) {
      // Extract time and value data for this sheet (each starts at 0)
      let sheetColumnData = sheetData.data.map((row, index) => {
        const timeInSeconds = index * 5;
        return [timeInSeconds, row[columnIndex]];
      });

      // Optimize data for performance per sheet - be more aggressive
      if (sheetColumnData.length > 300) {
        const step = Math.ceil(sheetColumnData.length / 250);
        sheetColumnData = sheetColumnData.filter(
          (_, index) => index % step === 0
        );
        console.log(
          `Downsampled sheet ${sheet} from ${sheetData.data.length} to ${sheetColumnData.length} points`
        );
      }

      // Get metadata for better legend labels
      const metadata = sheetData.metadata || {};

      // Create a timestamp for the legend from the run data (mm/dd hh:mm format)
      let timestamp = "";
      if (metadata.sheetTitle) {
        // Parse various formats from sheetTitle and convert to mm/dd hh:mm
        const runDateTime = metadata.sheetTitle;
        
        // Try to extract date/time parts from different formats
        let month, day, hour, minute;
        
        // Pattern: MM-DD-YYYY HH:MM or MM/DD/YYYY HH:MM
        const usPattern = /(\d{1,2})[-\/](\d{1,2})[-\/]\d{4}\s+(\d{1,2}):(\d{2})/;
        const usMatch = runDateTime.match(usPattern);
        if (usMatch) {
          [, month, day, hour, minute] = usMatch;
          timestamp = `${month.padStart(2, '0')}/${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
        }
        
        // Pattern: YYYY-MM-DD HH:MM (ISO format)
        if (!timestamp) {
          const isoPattern = /\d{4}-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/;
          const isoMatch = runDateTime.match(isoPattern);
          if (isoMatch) {
            [, month, day, hour, minute] = isoMatch;
            timestamp = `${month.padStart(2, '0')}/${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
          }
        }
        
        // Fallback: try to parse as Date object
        if (!timestamp) {
          try {
            const dateObj = new Date(runDateTime);
            if (!isNaN(dateObj.getTime())) {
              const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
              const day = dateObj.getDate().toString().padStart(2, '0');
              const hour = dateObj.getHours().toString().padStart(2, '0');
              const minute = dateObj.getMinutes().toString().padStart(2, '0');
              timestamp = `${month}/${day} ${hour}:${minute}`;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      // Build legend label with timestamp prefix
      let baseLegendLabel =
        metadata.legendLabel ||
        `${metadata.chemistry || "Unknown"}/${metadata.dosage || "0"}/${
          metadata.chemistryDetails || "0"
        }` ||
        sheet;

      const legendLabel = timestamp 
        ? `${timestamp} - ${baseLegendLabel}`
        : baseLegendLabel;

      // Determine color group and index within that group
      const colorGroup = getColorGroup(metadata.chemistry);
      const groupColors = colorGroups[colorGroup];
      
      // Count how many runs we've seen for this color group to assign variations
      const groupCount = sheetSeries.filter(s => getColorGroup(s.metadata.chemistry) === colorGroup).length;
      const colorIndex = groupCount % groupColors.length;

      sheetSeries.push({
        sheetName: sheet,
        data: sheetColumnData,
        colorIndex: sheetIndex % colors.length, // Keep fallback
        colorGroup: colorGroup,
        groupColorIndex: colorIndex,
        legendLabel: legendLabel,
        metadata: metadata,
      });
    }
  });

  if (sheetSeries.length === 0) {
    showNotification(`No data found for ${columnName}`, "warning");
    return;
  }

  console.log(`Found ${sheetSeries.length} sheets with ${columnName} data`);

  // Add each sheet as a separate series (show full data or filtered if forecasting)
  sheetSeries.forEach((series, index) => {
    let displayData = series.data;

    // If forecasting is enabled, only show data up to forecast start time
    if (enableForecast) {
      displayData = series.data.filter(
        (point) => point[0] <= forecastStartTime
      );
      console.log(
        `Showing ${series.sheetName} data: 0-${forecastStartTime}s (${displayData.length} points)`
      );
    }

    const timeData = displayData.map((row) => row[0]);
    const valueData = displayData.map((row) => row[1]);

    // Get the appropriate color from the group
    const groupColors = colorGroups[series.colorGroup];
    const seriesColor = groupColors[series.groupColorIndex];

    datasets.push({
      label: series.legendLabel,
      data: timeData.map((time, index) => ({ x: time, y: valueData[index] })),
      borderColor: seriesColor,
      backgroundColor: seriesColor + "20",
      borderWidth: 2,
      pointRadius:
        chartType === "scatter" ? (displayData.length > 300 ? 1 : 2) : 0,
      showLine: chartType === "line",
      tension: chartType === "line" ? 0.1 : 0,
    });
  });

  // Process all data for statistics (combine all sheets)
  const allValueData = sheetSeries.flatMap((series) =>
    series.data.map((row) => row[1])
  );

  // Add RPM data if requested
  if (includeRPM) {
    // Find RPM column from first sheet and create time series
    let rpmData = null;
    Object.keys(processedData).forEach((sheet) => {
      const sheetData = processedData[sheet];
      const rpmColumnIndex = sheetData.headers.findIndex(
        (header) =>
          header.toLowerCase().includes("rpm") ||
          header.toLowerCase().includes("paddle")
      );
      if (rpmColumnIndex !== -1 && !rpmData) {
        // Create time series for RPM data (use index * 5 for time)
        rpmData = sheetData.data.map((row, index) => [
          index * 5,
          row[rpmColumnIndex],
        ]);
      }
    });

    if (rpmData) {
      datasets.push({
        label: "Paddle RPM",
        data: rpmData.map((row) => ({ x: row[0], y: row[1] })),
        borderColor: "#9c88ff", // Use purple for RPM
        backgroundColor: "#9c88ff20",
        borderWidth: 1,
        pointRadius: chartType === "scatter" ? 2 : 0.5,
        showLine: chartType === "line",
        tension: chartType === "line" ? 0.1 : 0,
        yAxisID: "y1",
      });
    }
  }

  // Add forecast if enabled (generate forecast for each sheet)
  if (enableForecast && sheetSeries.length > 0) {
    sheetSeries.forEach((series, index) => {
      // Use data up to forecast start time for training the forecast model
      const trainingData = series.data.filter(
        (point) => point[0] <= forecastStartTime
      );

      if (trainingData.length < 5) {
        console.log(
          `Not enough training data before forecast start time for ${series.sheetName}`
        );
        return;
      }

      const forecastEndTime = forecastStartTime + 500; // Forecast 500 seconds forward

      console.log(
        `Generating forecast for ${series.sheetName}: ${trainingData.length} training points (0-${forecastStartTime}s), forecasting ${forecastStartTime}-${forecastEndTime}s`
      );
      console.log("Training data format sample:", trainingData.slice(0, 3));

      // Convert training data from [x,y] array format to {x,y} object format that polynomialRegression expects
      const formattedTrainingData = trainingData.map((point) => ({
        x: point[0],
        y: point[1],
      }));

      console.log(
        "Formatted training data sample:",
        formattedTrainingData.slice(0, 3)
      );

      const forecastResult = generateForecast(
        formattedTrainingData, // Now in {x,y} object format
        polynomialOrder,
        forecastStartTime, // Start forecast from the specified time
        forecastEndTime,
        forecastMethod
      );

      console.log("Forecast result:", forecastResult);

      if (
        forecastResult &&
        forecastResult.data &&
        forecastResult.data.length > 0
      ) {
        // Use a lighter version of the series color for forecast
        const groupColors = colorGroups[series.colorGroup];
        const baseColor = groupColors[series.groupColorIndex];
        const forecastColor = baseColor + "CC"; // Add transparency (80%)

        // Convert forecast data to proper format
        const forecastPoints = forecastResult.data
          .map((point) => {
            if (
              typeof point === "object" &&
              point.x !== undefined &&
              point.y !== undefined
            ) {
              return { x: point.x, y: point.y };
            } else if (Array.isArray(point)) {
              return { x: point[0], y: point[1] };
            } else {
              console.log("Unknown forecast point format:", point);
              return null;
            }
          })
          .filter((point) => point !== null);

        console.log(
          `Forecast points for ${series.sheetName}:`,
          forecastPoints.slice(0, 3)
        );
        console.log("Sample forecast point structure:", forecastPoints[0]);
        console.log(
          "Forecast Y values range:",
          Math.min(...forecastPoints.map((p) => p.y)),
          "to",
          Math.max(...forecastPoints.map((p) => p.y))
        );
        console.log(
          "Training data Y values range:",
          Math.min(...trainingData.map((p) => p[1])),
          "to",
          Math.max(...trainingData.map((p) => p[1]))
        );

        if (forecastPoints.length > 0) {
          datasets.push({
            label: `${series.legendLabel} - Forecast`,
            data: forecastPoints,
            borderColor: baseColor,
            backgroundColor: "transparent",
            borderWidth: 2, // Same as regular chart lines
            borderDash: [8, 4], // Dashed line pattern
            pointRadius: 0, // No points, just line
            showLine: true,
            tension: 0.1,
          });

          console.log(
            `Added forecast for ${series.sheetName}: ${
              forecastPoints.length
            } forecast points, time range: ${forecastPoints[0]?.x} to ${
              forecastPoints[forecastPoints.length - 1]?.x
            }`
          );
        }
      } else {
        console.log(
          `No forecast data generated for ${series.sheetName}`,
          forecastResult
        );
      }
    });

    // Store metrics for this parameter (use first series for metrics)
    if (sheetSeries.length > 0) {
      const firstSeries = sheetSeries[0];
      const metricsTrainingData = firstSeries.data.filter(
        (point) => point[0] <= forecastStartTime
      );
      if (metricsTrainingData.length >= 5) {
        // Convert to {x,y} object format
        const formattedMetricsData = metricsTrainingData.map((point) => ({
          x: point[0],
          y: point[1],
        }));

        const metricsResult = generateForecast(
          formattedMetricsData,
          polynomialOrder,
          forecastStartTime,
          forecastStartTime + 500,
          forecastMethod
        );
        if (metricsResult && metricsResult.metrics) {
          currentForecastMetrics = metricsResult.metrics;
          displayForecastMetricsForParameter(
            parameterId,
            currentForecastMetrics
          );
        }
      }
    }
  }

  // Create chart
  const canvas = document.getElementById(`${parameterId}Chart`);
  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists
  if (window[`${parameterId}ChartInstance`]) {
    window[`${parameterId}ChartInstance`].destroy();
  }

  // Chart configuration with performance optimizations
  const config = {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 0, // Disable animation for better performance
      },
      interaction: {
        intersect: false,
        mode: "nearest",
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          title: { display: true, text: "Time (seconds)" },
        },
        y: {
          title: { display: true, text: `${columnName} (units)` },
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: false,
        },
        tooltip: {
          enabled: true,
        },
      },
      elements: {
        point: {
          radius: chartType === "scatter" ? 2 : 0,
        },
      },
    },
  };

  // Add secondary y-axis for RPM if needed
  if (includeRPM) {
    // Check if we found RPM data earlier
    let hasRpmData = false;
    Object.keys(processedData).forEach((sheet) => {
      const sheetData = processedData[sheet];
      const rpmColumnIndex = sheetData.headers.findIndex(
        (header) =>
          header.toLowerCase().includes("rpm") ||
          header.toLowerCase().includes("paddle")
      );
      if (rpmColumnIndex !== -1) {
        hasRpmData = true;
      }
    });

    if (hasRpmData) {
      config.options.scales.y1 = {
        type: "linear",
        display: true,
        position: "right",
        title: { display: true, text: "Paddle RPM" },
        grid: { drawOnChartArea: false },
      };
    }
  }

  // Create the chart
  window[`${parameterId}ChartInstance`] = new Chart(ctx, config);

  // Update title and legend for this parameter
  document.getElementById(
    `${parameterId}Title`
  ).textContent = `${columnName}`;
  updateCustomLegendForParameter(parameterId, datasets);

  // Generate statistics for this parameter using per-sheet data
  generateStatisticsForParameter(parameterId, columnName, sheetSeries);
}

// Tab switching function
function switchTab(tabId) {
  // Remove active class from all tabs and buttons
  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  // Add active class to selected tab and button
  document.querySelector(`[data-tab="${tabId}"]`).classList.add("active");
  document.getElementById(`${tabId}-tab`).classList.add("active");
}

// Update custom legend for a specific parameter
function updateCustomLegendForParameter(parameterId, datasets) {
  const legendElement = document.getElementById(`${parameterId}Legend`);
  if (!legendElement) return;

  // Clear existing legend
  legendElement.innerHTML = "";
  
  // Get the chart instance for this parameter
  const chartInstance = window[`${parameterId}ChartInstance`];
  
  // Create clickable legend items
  datasets.forEach((dataset, index) => {
    const isRPM = dataset.label.includes("RPM");
    const isForecast = dataset.label.includes("Forecast");
    const legendItem = createLegendItem(dataset, index, isRPM, isForecast, chartInstance);
    legendElement.appendChild(legendItem);
  });
}

// Display forecast metrics for a specific parameter
function displayForecastMetricsForParameter(parameterId, metrics) {
  if (!metrics) return;

  const metricsGrid = document.getElementById(`${parameterId}Metrics`);
  const metricsSummary = document.getElementById(
    `${parameterId}MetricsSummary`
  );

  if (!metricsGrid || !metricsSummary) return;

  metricsGrid.innerHTML = "";

  const metricItems = [
    {
      value: metrics.rSquared.toFixed(4),
      label: "R² (Fit Quality)",
      quality:
        metrics.rSquared >= 0.9
          ? "excellent"
          : metrics.rSquared >= 0.7
          ? "good"
          : "fair",
    },
    {
      value: metrics.rmse.toFixed(3),
      label: "RMSE",
      quality:
        metrics.rmse < 1 ? "excellent" : metrics.rmse < 5 ? "good" : "fair",
    },
    {
      value: metrics.mae.toFixed(3),
      label: "MAE",
      quality:
        metrics.mae < 1 ? "excellent" : metrics.mae < 3 ? "good" : "fair",
    },
    {
      value: `${metrics.mape.toFixed(1)}%`,
      label: "MAPE",
      quality:
        metrics.mape <= 10 ? "excellent" : metrics.mape <= 25 ? "good" : "fair",
    },
  ];

  metricItems.forEach((item) => {
    const metricDiv = document.createElement("div");
    metricDiv.className = `metric-item metric-${item.quality}`;
    metricDiv.innerHTML = `
      <div class="metric-value">${item.value}</div>
      <div class="metric-label">${item.label}</div>
    `;
    metricsGrid.appendChild(metricDiv);
  });

  const overallQuality =
    metrics.rSquared >= 0.9 && metrics.mape <= 10
      ? "excellent"
      : metrics.rSquared >= 0.7 && metrics.mape <= 25
      ? "good"
      : "fair";

  metricsSummary.innerHTML = `
    <strong>Forecast Quality Assessment:</strong> 
    <span class="quality-indicator quality-${overallQuality}">
      ${overallQuality.charAt(0).toUpperCase() + overallQuality.slice(1)}
    </span>
  `;
}

// Generate statistics for a specific parameter
function generateStatisticsForParameter(parameterId, columnName, sheetSeries) {
  const statsElement = document.getElementById(`${parameterId}Stats`);
  if (!statsElement) {
    console.log(`Stats element not found: ${parameterId}Stats`);
    return;
  }

  console.log(
    `Generating statistics for ${parameterId} with ${sheetSeries.length} sheets`
  );
  console.log(`Stats element found:`, statsElement);

  // Get filtering settings
  const timeWindow = document.getElementById("timeWindow").value;

  // Process each sheet's data
  const sheetStats = [];

  sheetSeries.forEach((series, index) => {
    let sheetData = series.data.map((row) => row[1]); // Get Y values

    // Apply time window filtering
    if (timeWindow !== "all") {
      const timeData = series.data.map((row) => row[0]); // Get X values (time)
      sheetData = applyTimeWindowFilter(sheetData, timeData, timeWindow);
    }

    // Filter out any null/undefined values and ensure they're numbers
    let filteredData = sheetData
      .filter((val) => val !== null && val !== undefined && !isNaN(val))
      .map((val) => Number(val));

    if (filteredData.length > 0) {
      const stats = calculateStatistics(filteredData, false);
      stats.sheetName = series.sheetName;
      stats.legendLabel = series.legendLabel;
      stats.originalCount = sheetData.length;
      sheetStats.push(stats);
    }
  });

  if (sheetStats.length === 0) {
    statsElement.innerHTML = "<p>No valid data available for statistics.</p>";
    return;
  }

  // Display statistics table for all sheets
  const tableHTML = generateMultiSheetStatisticsTable(sheetStats, columnName);
  console.log(
    `Generated table HTML for ${parameterId}:`,
    tableHTML.substring(0, 200) + "..."
  );
  statsElement.innerHTML = tableHTML;
  console.log(
    `Stats table set for ${parameterId}. Element innerHTML length:`,
    statsElement.innerHTML.length
  );

  // Add event listeners for filtering changes
  addFilteringEventListeners(parameterId, columnName, sheetSeries);
}

// Generate HTML for multi-sheet statistics table
function generateMultiSheetStatisticsTable(sheetsStats, columnName) {
  if (!sheetsStats || sheetsStats.length === 0) {
    return "<p>No statistics available.</p>";
  }

  let tableHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Run</th>
          <th>Count</th>
          <th>Min</th>
          <th>Max</th>
          <th>Mean</th>
          <th>Median</th>
          <th>Std Dev</th>
          <th>CV (%)</th>
          <th>P10</th>
          <th>P90</th>
          <th>IQR</th>
        </tr>
      </thead>
      <tbody>
  `;

  sheetsStats.forEach((stats, index) => {
    tableHTML += `
      <tr>
        <td><strong>${stats.legendLabel}</strong></td>
        <td>${stats.count}</td>
        <td>${formatStatistic(stats.min, columnName)}</td>
        <td class="highlight-max">${formatStatistic(stats.max, columnName)}</td>
        <td class="highlight-mean">${formatStatistic(
          stats.mean,
          columnName
        )}</td>
        <td>${formatStatistic(stats.median, columnName)}</td>
        <td>${formatStatistic(stats.stdDev, columnName)}</td>
        <td>${stats.cv.toFixed(1)}%</td>
        <td>${formatStatistic(stats.p10, columnName)}</td>
        <td>${formatStatistic(stats.p90, columnName)}</td>
        <td>${formatStatistic(stats.iqr, columnName)}</td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  return tableHTML;
}

// Generate HTML for statistics table (for tabbed interface)
function generateStatisticsTable(stats, columnName) {
  if (!stats) {
    return "<p>No statistics available.</p>";
  }

  const noiseClass = `noise-${getNoiseLevel(stats.cv)}`;
  const noiseIndicator = `<span class="noise-indicator ${noiseClass}"></span>`;

  return `
    <table class="stats-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Count</th>
          <th>Min</th>
          <th>Max</th>
          <th>Mean</th>
          <th>Median</th>
          <th>Std Dev</th>
          <th>CV (%)</th>
          <th>P10</th>
          <th>P90</th>
          <th>IQR</th>
          <th>Noise</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${columnName}</strong></td>
          <td>${stats.count}</td>
          <td>${formatStatistic(stats.min, columnName)}</td>
          <td>${formatStatistic(stats.max, columnName)}</td>
          <td>${formatStatistic(stats.mean, columnName)}</td>
          <td>${formatStatistic(stats.median, columnName)}</td>
          <td>${formatStatistic(stats.stdDev, columnName)}</td>
          <td>${stats.cv.toFixed(1)}%</td>
          <td>${formatStatistic(stats.p10, columnName)}</td>
          <td>${formatStatistic(stats.p90, columnName)}</td>
          <td>${formatStatistic(stats.iqr, columnName)}</td>
          <td>${noiseIndicator}${capitalizeFirst(getNoiseLevel(stats.cv))}</td>
        </tr>
      </tbody>
    </table>
    <div class="stats-tip">
      <span class="stats-tip-icon">💡</span>
      <div class="stats-tip-text">Statistical Summary</div>
      <div class="stats-tip-secondary">Mean: ${formatStatistic(
        stats.mean,
        columnName
      )} | CV: ${stats.cv.toFixed(1)}% | Noise Level: ${capitalizeFirst(
    getNoiseLevel(stats.cv)
  )}</div>
    </div>
  `;
}

// Helper function to get noise level from CV
function getNoiseLevel(cv) {
  if (cv < 15) return "low";
  if (cv < 30) return "medium";
  return "high";
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Apply time window filtering to data
function applyTimeWindowFilter(data, timeData, timeWindow) {
  if (timeWindow === "all") return data;

  let startTime = 0;
  let endTime = Math.max(...timeData);

  switch (timeWindow) {
    case "steady":
      startTime = 300; // After 5 minutes
      break;
    case "final":
      startTime = Math.max(0, endTime - 600); // Last 10 minutes
      break;
    case "custom":
      startTime = parseInt(document.getElementById("startTime").value) || 0;
      endTime = parseInt(document.getElementById("endTime").value) || endTime;
      break;
  }

  const filteredData = [];
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] >= startTime && timeData[i] <= endTime) {
      filteredData.push(data[i]);
    }
  }

  return filteredData;
}

// Add event listeners for filtering changes
function addFilteringEventListeners(parameterId, columnName, sheetSeries) {
  const timeWindow = document.getElementById("timeWindow");
  const startTime = document.getElementById("startTime");
  const endTime = document.getElementById("endTime");
  const customRangeGroup = document.getElementById("customRangeGroup");

  // Handle time window change
  if (timeWindow) {
    timeWindow.addEventListener("change", () => {
      if (timeWindow.value === "custom") {
        customRangeGroup.style.display = "flex";
      } else {
        customRangeGroup.style.display = "none";
      }
      // Regenerate statistics with new filter
      generateStatisticsForParameter(parameterId, columnName, sheetSeries);
    });
  }

  // Handle custom time range changes
  if (startTime) {
    startTime.addEventListener("change", () => {
      if (timeWindow.value === "custom") {
        generateStatisticsForParameter(parameterId, columnName, sheetSeries);
      }
    });
  }

  if (endTime) {
    endTime.addEventListener("change", () => {
      if (timeWindow.value === "custom") {
        generateStatisticsForParameter(parameterId, columnName, sheetSeries);
      }
    });
  }
}
