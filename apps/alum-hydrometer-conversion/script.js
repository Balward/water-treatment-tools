(() => {
  const DEFAULTS = Object.freeze({
    density: 1.327,
    tempC: 24.1,
  });

  const REFERENCE_DATA = [
    { density: 1.0069, baume: 1, percent: 1.1 },
    { density: 1.014, baume: 2, percent: 2.3 },
    { density: 1.0211, baume: 3, percent: 3.5 },
    { density: 1.0284, baume: 4, percent: 4.7 },
    { density: 1.0357, baume: 5, percent: 5.9 },
    { density: 1.0432, baume: 6, percent: 7.2 },
    { density: 1.0507, baume: 7, percent: 8.4 },
    { density: 1.0584, baume: 8, percent: 9.7 },
    { density: 1.0662, baume: 9, percent: 10.9 },
    { density: 1.0741, baume: 10, percent: 12.2 },
    { density: 1.0821, baume: 11, percent: 13.4 },
    { density: 1.0902, baume: 12, percent: 14.7 },
    { density: 1.0985, baume: 13, percent: 16 },
    { density: 1.1069, baume: 14, percent: 17.2 },
    { density: 1.1154, baume: 15, percent: 18.5 },
    { density: 1.124, baume: 16, percent: 19.9 },
    { density: 1.1328, baume: 17, percent: 21.2 },
    { density: 1.1417, baume: 18, percent: 22.5 },
    { density: 1.1508, baume: 19, percent: 23.8 },
    { density: 1.16, baume: 20, percent: 25.1 },
    { density: 1.1694, baume: 21, percent: 26.5 },
    { density: 1.1789, baume: 22, percent: 27.8 },
    { density: 1.1885, baume: 23, percent: 29.2 },
    { density: 1.1983, baume: 24, percent: 30.5 },
    { density: 1.2083, baume: 25, percent: 31.9 },
    { density: 1.2185, baume: 26, percent: 33.4 },
    { density: 1.2288, baume: 27, percent: 34.8 },
    { density: 1.2393, baume: 28, percent: 36.2 },
    { density: 1.25, baume: 29, percent: 37.8 },
    { density: 1.2609, baume: 30, percent: 39.2 },
    { density: 1.2719, baume: 31, percent: 40.7 },
    { density: 1.2832, baume: 32, percent: 42.1 },
    { density: 1.2946, baume: 33, percent: 43.5 },
    { density: 1.3063, baume: 34, percent: 45.1 },
    { density: 1.3182, baume: 35, percent: 46.6 },
    { density: 1.3303, baume: 36, percent: 48.2 },
    { density: 1.3426, baume: 37, percent: 49.8 },
    { density: 1.3551, baume: 38, percent: 51.4 },
    { density: 1.3679, baume: 39, percent: 53 },
  ];

  const elements = {
    densityInput: document.getElementById("densityInput"),
    tempInput: document.getElementById("tempInput"),
    resetButton: document.getElementById("resetButton"),
    tempF: document.getElementById("tempFResult"),
    correction: document.getElementById("correctionResult"),
    baseBaume: document.getElementById("baseBaumeResult"),
    correctedBaume: document.getElementById("correctedBaumeResult"),
    correctedDensity: document.getElementById("correctedDensityResult"),
    dryAlum: document.getElementById("dryAlumResult"),
    primaryDryAlum: document.getElementById("primaryDryAlum"),
    primaryDryAlumStatus: document.getElementById("primaryDryAlumStatus"),
    minPercent: document.getElementById("minPercent"),
    referenceTableBody: document.getElementById("referenceTableBody"),
  };

  const referenceRows = [];
  const PLACEHOLDER = "--";

  function formatNumber(value, decimals) {
    if (!Number.isFinite(value)) {
      return PLACEHOLDER;
    }
    return value.toFixed(decimals);
  }

  function formatWithUnit(value, unit, decimals) {
    if (!Number.isFinite(value)) {
      return PLACEHOLDER;
    }
    return `${formatNumber(value, decimals)} ${unit}`;
  }

  function formatSigned(value, decimals) {
    if (!Number.isFinite(value)) {
      return PLACEHOLDER;
    }
    const prefix = value >= 0 ? "+" : "-";
    return `${prefix}${Math.abs(value).toFixed(decimals)}`;
  }

  function computeBaseBaume(density) {
    return -89.2372578386554 * density ** 2 + 316.291955357175 * density - 226.846279115839;
  }

  function computeCorrection(tempF) {
    if (Math.abs(tempF - 60) < 1e-9) {
      return 0;
    }
    if (tempF > 60) {
      return (
        0.000142207283972578 * tempF ** 2 +
        0.0000815253108144793 * tempF -
        0.517925082780839
      );
    }
    return (
      -0.000171428571428577 * tempF ** 2 +
      0.037142857142857 * tempF -
      1.612
    );
  }

  function computeCorrectedDensity(correctedBaume) {
    return (
      0.0000757899006963252 * correctedBaume ** 2 +
      0.00638581287913759 * correctedBaume +
      1.00190875369296
    );
  }

  function computeDryAlum(correctedDensity) {
    return (
      -62.4077406420726 * correctedDensity ** 2 +
      291.040942971377 * correctedDensity -
      228.523376591095
    );
  }

  function isValidInput(density, tempC) {
    return Number.isFinite(density) && Number.isFinite(tempC);
  }

  function updateReferenceHighlight(targetBaume) {
    let closest = null;
    let bestDifference = Number.POSITIVE_INFINITY;

    referenceRows.forEach((entry) => {
      const difference = Math.abs(entry.baume - targetBaume);
      if (difference < bestDifference) {
        bestDifference = difference;
        closest = entry;
      }
    });

    referenceRows.forEach((entry) => {
      entry.row.classList.toggle("is-highlighted", entry === closest);
    });
  }

  function renderReferenceTable() {
    elements.referenceTableBody.innerHTML = "";

    REFERENCE_DATA.forEach((item) => {
      const row = document.createElement("tr");
      const densityCell = document.createElement("td");
      const baumeCell = document.createElement("td");
      const percentCell = document.createElement("td");

      densityCell.textContent = item.density.toFixed(4);
      baumeCell.textContent = item.baume.toFixed(1);
      percentCell.textContent = item.percent.toFixed(1);

      row.appendChild(densityCell);
      row.appendChild(baumeCell);
      row.appendChild(percentCell);

      elements.referenceTableBody.appendChild(row);
      referenceRows.push({ row, baume: item.baume });
    });
  }

  function clearResults() {
    [elements.tempF, elements.correction, elements.baseBaume, elements.correctedBaume, elements.correctedDensity, elements.dryAlum].forEach(
      (element) => {
        element.textContent = PLACEHOLDER;
        element.classList.remove("is-alert");
      }
    );
    if (elements.primaryDryAlum) {
      elements.primaryDryAlum.textContent = PLACEHOLDER;
      elements.primaryDryAlum.classList.remove("is-alert");
      const callout = elements.primaryDryAlum.closest(".alum-strength-callout");
      if (callout) {
        callout.classList.remove("is-alert");
      }
    }
    if (elements.primaryDryAlumStatus) {
      elements.primaryDryAlumStatus.textContent = "Awaiting inputs";
      elements.primaryDryAlumStatus.classList.remove("is-alert");
    }
    elements.minPercent.classList.remove("is-alert");
    updateReferenceHighlight(Number.NaN);
  }

  function updateResults() {
    const density = parseFloat(elements.densityInput.value);
    const tempC = parseFloat(elements.tempInput.value);

    if (!isValidInput(density, tempC)) {
      clearResults();
      return;
    }

    const tempF = tempC * 1.8 + 32;
    const correction = computeCorrection(tempF);
    const baseBaume = computeBaseBaume(density);
    const correctedBaume = baseBaume + correction;
    const correctedDensity = computeCorrectedDensity(correctedBaume);
    const dryAlum = computeDryAlum(correctedDensity);

    elements.tempF.textContent = formatWithUnit(tempF, "deg F", 2);
    elements.correction.textContent = `${formatSigned(correction, 2)} deg Be`;
    elements.baseBaume.textContent = formatWithUnit(baseBaume, "deg Be", 2);
    elements.correctedBaume.textContent = formatWithUnit(correctedBaume, "deg Be", 2);
    elements.correctedDensity.textContent = formatWithUnit(correctedDensity, "g/cm^3", 4);
    elements.dryAlum.textContent = formatWithUnit(dryAlum, "%", 2);

    const isBelowMinimum = dryAlum < 46.6;
    elements.dryAlum.classList.toggle("is-alert", isBelowMinimum);
    elements.minPercent.classList.toggle("is-alert", isBelowMinimum);

    if (elements.primaryDryAlum) {
      const primaryValue = Number.isFinite(dryAlum) ? `${formatNumber(dryAlum, 2)}%` : PLACEHOLDER;
      elements.primaryDryAlum.textContent = primaryValue;
      elements.primaryDryAlum.classList.toggle("is-alert", isBelowMinimum);
      const callout = elements.primaryDryAlum.closest(".alum-strength-callout");
      if (callout) {
        callout.classList.toggle("is-alert", isBelowMinimum);
      }
    }
    if (elements.primaryDryAlumStatus) {
      const statusText = isBelowMinimum ? "Below minimum guarantee (46.6%)" : "Within specification";
      elements.primaryDryAlumStatus.textContent = statusText;
      elements.primaryDryAlumStatus.classList.toggle("is-alert", isBelowMinimum);
    }

    updateReferenceHighlight(correctedBaume);
  }

  function resetInputs() {
    elements.densityInput.value = DEFAULTS.density.toFixed(3);
    elements.tempInput.value = DEFAULTS.tempC.toFixed(1);
    updateResults();
  }

  function bindEvents() {
    elements.densityInput.addEventListener("input", updateResults);
    elements.tempInput.addEventListener("input", updateResults);
    elements.resetButton.addEventListener("click", resetInputs);
  }

  renderReferenceTable();
  bindEvents();
  updateResults();
})();
