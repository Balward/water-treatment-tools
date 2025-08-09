// Global variables
let streamingData = null;
let variables = [];
let units = {};
let variableLocations = {};

// Chart instances
let correlationChart = null;
let timeSeriesChart = null;
let histogramChart = null;
let optimizationChart = null;

// Initialize the application - wait for all resources to load
window.addEventListener('load', function() {
    // Hide quick start section immediately
    document.getElementById('quickStartSection').style.display = 'none';
    
    // Additional delay to ensure smooth loading animation display
    setTimeout(() => {
        loadVariableLocations().then(() => {
            loadStreamingCurrentData();
        }).catch(error => {
            console.warn('Could not load variable locations:', error);
            loadStreamingCurrentData(); // Continue without locations
        });
    }, 1200); // Give enough time for animations to be visible
});

// Load variable locations mapping
async function loadVariableLocations() {
    try {
        const response = await fetch('variable-locations.json');
        const data = await response.json();
        variableLocations = data.locations || {};
        console.log('Variable locations loaded:', variableLocations);
    } catch (error) {
        console.warn('Failed to load variable locations:', error);
        variableLocations = {};
    }
}

// Utility function for proper decimal formatting based on units
function formatValue(value, unit) {
    if (typeof value !== 'number' || isNaN(value)) return value;
    
    const unitLower = (unit || '').toLowerCase();
    
    // 3 decimals for turbidity (NTU) and flow (MGD)
    if (unitLower.includes('ntu') || unitLower.includes('mgd')) {
        return value.toFixed(3);
    }
    
    // Default to appropriate decimal places for other units
    if (Math.abs(value) < 0.01) {
        return value.toFixed(4);
    } else if (Math.abs(value) < 1) {
        return value.toFixed(3);
    } else if (Math.abs(value) < 100) {
        return value.toFixed(2);
    } else {
        return value.toFixed(1);
    }
}

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
        updateLoadingProgress(10, 'Fetching data file...');
        
        // Load the Excel file from the data folder
        const response = await fetch('../../data/Streaming_Current_Data.xlsx');
        updateLoadingProgress(30, 'Reading Excel file...');
        
        const arrayBuffer = await response.arrayBuffer();
        updateLoadingProgress(50, 'Parsing spreadsheet data...');
        
        // Parse the Excel file
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        updateLoadingProgress(70, 'Processing variables and units...');
        
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
        
        // Process data rows - filter out completely empty rows
        streamingData = dataRows.map(row => {
            if (!row || row.length === 0) return null;
            
            // Check if row has any meaningful data
            const hasData = row.some(cell => cell !== null && cell !== undefined && cell !== '');
            if (!hasData) return null;
            
            const dataPoint = {};
            let hasActualValues = false;
            
            variableNames.forEach((variable, index) => {
                if (variable && variable.toString().trim()) {
                    const cleanVar = variable.toString().trim();
                    const value = row[index];
                    
                    // Handle different data types appropriately
                    if (value !== null && value !== undefined && value !== '') {
                        hasActualValues = true;
                        if (typeof value === 'number') {
                            dataPoint[cleanVar] = value;
                        } else if (typeof value === 'string' && value.trim() !== '') {
                            // Try to parse as number, but keep as string if it fails (for dates, text, etc.)
                            const numValue = parseFloat(value.trim());
                            dataPoint[cleanVar] = !isNaN(numValue) ? numValue : value.toString();
                        } else {
                            dataPoint[cleanVar] = value;
                        }
                    } else {
                        // Leave blank/missing values as undefined (don't default to 0)
                        dataPoint[cleanVar] = undefined;
                    }
                }
            });
            
            // Only return dataPoint if it has at least one actual value
            return hasActualValues ? dataPoint : null;
        }).filter(dataPoint => dataPoint !== null);
        
        updateLoadingProgress(85, 'Initializing analysis interface...');
        
        // Update UI
        populateAllSelectors();
        showAnalysisInterface();
        
        updateLoadingProgress(95, 'Setting up default charts...');
        setDefaultSelections();
        
        updateLoadingProgress(100, 'Complete! Ready for analysis.');
        
        // Count total individual cell values
        const totalCellValues = streamingData.reduce((total, row) => {
            return total + variables.reduce((rowTotal, variable) => {
                const value = row[variable];
                return rowTotal + (value !== undefined && value !== null && value !== '' ? 1 : 0);
            }, 0);
        }, 0);
        
        // Store the cell count for display (no longer needed as we calculate it in displayDataInfo)
        // window.totalCellValues = totalCellValues;
        
        // Hide loading screen after a brief delay
        setTimeout(() => {
            hideLoadingScreen();
            // No notification on first load - user can see the data info panel
        }, 800);
        
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoadingScreen();
        showNotification('Error loading data: ' + error.message, 'error');
    }
}

function updateLoadingProgress(targetPercentage, text) {
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
        loadingText.textContent = text;
    }
    
    if (progressFill) {
        const currentWidth = parseInt(progressFill.style.width) || 0;
        const increment = (targetPercentage - currentWidth) / 20; // Smooth animation over 20 steps
        
        let currentStep = 0;
        const animate = () => {
            if (currentStep < 20) {
                const newWidth = Math.min(currentWidth + (increment * currentStep), targetPercentage);
                progressFill.style.width = newWidth + '%';
                currentStep++;
                setTimeout(animate, 30); // 30ms between steps
            }
        };
        
        animate();
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        // Remove from DOM after transition
        setTimeout(() => {
            if (loadingScreen.parentNode) {
                loadingScreen.parentNode.removeChild(loadingScreen);
            }
        }, 500);
    }
}

function populateAllSelectors() {
    // Get all select elements
    const selectors = [
        'corrXAxis', 'corrYAxis', 'corrColorBy',
        'timeVar', 'timeVar1', 'timeVar2', 'timeVar3', 'timeVar4',
        'distVariable', 'targetVariable'
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
}

function getSelectedTimeSeriesVariables() {
    const variables = [];
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`timeVar${i}`);
        if (select && select.value && select.value.trim() !== '') {
            variables.push(select.value);
        }
    }
    return variables;
}


function showAnalysisInterface() {
    document.getElementById('quickStartSection').style.display = 'none';
    document.getElementById('analysisContainer').style.display = 'block';
    document.getElementById('exportPdfHeader').disabled = false;
}

function setDefaultSelections() {
    // Find Streaming Current and Alum Dose variables
    const streamingCurrentVar = variables.find(v => v.toLowerCase().includes('streaming current') || v.toLowerCase().includes('streaming_current'));
    const alumDoseVar = variables.find(v => v.toLowerCase().includes('alum') && v.toLowerCase().includes('dose'));
    // Prioritize "Date" first, then time/sec variables
    const timeVar = variables.find(v => v.toLowerCase().includes('date')) || 
                   variables.find(v => v.toLowerCase().includes('time') || v.toLowerCase().includes('sec'));
    
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
        if (streamingCurrentVar) {
            document.getElementById('timeVar1').value = streamingCurrentVar;
        }
        if (alumDoseVar) {
            document.getElementById('timeVar2').value = alumDoseVar;
        }
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
            // Clean up the label - remove units from individual range labels since they'll be in legend title
            let cleanLabel = groupKey;
            if (units[colorBy] && units[colorBy].trim()) {
                const unitPattern = new RegExp(`\\s*${units[colorBy].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
                cleanLabel = groupKey.replace(unitPattern, '');
            }
            datasets.push(createScatterDataset(cleanLabel, groupData, xAxis, yAxis, colors[index]));
        });
    } else {
        // Single dataset
        datasets.push(createScatterDataset(`${yAxis} vs ${xAxis}`, streamingData, xAxis, yAxis, '#2563eb'));
    }
    
    const ctx = document.getElementById('correlationChart').getContext('2d');
    
    if (correlationChart) {
        correlationChart.destroy();
    }
    
    const chartOptions = getScatterChartOptions(xAxis, yAxis);
    
    // Add custom legend title if using color grouping
    if (colorBy && colorBy !== '') {
        const colorUnit = units[colorBy] && units[colorBy].trim() ? ` (${units[colorBy]})` : '';
        chartOptions.plugins.legend.title = {
            display: true,
            text: `Grouped by ${colorBy}${colorUnit}`,
            font: {
                size: 14,
                weight: 'bold'
            },
            padding: {
                bottom: 10
            }
        };
    }
    
    correlationChart = new Chart(ctx, {
        type: 'bubble',
        data: { datasets: datasets },
        options: chartOptions
    });
    
    // Update title
    const xUnit = units[xAxis] && units[xAxis].trim() ? ` (${units[xAxis]})` : '';
    const yUnit = units[yAxis] && units[yAxis].trim() ? ` (${units[yAxis]})` : '';
    document.getElementById('correlationTitle').textContent = `${yAxis}${yUnit} vs ${xAxis}${xUnit}`;
}

// Time Series Analysis
function updateTimeSeriesChart() {
    try {
        const timeVar = document.getElementById('timeVar').value;
        const selectedVars = getSelectedTimeSeriesVariables();
        
        if (!timeVar) {
            showNotification('Please select a time variable.', 'warning');
            return;
        }
        
        if (selectedVars.length === 0) {
            showNotification('Please select at least one variable to plot.', 'warning');
            return;
        }
        
        console.log('Time variable:', timeVar);
        console.log('Selected variables:', selectedVars);
        
        const colors = generateColors(selectedVars.length);
        const datasets = [];
        
        selectedVars.forEach((variable, index) => {
            const dataPoints = streamingData.map(point => {
                let xValue = point[timeVar];
                let yValue = point[variable];
                
                // Skip if either value is undefined/null
                if (xValue === undefined || xValue === null || yValue === undefined || yValue === null) {
                    return null;
                }
                
                // Handle Date data - convert to Date object if it's a date string
                if (timeVar.toLowerCase().includes('date') && typeof xValue === 'string' && xValue.trim() !== '') {
                    // Try parsing as MM/DD/YYYY or similar formats first
                    let dateSuccess = false;
                    const dateFormats = [
                        // Try MM/DD/YYYY format
                        () => {
                            const parts = xValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                            if (parts) {
                                const date = new Date(parts[3], parts[1] - 1, parts[2], 12, 0, 0); // Set to noon to avoid timezone issues
                                return !isNaN(date.getTime()) ? date : null;
                            }
                            return null;
                        },
                        // Try YYYY-MM-DD format
                        () => {
                            const parts = xValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                            if (parts) {
                                const date = new Date(parts[1], parts[2] - 1, parts[3], 12, 0, 0); // Set to noon
                                return !isNaN(date.getTime()) ? date : null;
                            }
                            return null;
                        },
                        // Try MM-DD-YYYY format
                        () => {
                            const parts = xValue.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
                            if (parts) {
                                const date = new Date(parts[3], parts[1] - 1, parts[2], 12, 0, 0); // Set to noon
                                return !isNaN(date.getTime()) ? date : null;
                            }
                            return null;
                        }
                    ];
                    
                    for (const formatParser of dateFormats) {
                        const parsed = formatParser();
                        if (parsed) {
                            xValue = parsed;
                            dateSuccess = true;
                            break;
                        }
                    }
                    
                    // Fallback to native Date parsing if custom formats don't work
                    if (!dateSuccess) {
                        const parsedDate = new Date(xValue + ' 12:00:00'); // Add noon time to avoid timezone issues
                        if (!isNaN(parsedDate.getTime())) {
                            xValue = parsedDate;
                        }
                    }
                }
                
                return { x: xValue, y: yValue };
            }).filter(point => {
                if (!point) return false;
                
                const validX = (point.x instanceof Date && !isNaN(point.x.getTime())) || 
                              (typeof point.x === 'number' && !isNaN(point.x) && isFinite(point.x));
                const validY = typeof point.y === 'number' && !isNaN(point.y) && isFinite(point.y);
                
                return validX && validY;
            });
            
            console.log(`Variable ${variable} has ${dataPoints.length} valid data points`);
            
            if (dataPoints.length > 0) {
                datasets.push({
                    label: `${variable}${units[variable] && units[variable].trim() ? ` (${units[variable]})` : ''}`,
                    data: dataPoints,
                    borderColor: colors[index],
                    backgroundColor: colors[index] + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 1,
                    pointHoverRadius: 4
                });
            }
        });
        
        if (datasets.length === 0) {
            showNotification('No valid data found for the selected variables.', 'error');
            return;
        }
        
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
        
    } catch (error) {
        console.error('Error updating time series chart:', error);
        showNotification('Error updating time series chart: ' + error.message, 'error');
    }
}

// Calculate optimal number of bins based on data characteristics
function calculateOptimalBins(values) {
    const n = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // If range is very small (tight data), use fewer bins
    if (range < 0.1) {
        return Math.max(3, Math.min(8, Math.ceil(n / 20)));
    }
    
    // Standard methods for bin calculation
    // Sturges' rule: bins = 1 + log2(n)
    const sturges = Math.ceil(1 + Math.log2(n));
    
    // Square root choice: bins = sqrt(n)
    const sqrt = Math.ceil(Math.sqrt(n));
    
    // Freedman-Diaconis rule: binWidth = 2 * IQR / n^(1/3)
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1 = sortedValues[Math.floor(n * 0.25)];
    const q3 = sortedValues[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const fd = iqr > 0 ? Math.ceil(range / (2 * iqr / Math.pow(n, 1/3))) : sqrt;
    
    // Use the median of the three methods, constrained to reasonable bounds
    const bins = [sturges, sqrt, fd].sort((a, b) => a - b)[1]; // median
    
    // Constrain between 3 and 20 bins
    return Math.max(3, Math.min(20, bins));
}

// Distribution Analysis
function updateDistributionChart() {
    const variable = document.getElementById('distVariable').value;
    const binSetting = document.getElementById('distBins').value;
    
    if (!variable) {
        showNotification('Please select a variable to analyze.', 'warning');
        return;
    }
    
    const values = streamingData.map(d => d[variable]).filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) {
        showNotification('No numeric data found for selected variable.', 'error');
        return;
    }
    
    // Calculate dynamic number of bins based on data characteristics
    let bins;
    if (binSetting === 'auto') {
        bins = calculateOptimalBins(values);
        console.log(`Auto-calculated ${bins} bins for ${variable} (range: ${(Math.max(...values) - Math.min(...values)).toFixed(4)})`);
    } else {
        bins = parseInt(binSetting);
    }
    
    // Calculate histogram
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binWidth = range / bins;
    const histogram = new Array(bins).fill(0);
    const binLabels = [];
    
    // Determine actual decimal precision from the data
    function getDataPrecision(values) {
        let maxDecimals = 0;
        values.forEach(value => {
            const str = value.toString();
            const decimalIndex = str.indexOf('.');
            if (decimalIndex !== -1) {
                const decimals = str.length - decimalIndex - 1;
                maxDecimals = Math.max(maxDecimals, decimals);
            }
        });
        return Math.min(maxDecimals, 4); // Cap at 4 decimals max
    }
    
    const precision = getDataPrecision(values);
    console.log(`Detected ${precision} decimal places for ${variable}`);
    
    for (let i = 0; i < bins; i++) {
        const binStart = min + i * binWidth;
        const binEnd = min + (i + 1) * binWidth;
        // Use precise formatting for tight ranges
        const startStr = binStart.toFixed(precision);
        const endStr = binEnd.toFixed(precision);
        binLabels.push(`${startStr} - ${endStr}`);
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
    const unitStr = units[variable] && units[variable].trim() ? units[variable] : '';
    
    document.getElementById('distributionStats').innerHTML = `
        <div style="font-size: 0.9rem; line-height: 1.6;">
            <div><strong>Count:</strong> ${stats.count}</div>
            <div><strong>Mean:</strong> ${formatValue(stats.mean, unitStr)}${unit}</div>
            <div><strong>Median:</strong> ${formatValue(stats.median, unitStr)}${unit}</div>
            <div><strong>Std Dev:</strong> ${formatValue(stats.stdDev, unitStr)}${unit}</div>
            <div><strong>Min:</strong> ${formatValue(stats.min, unitStr)}${unit}</div>
            <div><strong>Max:</strong> ${formatValue(stats.max, unitStr)}${unit}</div>
            <div><strong>Q1:</strong> ${formatValue(stats.q1, unitStr)}${unit}</div>
            <div><strong>Q3:</strong> ${formatValue(stats.q3, unitStr)}${unit}</div>
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
    const values = data.map(d => d[variable]).filter(v => v !== undefined && v !== null);
    
    // Check if all values are numeric
    const numericValues = values.filter(v => typeof v === 'number');
    
    if (numericValues.length === 0) {
        // Non-numeric data - group by exact value
        const groups = {};
        data.forEach(dataPoint => {
            const value = dataPoint[variable];
            const key = value ? value.toString() : 'Unknown';
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(dataPoint);
        });
        return groups;
    }
    
    // For numeric data, determine grouping strategy
    const uniqueValues = [...new Set(numericValues)].sort((a, b) => a - b);
    
    if (uniqueValues.length <= 5) {
        // Few unique values - group by exact value
        const groups = {};
        data.forEach(dataPoint => {
            const value = dataPoint[variable];
            if (typeof value === 'number') {
                const key = formatValue(value, units[variable]);
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(dataPoint);
            }
        });
        return groups;
    } else {
        // Many unique values - create ranges
        const min = Math.min(...uniqueValues);
        const max = Math.max(...uniqueValues);
        const range = max - min;
        
        // Determine number of groups (3-6 based on data distribution)
        let numGroups;
        if (uniqueValues.length > 50) {
            numGroups = 6;
        } else if (uniqueValues.length > 20) {
            numGroups = 5;
        } else {
            numGroups = 4;
        }
        
        const groupSize = range / numGroups;
        const groups = {};
        
        // Create group labels
        for (let i = 0; i < numGroups; i++) {
            const rangeStart = min + (i * groupSize);
            const rangeEnd = min + ((i + 1) * groupSize);
            const unit = units[variable] && units[variable].trim() ? ` ${units[variable]}` : '';
            
            let label;
            if (i === numGroups - 1) {
                // Last group includes max value
                label = `${formatValue(rangeStart, units[variable])} - ${formatValue(max, units[variable])}${unit}`;
            } else {
                label = `${formatValue(rangeStart, units[variable])} - ${formatValue(rangeEnd, units[variable])}${unit}`;
            }
            groups[label] = [];
        }
        
        // Assign data points to groups
        data.forEach(dataPoint => {
            const value = dataPoint[variable];
            if (typeof value === 'number') {
                let groupIndex = Math.floor((value - min) / groupSize);
                // Handle edge case where value equals max
                if (groupIndex >= numGroups) {
                    groupIndex = numGroups - 1;
                }
                
                const rangeStart = min + (groupIndex * groupSize);
                const rangeEnd = groupIndex === numGroups - 1 ? max : min + ((groupIndex + 1) * groupSize);
                const unit = units[variable] && units[variable].trim() ? ` ${units[variable]}` : '';
                
                let label;
                if (groupIndex === numGroups - 1) {
                    label = `${formatValue(rangeStart, units[variable])} - ${formatValue(max, units[variable])}${unit}`;
                } else {
                    label = `${formatValue(rangeStart, units[variable])} - ${formatValue(rangeEnd, units[variable])}${unit}`;
                }
                
                groups[label].push(dataPoint);
            }
        });
        
        return groups;
    }
}

function createScatterDataset(label, data, xAxis, yAxis, color) {
    // First, filter and map the valid points
    const validPoints = data.map(point => ({
        x: point[xAxis],
        y: point[yAxis]
    })).filter(point => typeof point.x === 'number' && typeof point.y === 'number');
    
    // Group points by their x,y coordinates to count duplicates
    const pointCounts = {};
    validPoints.forEach(point => {
        // Round to avoid floating point precision issues
        const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
        if (!pointCounts[key]) {
            pointCounts[key] = { x: point.x, y: point.y, count: 0 };
        }
        pointCounts[key].count++;
    });
    
    // Convert to bubble chart data format with variable radius
    const bubbleData = Object.values(pointCounts).map(point => ({
        x: point.x,
        y: point.y,
        r: Math.max(3, Math.min(15, 3 + point.count * 2)), // Radius between 3-15 based on count
        count: point.count // Store the actual count for tooltip
    }));
    
    return {
        label: label,
        data: bubbleData,
        backgroundColor: color + '80',
        borderColor: color,
        borderWidth: 2,
        pointRadius: function(context) {
            return context.parsed ? (context.parsed.r || 4) : 4;
        },
        pointHoverRadius: function(context) {
            const baseRadius = context.parsed ? (context.parsed.r || 4) : 4;
            return baseRadius + 2;
        }
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
    
    // Calculate buffer zones based on data range
    const xValues = streamingData.map(d => d[xAxis]).filter(v => typeof v === 'number' && !isNaN(v));
    const yValues = streamingData.map(d => d[yAxis]).filter(v => typeof v === 'number' && !isNaN(v));
    
    let xAxisConfig = {
        display: true,
        title: { display: true, text: `${xAxis}${xUnit}` }
    };
    
    let yAxisConfig = {
        display: true,
        title: { display: true, text: `${yAxis}${yUnit}` }
    };
    
    // Add buffer zones (10% of range on each side)
    if (xValues.length > 0) {
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const xRange = xMax - xMin;
        const xBuffer = xRange * 0.1;
        
        // Check if this is a Streaming Current variable (can have negative values)
        const isStreamingCurrentX = xAxis.toLowerCase().includes('streaming current') || xAxis.toLowerCase().includes('streaming_current');
        
        // For Streaming Current, always use full buffer. For others, don't go below zero.
        xAxisConfig.min = isStreamingCurrentX ? xMin - xBuffer : Math.max(0, xMin - xBuffer);
        xAxisConfig.max = xMax + xBuffer;
    }
    
    if (yValues.length > 0) {
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const yRange = yMax - yMin;
        const yBuffer = yRange * 0.1;
        
        // Check if this is a Streaming Current variable (can have negative values)
        const isStreamingCurrentY = yAxis.toLowerCase().includes('streaming current') || yAxis.toLowerCase().includes('streaming_current');
        
        // For Streaming Current, always use full buffer. For others, don't go below zero.
        yAxisConfig.min = isStreamingCurrentY ? yMin - yBuffer : Math.max(0, yMin - yBuffer);
        yAxisConfig.max = yMax + yBuffer;
    }
    
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const xValue = formatValue(context.parsed.x, units[xAxis]);
                        const yValue = formatValue(context.parsed.y, units[yAxis]);
                        const count = context.raw.count || 1; // Get count from the raw data
                        const countText = count > 1 ? ` (${count} data points)` : '';
                        return `(${xValue}, ${yValue})${countText}`;
                    },
                    title: function(context) {
                        if (context.length > 0) {
                            return context[0].dataset.label;
                        }
                        return '';
                    }
                },
                displayColors: true,
                titleAlign: 'center'
            }
        },
        scales: {
            x: xAxisConfig,
            y: yAxisConfig
        }
    };
}

function getTimeSeriesChartOptions(timeVar) {
    const timeUnit = units[timeVar] && units[timeVar].trim() ? ` (${units[timeVar]})` : '';
    const isDateVariable = timeVar.toLowerCase().includes('date');
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        // Get the variable name from the dataset label
                        const datasetLabel = context.dataset.label;
                        const variableName = datasetLabel.split(' (')[0]; // Extract variable name before unit
                        const unit = Object.keys(units).find(key => datasetLabel.includes(key)) ? units[Object.keys(units).find(key => datasetLabel.includes(key))] : '';
                        
                        const value = formatValue(context.parsed.y, unit);
                        return `${datasetLabel}: ${value}`;
                    }
                }
            }
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
    
    // Configure time scale for date variables
    if (isDateVariable) {
        options.scales.x.type = 'time';
        options.scales.x.time = {
            displayFormats: {
                hour: 'MMM DD, HH:mm',
                day: 'MMM DD',
                week: 'MMM DD',
                month: 'MMM YYYY'
            }
        };
    }
    
    return options;
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
    }, 2000);
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