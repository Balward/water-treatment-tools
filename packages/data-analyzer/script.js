// Global variables
let data = [];
let variables = [];
let units = {};

// Chart instances
let correlationChart = null;
let timeSeriesChart = null;
let distributionChart = null;
let optimizationChart = null;

// Initialize application
window.addEventListener('load', function() {
    loadData();
});

// Load and parse Excel data
async function loadData() {
    try {
        // Enhanced loading sequence with realistic timing
        await updateLoadingProgress(5, 'Initializing data analyzer...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await updateLoadingProgress(15, 'Connecting to data source...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        await updateLoadingProgress(25, 'Fetching Excel file...');
        const response = await fetch('../../data/Streaming_Current_Data.xlsx');
        if (!response.ok) throw new Error('Failed to fetch data file');
        
        await updateLoadingProgress(40, 'Downloading spreadsheet data...');
        await new Promise(resolve => setTimeout(resolve, 300));
        const arrayBuffer = await response.arrayBuffer();
        
        await updateLoadingProgress(55, 'Parsing Excel workbook...');
        await new Promise(resolve => setTimeout(resolve, 400));
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        await updateLoadingProgress(70, 'Extracting variables and units...');
        await new Promise(resolve => setTimeout(resolve, 300));
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        if (jsonData.length < 2) {
            throw new Error('Data file must have at least 2 rows (headers and data)');
        }
        
        // Process headers (Row 1: Variable names with units in brackets)
        const headerRow = jsonData[0];
        const dataRows = jsonData.slice(1);
        
        // Extract variables and units
        variables = [];
        units = {};
        
        headerRow.forEach((header, index) => {
            if (header && header.toString().trim()) {
                const headerStr = header.toString().trim();
                
                // Extract variable name and unit (format: "Variable Name (unit)")
                const match = headerStr.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (match) {
                    const varName = match[1].trim();
                    const unit = match[2].trim();
                    variables.push(varName);
                    units[varName] = unit;
                } else {
                    // No unit in brackets (like "Date")
                    variables.push(headerStr);
                    units[headerStr] = '';
                }
            }
        });
        
        // Process data rows
        data = dataRows.filter(row => {
            // Filter out completely empty rows
            return row && row.some(cell => cell !== null && cell !== undefined && cell !== '');
        }).map(row => {
            const dataPoint = {};
            variables.forEach((variable, index) => {
                let value = row[index];
                
                if (value !== null && value !== undefined && value !== '') {
                    // Handle Date column specially
                    if (variable === 'Date') {
                        if (typeof value === 'string') {
                            dataPoint[variable] = value;
                        } else {
                            // Excel date number - convert to date string
                            const date = new Date((value - 25569) * 86400 * 1000);
                            dataPoint[variable] = date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
                        }
                    } else {
                        // Numeric values
                        const numValue = typeof value === 'number' ? value : parseFloat(value);
                        dataPoint[variable] = !isNaN(numValue) ? numValue : value;
                    }
                } else {
                    dataPoint[variable] = null;
                }
            });
            return dataPoint;
        });
        
        await updateLoadingProgress(85, 'Processing data rows...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        await updateLoadingProgress(95, 'Setting up interface...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Initialize UI
        populateSelectors();
        displayDataInfo();
        setDefaultSelections();
        showMainContent();
        
        await updateLoadingProgress(100, 'Analysis ready!');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        hideLoadingScreen();
        
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoadingScreen();
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

// Update loading progress with smooth animation
async function updateLoadingProgress(targetPercentage, text) {
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
        loadingText.textContent = text;
    }
    
    if (progressFill) {
        const currentWidth = parseInt(progressFill.style.width) || 0;
        const difference = targetPercentage - currentWidth;
        const steps = 20;
        const increment = difference / steps;
        
        for (let i = 0; i <= steps; i++) {
            const newWidth = currentWidth + (increment * i);
            progressFill.style.width = Math.min(newWidth, targetPercentage) + '%';
            await new Promise(resolve => setTimeout(resolve, 15));
        }
    }
}

// Hide loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

// Show main content
function showMainContent() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
}

// Populate all selector dropdowns
function populateSelectors() {
    const selectorIds = [
        'corrXAxis', 'corrYAxis', 'corrColorBy',
        'timeVar1', 'timeVar2', 'timeVar3', 'timeVar4',
        'distVariable', 'targetVariable'
    ];
    
    selectorIds.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (!selector) return;
        
        // Keep first option, clear rest
        const firstOption = selector.querySelector('option');
        selector.innerHTML = '';
        if (firstOption) {
            selector.appendChild(firstOption);
        }
        
        // Add variable options (skip Date for non-time series selectors)
        variables.forEach(variable => {
            if (variable === 'Date' && !selectorId.startsWith('time')) return;
            
            const option = document.createElement('option');
            option.value = variable;
            const unit = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
            option.textContent = `${variable}${unit}`;
            selector.appendChild(option);
        });
    });
}

// Display dataset information
function displayDataInfo() {
    const dataInfo = document.getElementById('dataInfo');
    const totalRows = data.length;
    const totalVariables = variables.length;
    const dateRange = getDateRange();
    
    dataInfo.innerHTML = `
        <div class="data-grid">
            <div class="data-item">
                <strong>Total Records:</strong> ${totalRows.toLocaleString()}
            </div>
            <div class="data-item">
                <strong>Variables:</strong> ${totalVariables}
            </div>
            <div class="data-item">
                <strong>Date Range:</strong> ${dateRange}
            </div>
            <div class="data-item">
                <strong>Status:</strong> ✅ Ready for Analysis
            </div>
        </div>
    `;
}

// Get date range from data
function getDateRange() {
    const dates = data.map(d => d.Date).filter(d => d !== null);
    if (dates.length === 0) return 'No dates';
    
    const sortedDates = dates.sort();
    return `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
}

// Set default selections
function setDefaultSelections() {
    // Find common variables
    const streamingVar = variables.find(v => v.toLowerCase().includes('streaming current') || v.toLowerCase().includes('streaming_current'));
    const alumVar = variables.find(v => v.toLowerCase().includes('aluminum') || v.toLowerCase().includes('alum'));
    
    // Set correlation defaults
    if (streamingVar && alumVar) {
        document.getElementById('corrXAxis').value = alumVar;
        document.getElementById('corrYAxis').value = streamingVar;
        updateCorrelationChart();
    }
    
    // Set time series defaults
    if (streamingVar) {
        document.getElementById('timeVar1').value = streamingVar;
    }
    if (alumVar) {
        document.getElementById('timeVar2').value = alumVar;
    }
    updateTimeSeriesChart();
    
    // Set distribution default
    if (streamingVar) {
        document.getElementById('distVariable').value = streamingVar;
        updateDistributionChart();
    }
    
    // Set optimization default
    if (streamingVar) {
        document.getElementById('targetVariable').value = streamingVar;
        updateOptimizationChart();
    }
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Update charts based on current selections
    switch(tabName) {
        case 'correlation':
            updateCorrelationChart();
            break;
        case 'timeseries':
            updateTimeSeriesChart();
            break;
        case 'distribution':
            updateDistributionChart();
            break;
        case 'optimization':
            updateOptimizationChart();
            break;
    }
}

// Get decimal places from data values
function getDecimalPlaces(values) {
    let maxDecimals = 0;
    values.forEach(value => {
        if (typeof value === 'number') {
            const str = value.toString();
            const decimalIndex = str.indexOf('.');
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
    if (typeof value !== 'number' || isNaN(value)) return value;
    
    // Get sample values for this variable to determine decimal places
    const sampleValues = data.slice(0, 100).map(d => d[variable]).filter(v => typeof v === 'number');
    const decimals = getDecimalPlaces(sampleValues);
    
    return value.toFixed(decimals);
}

// Update correlation chart
function updateCorrelationChart() {
    const xVar = document.getElementById('corrXAxis').value;
    const yVar = document.getElementById('corrYAxis').value;
    const colorVar = document.getElementById('corrColorBy').value;
    
    if (!xVar || !yVar) {
        document.getElementById('correlationTitle').textContent = 'Select variables to view correlation';
        document.getElementById('correlationSubtitle').textContent = '';
        return;
    }
    
    // Get valid data points with color variable if specified
    let validData = data.map(d => ({
        x: d[xVar],
        y: d[yVar],
        color: colorVar ? d[colorVar] : null
    })).filter(point => 
        typeof point.x === 'number' && typeof point.y === 'number' && 
        !isNaN(point.x) && !isNaN(point.y) &&
        (!colorVar || (typeof point.color === 'number' && !isNaN(point.color)))
    );
    
    if (validData.length === 0) {
        showNotification('No valid data points found for selected variables', 'warning');
        return;
    }
    
    let datasets = [];
    
    if (colorVar) {
        // Group data by color variable ranges
        const colorValues = validData.map(d => d.color);
        const colorRanges = createColorRanges(colorValues, colorVar);
        const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
        
        colorRanges.forEach((range, index) => {
            const rangeData = validData.filter(d => d.color >= range.min && d.color <= range.max);
            if (rangeData.length > 0) {
                const bubbleData = createBubbleData(rangeData);
                datasets.push({
                    label: range.label,
                    data: bubbleData,
                    backgroundColor: colors[index] + '80',
                    borderColor: colors[index],
                    borderWidth: 2
                });
            }
        });
    } else {
        // Single dataset with bubble sizing
        const bubbleData = createBubbleData(validData);
        datasets.push({
            label: `${yVar} vs ${xVar}`,
            data: bubbleData,
            backgroundColor: 'rgba(102, 126, 234, 0.6)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2
        });
    }
    
    // Destroy existing chart
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    // Calculate axis ranges with 10% buffer
    const xValues = validData.map(d => d.x);
    const yValues = validData.map(d => d.y);
    const xRange = calculateAxisRange(xValues, xVar);
    const yRange = calculateAxisRange(yValues, yVar);
    
    const ctx = document.getElementById('correlationChart').getContext('2d');
    correlationChart = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const x = formatValue(context.parsed.x, xVar);
                            const y = formatValue(context.parsed.y, yVar);
                            const count = context.raw.count || 1;
                            const countText = count > 1 ? ` (${count} points)` : '';
                            return `(${x}, ${y})${countText}`;
                        }
                    }
                },
                ...getZoomConfig()
            },
            scales: {
                x: {
                    display: true,
                    title: { 
                        display: true, 
                        text: `${xVar}${units[xVar] ? ` (${units[xVar]})` : ''}` 
                    },
                    min: xRange.min,
                    max: xRange.max,
                    ticks: {
                        callback: function(value) {
                            return formatValue(value, xVar);
                        }
                    }
                },
                y: {
                    display: true,
                    title: { 
                        display: true, 
                        text: `${yVar}${units[yVar] ? ` (${units[yVar]})` : ''}` 
                    },
                    min: yRange.min,
                    max: yRange.max,
                    ticks: {
                        callback: function(value) {
                            return formatValue(value, yVar);
                        }
                    }
                }
            }
        }
    });
    
    // Calculate correlation coefficient and update title/subtitle
    const correlation = calculateCorrelation(xValues, yValues);
    const xUnit = units[xVar] ? ` (${units[xVar]})` : '';
    const yUnit = units[yVar] ? ` (${units[yVar]})` : '';
    
    // Main title: Variable comparison
    document.getElementById('correlationTitle').textContent = `${yVar}${yUnit} vs ${xVar}${xUnit}`;
    
    // Subtitle: R-value and color info
    const colorText = colorVar ? ` • Colored by ${colorVar}${units[colorVar] ? ` (${units[colorVar]})` : ''}` : '';
    document.getElementById('correlationSubtitle').textContent = `R = ${correlation.toFixed(3)}${colorText}`;
}

// Create color ranges (maximum 5)
function createColorRanges(values, variable) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range === 0) {
        return [{ min: min, max: max, label: formatValue(min, variable) }];
    }
    
    const numRanges = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(values.length / 10))));
    const rangeSize = range / numRanges;
    const ranges = [];
    
    for (let i = 0; i < numRanges; i++) {
        const rangeMin = min + (i * rangeSize);
        const rangeMax = i === numRanges - 1 ? max : min + ((i + 1) * rangeSize);
        const unit = units[variable] ? ` ${units[variable]}` : '';
        
        ranges.push({
            min: rangeMin,
            max: rangeMax,
            label: `${formatValue(rangeMin, variable)} - ${formatValue(rangeMax, variable)}${unit}`
        });
    }
    
    return ranges;
}

// Create bubble data with frequency-based sizing
function createBubbleData(validData) {
    // Group points by coordinates to count frequency
    const pointMap = {};
    const tolerance = 1e-6; // Small tolerance for floating point comparison
    
    validData.forEach(point => {
        const key = `${Math.round(point.x / tolerance) * tolerance},${Math.round(point.y / tolerance) * tolerance}`;
        if (!pointMap[key]) {
            pointMap[key] = { x: point.x, y: point.y, count: 0 };
        }
        pointMap[key].count++;
    });
    
    // Convert to bubble format with size based on frequency
    return Object.values(pointMap).map(point => ({
        x: point.x,
        y: point.y,
        r: Math.max(3, Math.min(20, 3 + Math.log(point.count) * 3)), // Logarithmic scaling
        count: point.count
    }));
}

// Calculate axis range with 10% buffer and minimum 0 (except streaming current)
function calculateAxisRange(values, variable) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const buffer = range * 0.1;
    
    const isStreamingCurrent = variable.toLowerCase().includes('streaming current') || 
                              variable.toLowerCase().includes('streaming_current');
    
    return {
        min: isStreamingCurrent ? min - buffer : Math.max(0, min - buffer),
        max: max + buffer
    };
}

// Update time series chart
function updateTimeSeriesChart() {
    const selectedVars = [1, 2, 3, 4].map(i => 
        document.getElementById(`timeVar${i}`).value
    ).filter(v => v && v !== '');
    
    if (selectedVars.length === 0) {
        document.getElementById('timeSeriesTitle').textContent = 'Select variables to view time series';
        return;
    }
    
    // Process date column for time axis
    const timeData = data.map((d, index) => {
        const dateStr = d.Date;
        if (!dateStr) return null;
        
        // Parse M/D/YYYY H:MM format
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (match) {
            const [, month, day, year, hour, minute] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        return null;
    }).filter(d => d !== null);
    
    if (timeData.length === 0) {
        showNotification('No valid dates found in Date column', 'error');
        return;
    }
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
    const datasets = [];
    
    selectedVars.forEach((variable, index) => {
        const dataPoints = [];
        
        data.forEach((point, rowIndex) => {
            const dateStr = point.Date;
            const value = point[variable];
            
            if (dateStr && typeof value === 'number' && !isNaN(value)) {
                const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
                if (match) {
                    const [, month, day, year, hour, minute] = match;
                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                    dataPoints.push({ x: date, y: value });
                }
            }
        });
        
        if (dataPoints.length > 0) {
            datasets.push({
                label: `${variable}${units[variable] ? ` (${units[variable]})` : ''}`,
                data: dataPoints,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            });
        }
    });
    
    if (datasets.length === 0) {
        showNotification('No valid data found for time series', 'error');
        return;
    }
    
    // Destroy existing chart
    if (timeSeriesChart) {
        timeSeriesChart.destroy();
    }
    
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');
    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const variable = context.dataset.label.split(' (')[0];
                            const value = formatValue(context.parsed.y, variable);
                            return `${context.dataset.label}: ${value}`;
                        }
                    }
                },
                ...getZoomConfig()
            },
            scales: {
                x: {
                    type: 'time',
                    display: true,
                    title: { display: true, text: 'Date' },
                    time: {
                        displayFormats: {
                            hour: 'M/d HH:mm',
                            day: 'M/d',
                            week: 'M/d',
                            month: 'M/yyyy'
                        }
                    }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Values (Various Units)' },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
    
    document.getElementById('timeSeriesTitle').textContent = `Variables over Time (${datasets.length} series)`;
}

// Update distribution chart
function updateDistributionChart() {
    const variable = document.getElementById('distVariable').value;
    const binCount = document.getElementById('distBins').value;
    
    if (!variable) {
        document.getElementById('distributionTitle').textContent = 'Select variable to view distribution';
        return;
    }
    
    // Get valid numeric values
    const values = data.map(d => d[variable]).filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) {
        showNotification('No valid numeric data found for selected variable', 'warning');
        return;
    }
    
    // Calculate bins
    let bins = binCount === 'auto' ? Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length)))) : parseInt(binCount);
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
        binLabels.push(`${binStart.toFixed(decimals)} - ${binEnd.toFixed(decimals)}`);
    }
    
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
        histogram[binIndex]++;
    });
    
    // Destroy existing chart
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    const ctx = document.getElementById('distributionChart').getContext('2d');
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frequency',
                data: histogram,
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                ...getZoomConfig()
            },
            scales: {
                x: {
                    display: true,
                    title: { 
                        display: true, 
                        text: `${variable}${units[variable] ? ` (${units[variable]})` : ''} Range` 
                    }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Frequency' },
                    beginAtZero: true
                }
            }
        }
    });
    
    // Display statistics
    displayStats(values, variable);
    
    const unit = units[variable] ? ` (${units[variable]})` : '';
    document.getElementById('distributionTitle').textContent = `Distribution of ${variable}${unit}`;
}

// Display statistics
function displayStats(values, variable) {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    const stats = {
        count: n,
        mean: mean,
        median: sorted[Math.floor(n / 2)],
        stdDev: stdDev,
        min: sorted[0],
        max: sorted[n - 1],
        q1: sorted[Math.floor(n * 0.25)],
        q3: sorted[Math.floor(n * 0.75)]
    };
    
    const unit = units[variable] ? ` ${units[variable]}` : '';
    
    document.getElementById('distributionStats').innerHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <div><strong>Count:</strong> ${stats.count.toLocaleString()}</div>
            <div><strong>Mean:</strong> ${formatValue(stats.mean, variable)}${unit}</div>
            <div><strong>Median:</strong> ${formatValue(stats.median, variable)}${unit}</div>
            <div><strong>Std Dev:</strong> ${formatValue(stats.stdDev, variable)}${unit}</div>
            <div><strong>Min:</strong> ${formatValue(stats.min, variable)}${unit}</div>
            <div><strong>Max:</strong> ${formatValue(stats.max, variable)}${unit}</div>
            <div><strong>Q1:</strong> ${formatValue(stats.q1, variable)}${unit}</div>
            <div><strong>Q3:</strong> ${formatValue(stats.q3, variable)}${unit}</div>
        </div>
    `;
}

// Update optimization chart
function updateOptimizationChart() {
    const targetVar = document.getElementById('targetVariable').value;
    const minCorr = parseFloat(document.getElementById('minCorrelation').value);
    
    if (!targetVar) {
        document.getElementById('optimizationTitle').textContent = 'Select target variable for optimization analysis';
        document.getElementById('optimizationSubtitle').textContent = '';
        return;
    }
    
    // Calculate correlations with target variable
    const correlations = {};
    const targetValues = data.map(d => d[targetVar]).filter(v => typeof v === 'number' && !isNaN(v));
    
    variables.forEach(variable => {
        if (variable === targetVar || variable === 'Date') return;
        
        const varValues = data.map(d => d[variable]).filter(v => typeof v === 'number' && !isNaN(v));
        if (varValues.length === targetValues.length && varValues.length > 1) {
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
        document.getElementById('optimizationTitle').textContent = 
            `No correlations ≥ ${minCorr} found for ${targetVar}`;
        document.getElementById('optimizationSubtitle').textContent = '';
    }
}

// Handle correlation variable button selection
function selectCorrelationVariable(variable, targetVar, buttonElement) {
    // Remove active class from all buttons
    document.querySelectorAll('.correlation-button').forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    buttonElement.classList.add('active');
    
    // Update the chart with selected variable
    createOptimizationScatter(targetVar, variable);
}

// Display correlation matrix as interactive buttons
function displayCorrelationMatrix(correlations, targetVar) {
    const container = document.getElementById('correlationMatrix');
    
    if (Object.keys(correlations).length === 0) {
        container.innerHTML = '<p>No significant correlations found with current threshold.</p>';
        return;
    }
    
    const sortedCorr = Object.entries(correlations).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    
    let html = '<div>';
    sortedCorr.forEach(([variable, corr], index) => {
        const direction = corr > 0 ? '↗️' : '↘️';
        const isFirst = index === 0; // First (strongest) correlation is active by default
        const activeClass = isFirst ? 'active' : '';
        
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
    html += '</div>';
    
    container.innerHTML = html;
    
    // Auto-select the first (strongest) correlation for the graph
    if (sortedCorr.length > 0) {
        const strongestVar = sortedCorr[0][0];
        createOptimizationScatter(targetVar, strongestVar);
    }
}

// Create optimization scatter plot
function createOptimizationScatter(targetVar, strongestVar) {
    const chartData = data.map(d => ({
        x: d[strongestVar],
        y: d[targetVar]
    })).filter(point => 
        typeof point.x === 'number' && typeof point.y === 'number' &&
        !isNaN(point.x) && !isNaN(point.y)
    );
    
    if (chartData.length === 0) {
        showNotification('No valid data points found for optimization chart', 'warning');
        return;
    }
    
    // Calculate linear regression for trend line
    const xValues = chartData.map(d => d.x);
    const yValues = chartData.map(d => d.y);
    const regression = calculateLinearRegression(xValues, yValues);
    
    // Create trend line points across data range
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const trendLineData = [
        { x: minX, y: regression.slope * minX + regression.intercept },
        { x: maxX, y: regression.slope * maxX + regression.intercept }
    ];
    
    // Destroy existing chart
    if (optimizationChart) {
        optimizationChart.destroy();
    }
    
    const ctx = document.getElementById('optimizationChart').getContext('2d');
    optimizationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${targetVar} vs ${strongestVar}`,
                data: chartData,
                backgroundColor: 'rgba(220, 38, 38, 0.6)',
                borderColor: 'rgba(220, 38, 38, 1)',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                showLine: false
            }, {
                label: 'Trend Line',
                data: trendLineData,
                backgroundColor: 'transparent',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 3,
                borderDash: [8, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                showLine: true,
                fill: false,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    filter: function(tooltipItem) {
                        // Hide tooltip for trend line
                        return tooltipItem.datasetIndex === 0;
                    },
                    callbacks: {
                        label: function(context) {
                            const x = formatValue(context.parsed.x, strongestVar);
                            const y = formatValue(context.parsed.y, targetVar);
                            return `(${x}, ${y})`;
                        }
                    }
                },
                ...getZoomConfig()
            },
            scales: {
                x: {
                    display: true,
                    title: { 
                        display: true, 
                        text: `${strongestVar}${units[strongestVar] ? ` (${units[strongestVar]})` : ''}` 
                    },
                    ticks: {
                        callback: function(value) {
                            return formatValue(value, strongestVar);
                        }
                    }
                },
                y: {
                    display: true,
                    title: { 
                        display: true, 
                        text: `${targetVar}${units[targetVar] ? ` (${units[targetVar]})` : ''}` 
                    },
                    ticks: {
                        callback: function(value) {
                            return formatValue(value, targetVar);
                        }
                    }
                }
            }
        }
    });
    
    // Update title with correlation and R² values
    const correlation = calculateCorrelation(xValues, yValues);
    const xUnit = units[strongestVar] ? ` (${units[strongestVar]})` : '';
    const yUnit = units[targetVar] ? ` (${units[targetVar]})` : '';
    document.getElementById('optimizationTitle').textContent = 
        `${targetVar}${yUnit} vs ${strongestVar}${xUnit}`;
    
    // Create subtitle with correlation info
    const subtitleElement = document.getElementById('optimizationSubtitle');
    if (subtitleElement) {
        subtitleElement.textContent = `R = ${correlation.toFixed(3)} • R² = ${regression.r2.toFixed(3)}`;
    }
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
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
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

// Get zoom configuration for charts
function getZoomConfig() {
    return {
        zoom: {
            wheel: {
                enabled: true,
            },
            pinch: {
                enabled: true
            },
            mode: 'xy',
            drag: {
                enabled: true,
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderColor: 'rgba(102, 126, 234, 0.5)',
                borderWidth: 1
            },
            onZoom: function({chart}) {
                // Optional: Add custom behavior on zoom
            }
        },
        pan: {
            enabled: true,
            mode: 'xy',
            onPan: function({chart}) {
                // Optional: Add custom behavior on pan
            }
        },
        limits: {
            y: {min: 'original', max: 'original'},
            x: {min: 'original', max: 'original'}
        }
    };
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Make functions globally available
window.switchTab = switchTab;
window.updateCorrelationChart = updateCorrelationChart;
window.updateTimeSeriesChart = updateTimeSeriesChart;
window.updateDistributionChart = updateDistributionChart;
window.updateOptimizationChart = updateOptimizationChart;
window.selectCorrelationVariable = selectCorrelationVariable;