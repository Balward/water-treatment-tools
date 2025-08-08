// Global variables
let streamingData = null;
let variables = [];
let units = {};

// Chart instances
let correlationChart = null;
let timeSeriesChart = null;
let histogramChart = null;
let optimizationChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    showNotification('Welcome! Click "Load Data" to import your streaming current data and access the analysis tools.', 'success');
});

// Tab switching functionality
function switchAnalysisTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadStreamingCurrentData() {
    try {
        showNotification('Loading streaming current data...', 'success');
        
        // Load the Excel file from the data folder
        const response = await fetch('../../data/Streaming_Current_Data.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        
        // Parse the Excel file
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header processing
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        if (jsonData.length < 3) {
            throw new Error('Data file must have at least 3 rows (variable names, units, values)');
        }
        
        // Process the data structure: Row 1 = variable names, Row 2 = units, Row 3+ = data
        const variableNames = jsonData[0];
        const unitRow = jsonData[1];
        const dataRows = jsonData.slice(2);
        
        // Build variables array and units object
        variables = [];
        units = {};
        
        variableNames.forEach((variable, index) => {
            if (variable && variable.toString().trim()) {
                const cleanVar = variable.toString().trim();
                variables.push(cleanVar);
                
                // Handle units - some variables like "Date" may not have units
                const unitValue = unitRow && unitRow[index] ? unitRow[index].toString().trim() : '';
                units[cleanVar] = unitValue;
            }
        });
        
        // Process data rows
        streamingData = dataRows.filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== '')).map(row => {
            const dataPoint = {};
            variableNames.forEach((variable, index) => {
                if (variable && variable.toString().trim()) {
                    const cleanVar = variable.toString().trim();
                    const value = row[index];
                    
                    // Handle different data types appropriately
                    if (value !== null && value !== undefined && value !== '') {
                        if (typeof value === 'number') {
                            dataPoint[cleanVar] = value;
                        } else if (typeof value === 'string') {
                            // Try to parse as number, but keep as string if it fails (for dates, text, etc.)
                            const numValue = parseFloat(value);
                            dataPoint[cleanVar] = !isNaN(numValue) ? numValue : value.toString();
                        } else {
                            dataPoint[cleanVar] = value;
                        }
                    } else {
                        dataPoint[cleanVar] = 0; // Default for missing numeric values
                    }
                }
            });
            return dataPoint;
        });
        
        // Update UI
        populateAllSelectors();
        displayDataInfo();
        showAnalysisInterface();
        setDefaultSelections();
        
        showNotification(`Data loaded successfully! ${streamingData.length} data points with ${variables.length} variables.`, 'success');
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

function populateAllSelectors() {
    // Get all select elements
    const selectors = [
        'corrXAxis', 'corrYAxis', 'corrColorBy',
        'timeVar', 'distVariable', 'targetVariable'
    ];
    
    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return;
        
        // Clear existing options
        if (selectorId === 'corrColorBy') {
            select.innerHTML = '<option value="">No Grouping</option>';
        } else {
            select.innerHTML = '<option value="">Select Variable...</option>';
        }
        
        // Add variable options
        variables.forEach(variable => {
            const unitText = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = `${variable}${unitText}`;
            select.appendChild(option);
        });
    });
    
    // Populate time series checkboxes
    populateTimeSeriesVariables();
}

function populateTimeSeriesVariables() {
    const container = document.getElementById('timeSeriesVariables');
    container.innerHTML = '';
    
    variables.forEach(variable => {
        const label = document.createElement('label');
        const unitText = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
        label.innerHTML = `
            <input type="checkbox" value="${variable}">
            ${variable}${unitText}
        `;
        container.appendChild(label);
    });
}

function displayDataInfo() {
    const dataInfo = document.getElementById('dataInfo');
    
    const timeVariable = variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
    let duration = '';
    if (timeVariable && streamingData.length > 0) {
        const timeValues = streamingData.map(d => d[timeVariable]).filter(v => typeof v === 'number');
        if (timeValues.length > 0) {
            const maxTime = Math.max(...timeValues);
            const minTime = Math.min(...timeValues);
            duration = `Duration: ${(maxTime - minTime).toFixed(1)} ${units[timeVariable] || 'units'}`;
        }
    }
    
    dataInfo.innerHTML = `
        <h3>📊 Dataset Information</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div>
                <strong>Data Points:</strong> ${streamingData.length.toLocaleString()}
            </div>
            <div>
                <strong>Variables:</strong> ${variables.length}
            </div>
            ${duration ? `<div><strong>${duration}</strong></div>` : ''}
        </div>
        <div style="margin-top: 1rem;">
            <strong>Available Variables:</strong>
            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${variables.map(v => `<span style="background: #e0f2fe; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${v}</span>`).join('')}
            </div>
        </div>
    `;
}

function showAnalysisInterface() {
    document.getElementById('quickStartSection').style.display = 'none';
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('analysisContainer').style.display = 'block';
    document.getElementById('exportPdfHeader').disabled = false;
}

function setDefaultSelections() {
    // Find Streaming Current and Alum Dose variables
    const streamingCurrentVar = variables.find(v => v.toLowerCase().includes('streaming current') || v.toLowerCase().includes('streaming_current'));
    const alumDoseVar = variables.find(v => v.toLowerCase().includes('alum') && v.toLowerCase().includes('dose'));
    const timeVar = variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
    
    // Set defaults for correlation analysis
    if (streamingCurrentVar && alumDoseVar) {
        document.getElementById('corrXAxis').value = alumDoseVar;
        document.getElementById('corrYAxis').value = streamingCurrentVar;
        updateCorrelationChart();
    }
    
    // Set defaults for time series
    if (timeVar) {
        document.getElementById('timeVar').value = timeVar;
        // Auto-select Streaming Current and Alum Dose for time series
        const checkboxes = document.querySelectorAll('#timeSeriesVariables input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (cb.value === streamingCurrentVar || cb.value === alumDoseVar) {
                cb.checked = true;
            }
        });
        updateTimeSeriesChart();
    }
    
    // Set defaults for distribution
    if (streamingCurrentVar) {
        document.getElementById('distVariable').value = streamingCurrentVar;
        updateDistributionChart();
    }
    
    // Set defaults for optimization
    if (streamingCurrentVar) {
        document.getElementById('targetVariable').value = streamingCurrentVar;
        updateOptimizationInsights();
    }
}

// Parameter Correlation Analysis
function updateCorrelationChart() {
    const xAxis = document.getElementById('corrXAxis').value;
    const yAxis = document.getElementById('corrYAxis').value;
    const colorBy = document.getElementById('corrColorBy').value;
    
    if (!xAxis || !yAxis || !streamingData) {
        showNotification('Please select both X and Y axis variables.', 'warning');
        return;
    }
    
    let datasets = [];
    
    if (colorBy && colorBy !== '') {
        // Group data by color variable
        const groups = groupDataByVariable(streamingData, colorBy);
        const colors = generateColors(Object.keys(groups).length);
        
        Object.entries(groups).forEach(([groupKey, groupData], index) => {
            datasets.push(createScatterDataset(`${colorBy}: ${groupKey}`, groupData, xAxis, yAxis, colors[index]));
        });
    } else {
        // Single dataset
        datasets.push(createScatterDataset(`${yAxis} vs ${xAxis}`, streamingData, xAxis, yAxis, '#2563eb'));
    }
    
    const ctx = document.getElementById('correlationChart').getContext('2d');
    
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    correlationChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: getScatterChartOptions(xAxis, yAxis)
    });
    
    // Update title
    const xUnit = units[xAxis] && units[xAxis].trim() ? ` (${units[xAxis]})` : '';
    const yUnit = units[yAxis] && units[yAxis].trim() ? ` (${units[yAxis]})` : '';
    document.getElementById('correlationTitle').textContent = `${yAxis}${yUnit} vs ${xAxis}${xUnit}`;
    
    showNotification('Correlation chart updated successfully!', 'success');
}

// Time Series Analysis
function updateTimeSeriesChart() {
    const timeVar = document.getElementById('timeVar').value;
    const checkedVars = Array.from(document.querySelectorAll('#timeSeriesVariables input:checked')).map(cb => cb.value);
    
    if (!timeVar || checkedVars.length === 0) {
        showNotification('Please select a time variable and at least one variable to plot.', 'warning');
        return;
    }
    
    const colors = generateColors(checkedVars.length);
    const datasets = checkedVars.map((variable, index) => ({
        label: `${variable}${units[variable] && units[variable].trim() ? ` (${units[variable]})` : ''}`,
        data: streamingData.map(point => ({
            x: point[timeVar],
            y: point[variable]
        })).filter(point => typeof point.x === 'number' && typeof point.y === 'number'),
        borderColor: colors[index],
        backgroundColor: colors[index] + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 1,
        pointHoverRadius: 4
    }));
    
    const ctx = document.getElementById('timeSeriesChart').getContext('2d');
    
    if (timeSeriesChart) {
        timeSeriesChart.destroy();
    }
    
    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: getTimeSeriesChartOptions(timeVar)
    });
    
    const timeUnit = units[timeVar] && units[timeVar].trim() ? ` (${units[timeVar]})` : '';
    document.getElementById('timeSeriesTitle').textContent = `Variables over ${timeVar}${timeUnit}`;
    
    showNotification(`Time series chart updated with ${checkedVars.length} variables!`, 'success');
}

// Distribution Analysis
function updateDistributionChart() {
    const variable = document.getElementById('distVariable').value;
    const bins = parseInt(document.getElementById('distBins').value);
    
    if (!variable) {
        showNotification('Please select a variable to analyze.', 'warning');
        return;
    }
    
    const values = streamingData.map(d => d[variable]).filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) {
        showNotification('No numeric data found for selected variable.', 'error');
        return;
    }
    
    // Calculate histogram
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    const binLabels = [];
    
    for (let i = 0; i < bins; i++) {
        const binStart = min + i * binWidth;
        const binEnd = min + (i + 1) * binWidth;
        binLabels.push(`${binStart.toFixed(2)} - ${binEnd.toFixed(2)}`);
    }
    
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
        histogram[binIndex]++;
    });
    
    const ctx = document.getElementById('histogramChart').getContext('2d');
    
    if (histogramChart) {
        histogramChart.destroy();
    }
    
    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: 'Frequency',
                data: histogram,
                backgroundColor: '#2563eb80',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: getHistogramChartOptions(variable)
    });
    
    // Update statistics
    displayDistributionStats(values, variable);
    
    const unit = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
    document.getElementById('histogramTitle').textContent = `Distribution of ${variable}${unit}`;
    
    showNotification('Distribution chart updated successfully!', 'success');
}

function displayDistributionStats(values, variable) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
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
        q3: sorted[Math.floor(n * 0.75)],
        cv: (stdDev / mean) * 100
    };
    
    const unit = units[variable] && units[variable].trim() ? ` ${units[variable]}` : '';
    
    document.getElementById('distributionStats').innerHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <div><strong>Count:</strong> ${stats.count}</div>
            <div><strong>Mean:</strong> ${stats.mean.toFixed(3)}${unit}</div>
            <div><strong>Median:</strong> ${stats.median.toFixed(3)}${unit}</div>
            <div><strong>Std Dev:</strong> ${stats.stdDev.toFixed(3)}${unit}</div>
            <div><strong>Min:</strong> ${stats.min.toFixed(3)}${unit}</div>
            <div><strong>Max:</strong> ${stats.max.toFixed(3)}${unit}</div>
            <div><strong>Q1:</strong> ${stats.q1.toFixed(3)}${unit}</div>
            <div><strong>Q3:</strong> ${stats.q3.toFixed(3)}${unit}</div>
            <div><strong>CV:</strong> ${stats.cv.toFixed(1)}%</div>
        </div>
    `;
}

// Optimization Insights
function updateOptimizationInsights() {
    const targetVar = document.getElementById('targetVariable').value;
    const minCorr = parseFloat(document.getElementById('minCorrelation').value);
    
    if (!targetVar) {
        showNotification('Please select a target variable for optimization.', 'warning');
        return;
    }
    
    // Calculate correlations with target variable
    const correlations = {};
    const targetValues = streamingData.map(d => d[targetVar]).filter(v => typeof v === 'number' && !isNaN(v));
    
    variables.forEach(variable => {
        if (variable === targetVar) return;
        
        const varValues = streamingData.map(d => d[variable]).filter(v => typeof v === 'number' && !isNaN(v));
        if (varValues.length === targetValues.length && varValues.length > 1) {
            const correlation = calculatePearsonCorrelation(targetValues, varValues);
            if (Math.abs(correlation) >= minCorr) {
                correlations[variable] = correlation;
            }
        }
    });
    
    // Display correlation matrix
    displayCorrelationMatrix(correlations, targetVar);
    
    // Create optimization chart with strongest correlation
    const strongestCorr = Object.entries(correlations).reduce((max, [variable, corr]) => 
        Math.abs(corr) > Math.abs(max.corr) ? { var: variable, corr } : max, 
        { var: null, corr: 0 }
    );
    
    if (strongestCorr.var) {
        createOptimizationChart(targetVar, strongestCorr.var);
        showNotification(`Found ${Object.keys(correlations).length} variables with correlation ≥ ${minCorr}`, 'success');
    } else {
        showNotification(`No variables found with correlation ≥ ${minCorr}. Try lowering the threshold.`, 'warning');
    }
}

function displayCorrelationMatrix(correlations, targetVar) {
    const container = document.getElementById('correlationMatrix');
    
    if (Object.keys(correlations).length === 0) {
        container.innerHTML = '<p>No significant correlations found with the current threshold.</p>';
        return;
    }
    
    const sortedCorrelations = Object.entries(correlations).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    
    let html = '<div style="font-size: 0.9rem;">';
    sortedCorrelations.forEach(([variable, corr]) => {
        const strength = Math.abs(corr) > 0.7 ? 'Strong' : Math.abs(corr) > 0.5 ? 'Moderate' : 'Weak';
        const color = Math.abs(corr) > 0.7 ? '#059669' : Math.abs(corr) > 0.5 ? '#d97706' : '#6b7280';
        const direction = corr > 0 ? '↗️' : '↘️';
        
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 4px; border-left: 4px solid ${color};">
                <span style="font-weight: 500;">${variable}</span>
                <span style="color: ${color}; font-weight: bold; display: flex; align-items: center; gap: 0.25rem;">
                    ${direction} ${corr.toFixed(3)}
                </span>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function createOptimizationChart(targetVar, strongestVar) {
    const data = streamingData.map(point => ({
        x: point[strongestVar],
        y: point[targetVar]
    })).filter(point => typeof point.x === 'number' && typeof point.y === 'number');
    
    const ctx = document.getElementById('optimizationChart').getContext('2d');
    
    if (optimizationChart) {
        optimizationChart.destroy();
    }
    
    optimizationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${targetVar} vs ${strongestVar}`,
                data: data,
                backgroundColor: '#dc262680',
                borderColor: '#dc2626',
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: getScatterChartOptions(strongestVar, targetVar)
    });
    
    const xUnit = units[strongestVar] && units[strongestVar].trim() ? ` (${units[strongestVar]})` : '';
    const yUnit = units[targetVar] && units[targetVar].trim() ? ` (${units[targetVar]})` : '';
    document.getElementById('optimizationTitle').textContent = `${targetVar}${yUnit} vs ${strongestVar}${xUnit} (Strongest Correlation)`;
}

// Utility functions
function groupDataByVariable(data, variable) {
    const groups = {};
    data.forEach(dataPoint => {
        const value = dataPoint[variable];
        const key = typeof value === 'number' ? Math.round(value * 100) / 100 : value.toString();
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(dataPoint);
    });
    return groups;
}

function createScatterDataset(label, data, xAxis, yAxis, color) {
    return {
        label: label,
        data: data.map(point => ({
            x: point[xAxis],
            y: point[yAxis]
        })).filter(point => typeof point.x === 'number' && typeof point.y === 'number'),
        backgroundColor: color + '80',
        borderColor: color,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
    };
}

function generateColors(count) {
    const colors = [
        '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
        '#be185d', '#0891b2', '#65a30d', '#ea580c', '#9333ea'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

function getScatterChartOptions(xAxis, yAxis) {
    const xUnit = units[xAxis] && units[xAxis].trim() ? ` (${units[xAxis]})` : '';
    const yUnit = units[yAxis] && units[yAxis].trim() ? ` (${units[yAxis]})` : '';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' }
        },
        scales: {
            x: {
                display: true,
                title: { display: true, text: `${xAxis}${xUnit}` }
            },
            y: {
                display: true,
                title: { display: true, text: `${yAxis}${yUnit}` }
            }
        }
    };
}

function getTimeSeriesChartOptions(timeVar) {
    const timeUnit = units[timeVar] && units[timeVar].trim() ? ` (${units[timeVar]})` : '';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' }
        },
        scales: {
            x: {
                display: true,
                title: { display: true, text: `${timeVar}${timeUnit}` }
            },
            y: {
                display: true,
                title: { display: true, text: 'Values (Various Units)' }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false
        }
    };
}

function getHistogramChartOptions(variable) {
    const unit = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                display: true,
                title: { display: true, text: `${variable}${unit} Range` }
            },
            y: {
                display: true,
                title: { display: true, text: 'Frequency' },
                beginAtZero: true
            }
        }
    };
}

function calculatePearsonCorrelation(x, y) {
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

function generatePdfReport() {
    showNotification('PDF export functionality coming soon!', 'warning');
}

function openHelp() {
    document.getElementById('helpModal').style.display = 'flex';
}

function closeHelp() {
    document.getElementById('helpModal').style.display = 'none';
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Make functions globally available for HTML onclick handlers
window.loadStreamingCurrentData = loadStreamingCurrentData;
window.switchAnalysisTab = switchAnalysisTab;
window.updateCorrelationChart = updateCorrelationChart;
window.updateTimeSeriesChart = updateTimeSeriesChart;
window.updateDistributionChart = updateDistributionChart;
window.updateOptimizationInsights = updateOptimizationInsights;
window.generatePdfReport = generatePdfReport;
window.openHelp = openHelp;
window.closeHelp = closeHelp;