// Global variables
let streamingData = null;
let variables = [];
let units = {};
let currentChart = null;
let multiChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    showNotification('Welcome! Click "Load Data" to import your streaming current data.', 'success');
});

function setupEventListeners() {
    // Chart configuration listeners
    document.getElementById('xAxisSelect').addEventListener('change', validateChartInputs);
    document.getElementById('yAxisSelect').addEventListener('change', validateChartInputs);
    document.getElementById('timeFilter').addEventListener('change', handleTimeFilterChange);
    
    // Custom time range listeners
    document.getElementById('startPercent').addEventListener('input', updatePercentageDisplay);
    document.getElementById('endPercent').addEventListener('input', updatePercentageDisplay);
    
    // Chart type change listener
    document.getElementById('chartType').addEventListener('change', function() {
        if (currentChart) {
            updateChart();
        }
    });
    
    // Color by change listener
    document.getElementById('colorBy').addEventListener('change', function() {
        if (currentChart) {
            updateChart();
        }
    });
}

function handleTimeFilterChange() {
    const timeFilter = document.getElementById('timeFilter').value;
    const customTimeRange = document.getElementById('customTimeRange');
    
    if (timeFilter === 'custom') {
        customTimeRange.style.display = 'block';
    } else {
        customTimeRange.style.display = 'none';
    }
    
    if (currentChart) {
        updateChart();
    }
}

function updatePercentageDisplay() {
    const startPercent = document.getElementById('startPercent');
    const endPercent = document.getElementById('endPercent');
    
    document.getElementById('startPercentValue').textContent = startPercent.value + '%';
    document.getElementById('endPercentValue').textContent = endPercent.value + '%';
    
    // Ensure start is always less than end
    if (parseInt(startPercent.value) >= parseInt(endPercent.value)) {
        endPercent.value = Math.min(100, parseInt(startPercent.value) + 1);
        document.getElementById('endPercentValue').textContent = endPercent.value + '%';
    }
    
    if (currentChart) {
        updateChart();
    }
}

function validateChartInputs() {
    const xAxis = document.getElementById('xAxisSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const updateBtn = document.getElementById('updateChartBtn');
    
    updateBtn.disabled = !xAxis || !yAxis;
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
        populateVariableSelectors();
        displayDataInfo();
        showDataSections();
        
        showNotification(`Data loaded successfully! ${streamingData.length} data points with ${variables.length} variables.`, 'success');
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

function populateVariableSelectors() {
    const xAxisSelect = document.getElementById('xAxisSelect');
    const yAxisSelect = document.getElementById('yAxisSelect');
    const colorBySelect = document.getElementById('colorBy');
    
    // Clear existing options
    [xAxisSelect, yAxisSelect, colorBySelect].forEach(select => {
        select.innerHTML = select === colorBySelect ? '<option value="">No Grouping</option>' : '<option value="">Select Variable...</option>';
    });
    
    // Add variable options
    variables.forEach(variable => {
        const unitText = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
        const optionText = `${variable}${unitText}`;
        
        [xAxisSelect, yAxisSelect, colorBySelect].forEach(select => {
            const option = document.createElement('option');
            option.value = variable;
            option.textContent = optionText;
            select.appendChild(option);
        });
    });
    
    // Set default selections if available
    if (variables.length > 0) {
        // Try to set time as X-axis if available
        const timeVariable = variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
        if (timeVariable) {
            xAxisSelect.value = timeVariable;
        }
        
        // Set first non-time variable as Y-axis
        const nonTimeVariable = variables.find(v => !v.toLowerCase().includes('time') && !v.toLowerCase().includes('sec'));
        if (nonTimeVariable) {
            yAxisSelect.value = nonTimeVariable;
        }
        
        validateChartInputs();
    }
    
    // Populate multi-variable checkboxes
    populateMultiVariableCheckboxes();
}

function populateMultiVariableCheckboxes() {
    const checkboxContainer = document.getElementById('variableCheckboxes');
    checkboxContainer.innerHTML = '';
    
    variables.forEach(variable => {
        const label = document.createElement('label');
        const unitText = units[variable] && units[variable].trim() ? ` (${units[variable]})` : '';
        label.innerHTML = `
            <input type="checkbox" value="${variable}">
            ${variable}${unitText}
        `;
        checkboxContainer.appendChild(label);
    });
}

function displayDataInfo() {
    const dataInfo = document.getElementById('dataInfo');
    
    const timeVariable = variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
    let duration = '';
    if (timeVariable && streamingData.length > 0) {
        const maxTime = Math.max(...streamingData.map(d => d[timeVariable]));
        const minTime = Math.min(...streamingData.map(d => d[timeVariable]));
        duration = `Duration: ${(maxTime - minTime).toFixed(1)} ${units[timeVariable] || 'units'}`;
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
            <div>
                <strong>${duration}</strong>
            </div>
        </div>
        <div style="margin-top: 1rem;">
            <strong>Available Variables:</strong>
            <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${variables.map(v => `<span style="background: #e0f2fe; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${v}</span>`).join('')}
            </div>
        </div>
    `;
}

function showDataSections() {
    document.getElementById('infoPanel').style.display = 'block';
    document.getElementById('chartConfig').style.display = 'block';
    document.getElementById('statisticsSection').style.display = 'block';
    document.getElementById('multiChartSection').style.display = 'block';
    document.getElementById('exportPdfHeader').disabled = false;
}

function getFilteredData() {
    if (!streamingData) return [];
    
    const timeFilter = document.getElementById('timeFilter').value;
    let filteredData = [...streamingData];
    
    if (timeFilter !== 'all') {
        const dataLength = streamingData.length;
        let startIndex = 0;
        let endIndex = dataLength;
        
        switch (timeFilter) {
            case 'first30':
                endIndex = Math.min(dataLength, Math.floor(dataLength * 0.5));
                break;
            case 'last30':
                startIndex = Math.max(0, Math.floor(dataLength * 0.5));
                break;
            case 'custom':
                const startPercent = parseInt(document.getElementById('startPercent').value) / 100;
                const endPercent = parseInt(document.getElementById('endPercent').value) / 100;
                startIndex = Math.floor(dataLength * startPercent);
                endIndex = Math.floor(dataLength * endPercent);
                break;
        }
        
        filteredData = streamingData.slice(startIndex, endIndex);
    }
    
    return filteredData;
}

function updateChart() {
    const xAxis = document.getElementById('xAxisSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const chartType = document.getElementById('chartType').value;
    const colorBy = document.getElementById('colorBy').value;
    
    if (!xAxis || !yAxis || !streamingData) {
        return;
    }
    
    const filteredData = getFilteredData();
    
    // Prepare chart data
    let datasets = [];
    
    if (colorBy && colorBy !== '') {
        // Group data by color variable
        const groups = groupDataByVariable(filteredData, colorBy);
        const colors = generateColors(Object.keys(groups).length);
        
        Object.entries(groups).forEach(([groupKey, groupData], index) => {
            datasets.push(createDataset(`${colorBy}: ${groupKey}`, groupData, xAxis, yAxis, chartType, colors[index]));
        });
    } else {
        // Single dataset
        datasets.push(createDataset(`${yAxis} vs ${xAxis}`, filteredData, xAxis, yAxis, chartType, '#2563eb'));
    }
    
    // Update chart
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
        type: chartType === 'line' ? 'line' : (chartType === 'bar' ? 'bar' : 'scatter'),
        data: { datasets: datasets },
        options: getChartOptions(xAxis, yAxis, chartType)
    });
    
    // Update title
    const xUnit = units[xAxis] && units[xAxis].trim() ? ` (${units[xAxis]})` : '';
    const yUnit = units[yAxis] && units[yAxis].trim() ? ` (${units[yAxis]})` : '';
    document.getElementById('chartTitle').textContent = `${yAxis}${yUnit} vs ${xAxis}${xUnit}`;
    
    // Show chart container
    document.getElementById('mainChartContainer').style.display = 'block';
    
    // Update statistics
    updateStatistics(filteredData, [xAxis, yAxis]);
}

function groupDataByVariable(data, variable) {
    const groups = {};
    
    data.forEach(dataPoint => {
        const value = dataPoint[variable];
        const key = typeof value === 'number' ? 
            Math.round(value * 100) / 100 : // Round to 2 decimal places for grouping
            value.toString();
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(dataPoint);
    });
    
    return groups;
}

function createDataset(label, data, xAxis, yAxis, chartType, color) {
    const chartData = data.map(point => ({
        x: point[xAxis],
        y: point[yAxis]
    }));
    
    return {
        label: label,
        data: chartData,
        backgroundColor: chartType === 'bar' ? color : color + '80',
        borderColor: color,
        borderWidth: 2,
        fill: false,
        tension: chartType === 'line' ? 0.1 : 0,
        pointRadius: chartType === 'scatter' ? 4 : 2,
        pointHoverRadius: 6
    };
}

function generateColors(count) {
    const baseColors = [
        '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
        '#be185d', '#0891b2', '#65a30d', '#ea580c', '#9333ea'
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
}

function getChartOptions(xAxis, yAxis, chartType) {
    const xUnit = units[xAxis] && units[xAxis].trim() ? ` (${units[xAxis]})` : '';
    const yUnit = units[yAxis] && units[yAxis].trim() ? ` (${units[yAxis]})` : '';
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                mode: 'nearest',
                intersect: false,
            }
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: `${xAxis}${xUnit}`
                }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: `${yAxis}${yUnit}`
                }
            }
        },
        interaction: {
            mode: 'nearest',
            intersect: false,
        }
    };
}

function updateStatistics(data, variables) {
    const stats = {};
    
    variables.forEach(variable => {
        const values = data.map(d => d[variable]).filter(v => !isNaN(v) && isFinite(v));
        if (values.length > 0) {
            values.sort((a, b) => a - b);
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            
            stats[variable] = {
                count: values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                mean: mean,
                median: values[Math.floor(values.length / 2)],
                stdDev: Math.sqrt(variance),
                q1: values[Math.floor(values.length * 0.25)],
                q3: values[Math.floor(values.length * 0.75)]
            };
        }
    });
    
    displayStatistics(stats);
    calculateCorrelations(data, variables);
}

function displayStatistics(stats) {
    const statsContainer = document.getElementById('variableStats');
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">';
    
    Object.entries(stats).forEach(([variable, stat]) => {
        const unit = units[variable] && units[variable].trim() ? ` ${units[variable]}` : '';
        html += `
            <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h4 style="color: #2563eb; margin-bottom: 0.5rem;">${variable}</h4>
                <div style="font-size: 0.9rem; line-height: 1.4;">
                    <div><strong>Count:</strong> ${stat.count}</div>
                    <div><strong>Mean:</strong> ${stat.mean.toFixed(3)}${unit}</div>
                    <div><strong>Median:</strong> ${stat.median.toFixed(3)}${unit}</div>
                    <div><strong>Std Dev:</strong> ${stat.stdDev.toFixed(3)}${unit}</div>
                    <div><strong>Range:</strong> ${stat.min.toFixed(3)} - ${stat.max.toFixed(3)}${unit}</div>
                    <div><strong>IQR:</strong> ${stat.q1.toFixed(3)} - ${stat.q3.toFixed(3)}${unit}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    statsContainer.innerHTML = html;
}

function calculateCorrelations(data, selectedVars) {
    if (selectedVars.length < 2) return;
    
    const correlations = {};
    
    for (let i = 0; i < selectedVars.length; i++) {
        for (let j = i + 1; j < selectedVars.length; j++) {
            const var1 = selectedVars[i];
            const var2 = selectedVars[j];
            
            const pairs = data.map(d => [d[var1], d[var2]])
                              .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]) && isFinite(pair[0]) && isFinite(pair[1]));
            
            if (pairs.length > 1) {
                const correlation = calculatePearsonCorrelation(pairs);
                correlations[`${var1} vs ${var2}`] = correlation;
            }
        }
    }
    
    displayCorrelations(correlations);
}

function calculatePearsonCorrelation(pairs) {
    const n = pairs.length;
    const sumX = pairs.reduce((sum, pair) => sum + pair[0], 0);
    const sumY = pairs.reduce((sum, pair) => sum + pair[1], 0);
    const sumXY = pairs.reduce((sum, pair) => sum + pair[0] * pair[1], 0);
    const sumX2 = pairs.reduce((sum, pair) => sum + pair[0] * pair[0], 0);
    const sumY2 = pairs.reduce((sum, pair) => sum + pair[1] * pair[1], 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

function displayCorrelations(correlations) {
    const corrContainer = document.getElementById('correlationMatrix');
    
    if (Object.keys(correlations).length === 0) {
        corrContainer.innerHTML = '<p>Select at least 2 variables to see correlations.</p>';
        return;
    }
    
    let html = '<div style="font-size: 0.9rem;">';
    
    Object.entries(correlations).forEach(([pair, corr]) => {
        const strength = Math.abs(corr) > 0.7 ? 'Strong' : Math.abs(corr) > 0.5 ? 'Moderate' : 'Weak';
        const color = Math.abs(corr) > 0.7 ? '#059669' : Math.abs(corr) > 0.5 ? '#d97706' : '#6b7280';
        
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: #f8fafc; border-radius: 4px;">
                <span>${pair}</span>
                <span style="color: ${color}; font-weight: bold;">
                    ${corr.toFixed(3)} (${strength})
                </span>
            </div>
        `;
    });
    
    html += '</div>';
    corrContainer.innerHTML = html;
}

function generateMultiChart() {
    const checkboxes = document.querySelectorAll('#variableCheckboxes input[type="checkbox"]:checked');
    const selectedVars = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedVars.length < 2) {
        showNotification('Please select at least 2 variables for comparison.', 'warning');
        return;
    }
    
    const filteredData = getFilteredData();
    const colors = generateColors(selectedVars.length);
    
    // Find a time variable for x-axis, or use data index
    const timeVariable = variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
    
    const datasets = selectedVars.map((variable, index) => ({
        label: `${variable}${units[variable] && units[variable].trim() ? ` (${units[variable]})` : ''}`,
        data: filteredData.map(point => ({
            x: timeVariable ? point[timeVariable] : filteredData.indexOf(point),
            y: point[variable]
        })),
        borderColor: colors[index],
        backgroundColor: colors[index] + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.1
    }));
    
    const ctx = document.getElementById('multiChart').getContext('2d');
    
    if (multiChart) {
        multiChart.destroy();
    }
    
    multiChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Multi-Variable Comparison'
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: timeVariable ? `${timeVariable}${units[timeVariable] && units[timeVariable].trim() ? ` (${units[timeVariable]})` : ''}` : 'Data Point Index'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Values (Various Units)'
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            }
        }
    });
    
    showNotification(`Multi-variable chart generated with ${selectedVars.length} variables.`, 'success');
}

function resetChart() {
    document.getElementById('xAxisSelect').value = '';
    document.getElementById('yAxisSelect').value = '';
    document.getElementById('chartType').value = 'scatter';
    document.getElementById('colorBy').value = '';
    document.getElementById('timeFilter').value = 'all';
    document.getElementById('customTimeRange').style.display = 'none';
    
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
    
    document.getElementById('mainChartContainer').style.display = 'none';
    document.getElementById('variableStats').innerHTML = '';
    document.getElementById('correlationMatrix').innerHTML = '';
    
    validateChartInputs();
}

function generatePdfReport() {
    // This would generate a PDF report with charts and statistics
    // Implementation would depend on the jsPDF library capabilities
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
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}