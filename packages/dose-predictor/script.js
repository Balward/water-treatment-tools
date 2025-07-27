// Seasonal presets data (based on the React app)
const SEASONAL_PRESETS = {
  spring: {
    name: "Spring",
    icon: "🌱",
    raw_mn: 0.045, // Higher manganese due to spring runoff
    raw_fe: 0.02, // Moderate iron levels
    raw_toc: 2.5, // Elevated organics from snowmelt
    raw_ph: 7.3, // Slightly basic
    raw_temp: 8.0, // Cool spring temperatures
    rainfall: 0.3, // Moderate spring precipitation
  },
  summer: {
    name: "Summer",
    icon: "☀️",
    raw_mn: 0.035, // Lower manganese in stable conditions
    raw_fe: 0.012, // Reduced iron levels
    raw_toc: 2.1, // Lower organics due to stable conditions
    raw_ph: 7.6, // More basic pH
    raw_temp: 18.0, // Warm summer temperatures
    rainfall: 0.1, // Lower summer rainfall
  },
  fall: {
    name: "Fall",
    icon: "🍂",
    raw_mn: 0.04, // Moderate manganese from leaf decomposition
    raw_fe: 0.018, // Higher iron from organic matter
    raw_toc: 2.8, // Elevated organics from leaves
    raw_ph: 7.4, // Balanced pH
    raw_temp: 12.0, // Cool fall temperatures
    rainfall: 0.4, // Higher fall precipitation
  },
  winter: {
    name: "Winter",
    icon: "❄️",
    raw_mn: 0.038, // Stable manganese levels
    raw_fe: 0.015, // Moderate iron in cold conditions
    raw_toc: 2.2, // Lower organics due to reduced biological activity
    raw_ph: 7.5, // Stable pH
    raw_temp: 3.0, // Cold winter temperatures
    rainfall: 0.2, // Lower winter precipitation (mostly snow)
  },
};

// Global variables
let selectedPreset = null;
let lastPrediction = null;

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

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeEventListeners();
  loadSavedValues();
});

function initializeEventListeners() {
  // Seasonal preset buttons
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const season = this.dataset.season;
      applyPreset(season);
    });
  });

  // Form submission
  document
    .getElementById("parametersForm")
    .addEventListener("submit", handleFormSubmit);

  // Action buttons
  document.getElementById("copyBtn").addEventListener("click", copyPrediction);
  document.getElementById("resetBtn").addEventListener("click", resetForm);
}

function loadSavedValues() {
  // Load saved form values from localStorage
  const savedValues = localStorage.getItem("dosePredictor_lastValues");
  if (savedValues) {
    try {
      const values = JSON.parse(savedValues);
      Object.keys(values).forEach((key) => {
        const input = document.getElementById(key);
        if (input) {
          input.value = values[key];
        }
      });
    } catch (error) {
      console.warn("Failed to load saved values:", error);
    }
  }
}

function saveFormValues() {
  const formData = {
    rawMn: document.getElementById("rawMn").value,
    rawFe: document.getElementById("rawFe").value,
    rawToc: document.getElementById("rawToc").value,
    rawPh: document.getElementById("rawPh").value,
    rawTemp: document.getElementById("rawTemp").value,
    rainfall: document.getElementById("rainfall").value,
  };
  localStorage.setItem("dosePredictor_lastValues", JSON.stringify(formData));
}

function applyPreset(season) {
  const preset = SEASONAL_PRESETS[season];
  if (!preset) return;

  // Update selected preset UI
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-season="${season}"]`).classList.add("active");

  selectedPreset = season;

  // Apply preset values to form
  document.getElementById("rawMn").value = preset.raw_mn;
  document.getElementById("rawFe").value = preset.raw_fe;
  document.getElementById("rawToc").value = preset.raw_toc;
  document.getElementById("rawPh").value = preset.raw_ph;
  document.getElementById("rawTemp").value = preset.raw_temp;
  document.getElementById("rainfall").value = preset.rainfall;

  showNotification(`Applied ${preset.name} seasonal preset`, "success");
}

function handleFormSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById("predictBtn");
  const originalContent = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = "<span>🤖</span><span>Analyzing Parameters...</span>";

  // Collect form data
  const formData = {
    raw_mn: parseFloat(document.getElementById("rawMn").value),
    raw_fe: parseFloat(document.getElementById("rawFe").value),
    raw_toc: parseFloat(document.getElementById("rawToc").value),
    raw_ph: parseFloat(document.getElementById("rawPh").value),
    raw_temp: parseFloat(document.getElementById("rawTemp").value),
    rainfall: parseFloat(document.getElementById("rainfall").value),
    month: new Date().getMonth() + 1,
  };

  // Validate input ranges
  const validation = validateInputs(formData);
  if (!validation.valid) {
    showNotification(validation.message, "error");
    btn.disabled = false;
    btn.innerHTML = originalContent;
    return;
  }

  // Save form values
  saveFormValues();

  // Simulate API call (since we don't have the actual backend)
  setTimeout(() => {
    try {
      const prediction = simulatePrediction(formData);
      displayPrediction(prediction);
      showNotification("Dose prediction completed successfully!", "success");
    } catch (error) {
      console.error("Prediction failed:", error);
      showNotification(
        "Prediction failed. Please check your inputs and try again.",
        "error"
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }, 2000); // Simulate 2 second processing time
}

function validateInputs(data) {
  const ranges = {
    raw_mn: { min: 0.001, max: 0.5, name: "Raw Manganese" },
    raw_fe: { min: 0.001, max: 0.3, name: "Raw Iron" },
    raw_toc: { min: 0.1, max: 10.0, name: "Total Organic Carbon" },
    raw_ph: { min: 6.0, max: 9.0, name: "pH Level" },
    raw_temp: { min: -5, max: 35, name: "Temperature" },
    rainfall: { min: 0.0, max: 5.0, name: "Rainfall" },
  };

  for (const [key, range] of Object.entries(ranges)) {
    const value = data[key];
    if (isNaN(value) || value < range.min || value > range.max) {
      return {
        valid: false,
        message: `${range.name} must be between ${range.min} and ${range.max}`,
      };
    }
  }

  return { valid: true };
}

function simulatePrediction(data) {
  // This is a simplified simulation of the ML model
  // In reality, this would be an API call to your Python backend

  // Base dose calculation using a simplified formula
  // This approximates the patterns from the actual ML model
  let baseDose = 0.1; // Base minimum dose

  // Manganese influence (highest impact - 85%)
  baseDose += data.raw_mn * 8.5;

  // TOC influence (high impact - 72%)
  baseDose += data.raw_toc * 0.035;

  // Iron influence (medium impact - 65%)
  baseDose += data.raw_fe * 4.2;

  // Temperature influence (medium impact - 45%)
  // Higher temperature increases reaction rate, might need slightly less chemical
  const tempFactor = Math.max(0.8, 1 - (data.raw_temp - 10) * 0.005);
  baseDose *= tempFactor;

  // pH influence (medium impact - 35%)
  const phFactor = data.raw_ph < 7 ? 1.1 : data.raw_ph > 8 ? 0.95 : 1.0;
  baseDose *= phFactor;

  // Rainfall influence (low impact - 28%)
  baseDose += data.rainfall * 0.02;

  // Seasonal adjustment based on month
  const monthFactor = getSeasonalFactor(data.month);
  baseDose *= monthFactor;

  // Add small random variation to simulate real-world conditions
  const variation = (Math.random() - 0.5) * 0.02;
  baseDose += variation;

  // Ensure reasonable bounds
  baseDose = Math.max(0.05, Math.min(2.0, baseDose));

  return {
    predicted_dose: baseDose,
    prediction_timestamp: new Date().toISOString(),
    confidence: 0.92, // Simulated confidence based on model R²
    model_version: "v1.0_simulation",
  };
}

function getSeasonalFactor(month) {
  // Adjust dose based on seasonal patterns
  if (month >= 3 && month <= 5) return 1.05; // Spring - higher organics
  if (month >= 6 && month <= 8) return 0.95; // Summer - stable conditions
  if (month >= 9 && month <= 11) return 1.08; // Fall - leaf matter
  return 1.0; // Winter - stable
}

function displayPrediction(prediction) {
  lastPrediction = prediction;

  // Show results section
  document.getElementById("resultsSection").style.display = "block";

  // Update prediction display
  document.getElementById("predictionValue").textContent =
    prediction.predicted_dose.toFixed(3);

  document.getElementById("predictionTime").textContent = new Date(
    prediction.prediction_timestamp
  ).toLocaleString();

  // Scroll to results
  document.getElementById("resultsSection").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function copyPrediction() {
  if (!lastPrediction) return;

  const textToCopy = `Sodium Permanganate Dose Prediction
Generated: ${new Date(lastPrediction.prediction_timestamp).toLocaleString()}
Predicted Dose: ${lastPrediction.predicted_dose.toFixed(3)} mg/L
Model Confidence: ${(lastPrediction.confidence * 100).toFixed(1)}%
Source: AI-Powered Water Treatment Optimizer`;

  navigator.clipboard
    .writeText(textToCopy)
    .then(() => {
      const btn = document.getElementById("copyBtn");
      const originalContent = btn.innerHTML;
      btn.innerHTML = "<span>✅</span><span>Copied!</span>";

      setTimeout(() => {
        btn.innerHTML = originalContent;
      }, 2000);

      showNotification("Prediction results copied to clipboard", "success");
    })
    .catch(() => {
      showNotification("Failed to copy to clipboard", "error");
    });
}

function resetForm() {
  // Clear form inputs
  document.getElementById("parametersForm").reset();

  // Clear selected preset
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  selectedPreset = null;

  // Hide results
  document.getElementById("resultsSection").style.display = "none";

  // Clear saved values
  localStorage.removeItem("dosePredictor_lastValues");

  showNotification("Form reset successfully", "info");
}

// Help modal functions
function openHelp() {
  document.getElementById("helpModal").style.display = "flex";
}

function closeHelp() {
  document.getElementById("helpModal").style.display = "none";
}

// Close modal when clicking outside
document.addEventListener("click", function (e) {
  const modal = document.getElementById("helpModal");
  if (e.target === modal) {
    closeHelp();
  }
});

// Handle escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeHelp();
  }
});
