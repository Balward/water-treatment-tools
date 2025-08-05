let temperatureData = [];
let mwatResults = [];
let dailyMaxResults = [];
let dischargePeriods = [];

console.log('Script loaded - Updated version with new Daily Max table format');

// Log management functions
function showLogContainer() {
    const logContainer = document.getElementById('logContainer');
    logContainer.classList.remove('hidden');
}

function addLogMessage(message, type = 'info') {
    const messagesDiv = document.getElementById('messages');
    const timestamp = new Date().toLocaleTimeString();
    
    let iconAndClass;
    switch(type) {
        case 'success':
            iconAndClass = {
                icon: '✅',
                bgClass: 'bg-green-50 border-l-4 border-green-400',
                textClass: 'text-green-800',
                iconClass: 'text-green-600'
            };
            break;
        case 'error':
            iconAndClass = {
                icon: '❌',
                bgClass: 'bg-red-50 border-l-4 border-red-400',
                textClass: 'text-red-800',
                iconClass: 'text-red-600'
            };
            break;
        case 'warning':
            iconAndClass = {
                icon: '⚠️',
                bgClass: 'bg-amber-50 border-l-4 border-amber-400',
                textClass: 'text-amber-800',
                iconClass: 'text-amber-600'
            };
            break;
        case 'info':
        default:
            iconAndClass = {
                icon: 'ℹ️',
                bgClass: 'bg-blue-50 border-l-4 border-blue-400',
                textClass: 'text-blue-800',
                iconClass: 'text-blue-600'
            };
            break;
    }
    
    const logEntry = document.createElement('div');
    logEntry.className = `${iconAndClass.bgClass} p-4 rounded-lg transition-all duration-300 animate-slide-up`;
    logEntry.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-lg ${iconAndClass.iconClass}">${iconAndClass.icon}</span>
            <div class="flex-1">
                <div class="${iconAndClass.textClass} font-medium">${message}</div>
                <div class="text-gray-500 text-xs mt-1">${timestamp}</div>
            </div>
        </div>
    `;
    
    messagesDiv.appendChild(logEntry);
    showLogContainer();
    
    // Auto-scroll to bottom
    setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
}

function clearLog() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';
    const logContainer = document.getElementById('logContainer');
    logContainer.classList.add('hidden');
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('file1').addEventListener('change', function() { 
        updateFileDisplay('file1'); 
        checkFiles(); 
    });
    
    // Initialize Flatpickr date pickers
    flatpickr("#startDate", {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        allowInput: true,
        clickOpens: true,
        placeholder: "Select start date..."
    });
    
    flatpickr("#endDate", {
        dateFormat: "Y-m-d", 
        altInput: true,
        altFormat: "F j, Y",
        allowInput: true,
        clickOpens: true,
        placeholder: "Select end date..."
    });
});

function updateFileDisplay(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    const wrapper = document.getElementById(fileInputId + '-wrapper');
    const display = wrapper.querySelector('.file-input-display');
    const textElement = display.querySelector('.file-input-text');
    const subtextElement = display.querySelector('.file-input-subtext');
    const iconElement = display.querySelector('.file-input-icon');
    
    if (fileInput.files.length > 0) {
        wrapper.classList.remove('border-gray-300', 'hover:border-primary-400', 'hover:bg-primary-50/50');
        wrapper.classList.add('border-green-400', 'bg-green-50/50');
        
        if (fileInput.files.length === 1) {
            textElement.textContent = fileInput.files[0].name;
            subtextElement.textContent = `File selected (${formatFileSize(fileInput.files[0].size)})`;
        } else {
            textElement.textContent = `${fileInput.files.length} files selected`;
            subtextElement.textContent = `Multiple files selected`;
        }
        iconElement.textContent = '✅';
        textElement.classList.add('text-green-700');
        subtextElement.classList.add('text-green-600');
    } else {
        wrapper.classList.remove('border-green-400', 'bg-green-50/50');
        wrapper.classList.add('border-gray-300', 'hover:border-primary-400', 'hover:bg-primary-50/50');
        
        textElement.textContent = 'Click to select file(s)';
        subtextElement.textContent = 'Continuous temperature monitoring data - select multiple files if needed';
        iconElement.textContent = '📁';
        textElement.classList.remove('text-green-700');
        subtextElement.classList.remove('text-green-600');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkFiles() {
    const fileInput = document.getElementById('file1');
    const processBtn = document.getElementById('processBtn');
    
    if (fileInput.files.length > 0) {
        processBtn.disabled = false;
    } else {
        processBtn.disabled = true;
    }
}

function addDischargePeriod() {
    const startInput = document.getElementById('dischargeStart');
    const endInput = document.getElementById('dischargeEnd');
    
    // Validate inputs
    if (!startInput.value || !endInput.value) {
        alert('Please enter both start and end dates for the discharge period.');
        return;
    }
    
    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);
    
    if (startDate >= endDate) {
        alert('End date must be after start date.');
        return;
    }
    
    // Add to discharge periods array
    const periodIndex = dischargePeriods.length;
    dischargePeriods.push({
        index: periodIndex,
        start: startDate,
        end: endDate,
        startString: startInput.value,
        endString: endInput.value
    });
    
    // Create display item
    const container = document.getElementById('dischargePeriods');
    const listDiv = document.getElementById('dischargeList');
    
    const periodDiv = document.createElement('div');
    periodDiv.className = 'bg-white/80 rounded-xl p-4 border border-amber-200 flex items-center justify-between transition-all duration-300 hover:shadow-md';
    periodDiv.id = `dischargePeriod${periodIndex}`;
    
    periodDiv.innerHTML = `
        <div class="flex-1">
            <div class="font-bold text-amber-700 mb-1">Discharge Period ${periodIndex + 1}</div>
            <div class="text-amber-600 text-sm">${startDate.toLocaleString()} - ${endDate.toLocaleString()}</div>
        </div>
        <button class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105" onclick="removeDischargePeriod(${periodIndex})">
            🗑️ Remove
        </button>
    `;
    
    container.appendChild(periodDiv);
    
    // Show the list and clear inputs
    listDiv.classList.remove('hidden');
    startInput.value = '';
    endInput.value = '';
    
    // Update button text
    const addButton = document.querySelector('.add-period-btn');
    addButton.textContent = 'Add Another Discharge Period';
}

function removeDischargePeriod(periodIndex) {
    const periodDiv = document.getElementById(`dischargePeriod${periodIndex}`);
    if (periodDiv) {
        periodDiv.remove();
        dischargePeriods = dischargePeriods.filter(p => p.index !== periodIndex);
        
        // Update period titles
        updateDischargePeriodTitles();
        
        // Hide list if empty
        if (dischargePeriods.length === 0) {
            document.getElementById('dischargeList').classList.add('hidden');
        }
    }
}

function updateDischargePeriodTitles() {
    const container = document.getElementById('dischargePeriods');
    const periods = container.children;
    
    Array.from(periods).forEach((period, index) => {
        const title = period.querySelector('.font-bold');
        if (title) {
            title.textContent = `Discharge Period ${index + 1}`;
        }
    });
}

function parseDateTime(dateStr) {
    // Parse MM/DD/YY HH:MM:SS AM/PM format
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1];
    const ampm = parts[2];
    
    const [month, day, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    
    let hour24 = parseInt(hours);
    if (ampm === 'PM' && hour24 !== 12) {
        hour24 += 12;
    } else if (ampm === 'AM' && hour24 === 12) {
        hour24 = 0;
    }
    
    const fullYear = 2000 + parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
}

function parseCSV(text) {
    const lines = text.split('\n');
    const data = [];
    
    // Skip header rows and start from row 3 (index 2)
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length >= 3) {
            const dateTimeStr = columns[1].replace(/"/g, '');
            const tempStr = columns[2].replace(/"/g, '');
            
            if (dateTimeStr && tempStr) {
                try {
                    const dateTime = parseDateTime(dateTimeStr);
                    const temperature = parseFloat(tempStr);
                    
                    if (!isNaN(temperature) && dateTime.getTime()) {
                        data.push({
                            dateTime: dateTime,
                            temperature: temperature,
                            originalString: dateTimeStr
                        });
                    }
                } catch (e) {
                    console.warn('Error parsing row:', line, e);
                }
            }
        }
    }
    
    return data;
}

function combineMultipleFiles(allData) {
    const combined = {};
    
    // Combine all data, averaging if timestamps match
    allData.forEach(data => {
        data.forEach(row => {
            const timeKey = row.dateTime.getTime();
            if (combined[timeKey]) {
                combined[timeKey].temperatures.push(row.temperature);
                combined[timeKey].count++;
            } else {
                combined[timeKey] = {
                    dateTime: row.dateTime,
                    temperatures: [row.temperature],
                    count: 1
                };
            }
        });
    });
    
    // Calculate averages and create final dataset
    const result = Object.values(combined).map(item => ({
        dateTime: item.dateTime,
        temperature: item.temperatures.reduce((sum, temp) => sum + temp, 0) / item.temperatures.length,
        count: item.count,
        wasAveraged: item.count > 1
    }));
    
    // Sort by date
    result.sort((a, b) => a.dateTime - b.dateTime);
    
    return result;
}

function filterByDateRange(data, startDate, endDate) {
    if (!startDate && !endDate) return data;
    
    return data.filter(row => {
        const rowTime = row.dateTime.getTime();
        
        // Start date: 00:00:00 (beginning of day)
        let start = 0;
        if (startDate) {
            const startDateTime = new Date(startDate + 'T00:00:00');
            start = startDateTime.getTime();
        }
        
        // End date: 23:59:59.999 (end of day)
        let end = Infinity;
        if (endDate) {
            const endDateTime = new Date(endDate + 'T23:59:59.999');
            end = endDateTime.getTime();
        }
        
        return rowTime >= start && rowTime <= end;
    });
}

function filterByDischargePeriods(data) {
    if (dischargePeriods.length === 0) return data;
    
    return data.filter(row => {
        const rowTime = row.dateTime.getTime();
        return dischargePeriods.some(period => 
            rowTime >= period.start.getTime() && rowTime <= period.end.getTime()
        );
    });
}

// DMR Guidance: Daily Maximum Temperature (DM)
// Highest 2-hour average water temperature measured by continuous recorder during a 24-hour period
function calculateDailyMaximum(data) {
    const dailyMaxResults = {};
    
    data.forEach((reading, index) => {
        const dateKey = reading.dateTime.toDateString();
        
        // Calculate 2-hour rolling average (need minimum 2 hours of data)
        const twoHourWindow = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        const windowStart = reading.dateTime.getTime();
        const windowEnd = windowStart + twoHourWindow;
        
        // Get all readings within 2-hour window starting from current reading
        const windowReadings = data.filter(r => 
            r.dateTime.getTime() >= windowStart && 
            r.dateTime.getTime() <= windowEnd
        );
        
        if (windowReadings.length >= 2) {
            const twoHourAverage = windowReadings.reduce((sum, r) => sum + r.temperature, 0) / windowReadings.length;
            
            if (!dailyMaxResults[dateKey] || twoHourAverage > dailyMaxResults[dateKey].temperature) {
                dailyMaxResults[dateKey] = {
                    date: new Date(reading.dateTime.getFullYear(), reading.dateTime.getMonth(), reading.dateTime.getDate()),
                    temperature: twoHourAverage,
                    readingCount: windowReadings.length,
                    timeRange: `${windowReadings[0].dateTime.toLocaleTimeString()} - ${windowReadings[windowReadings.length-1].dateTime.toLocaleTimeString()}`
                };
            }
        }
    });
    
    return Object.values(dailyMaxResults).sort((a, b) => a.date - b.date);
}

// DMR Guidance: Maximum Weekly Average Temperature (MWAT)
// Largest mathematical mean of multiple, equally spaced, daily temperatures over 7 consecutive days
// IMPORTANT: 7 consecutive days must be within the same discharge period - cannot span across gaps
function calculateMWAT(data) {
    // First, calculate daily averages
    const dailyAverages = {};
    
    data.forEach(reading => {
        const dateKey = reading.dateTime.toDateString();
        if (!dailyAverages[dateKey]) {
            dailyAverages[dateKey] = {
                date: new Date(reading.dateTime.getFullYear(), reading.dateTime.getMonth(), reading.dateTime.getDate()),
                temperatures: [],
                count: 0
            };
        }
        dailyAverages[dateKey].temperatures.push(reading.temperature);
        dailyAverages[dateKey].count++;
    });
    
    // Calculate average temperature for each day
    const dailyAvgArray = Object.values(dailyAverages).map(day => ({
        date: day.date,
        averageTemp: day.temperatures.reduce((sum, temp) => sum + temp, 0) / day.temperatures.length,
        readingCount: day.count
    })).sort((a, b) => a.date - b.date);
    
    const mwatResults = [];
    
    // If no discharge periods are specified, calculate MWAT for all consecutive days
    if (dischargePeriods.length === 0) {
        // Calculate 7-day rolling averages for consecutive calendar days
        for (let i = 6; i < dailyAvgArray.length; i++) {
            const sevenDayPeriod = dailyAvgArray.slice(i - 6, i + 1);
            
            // Check if these 7 days are actually consecutive (no gaps)
            let isConsecutive = true;
            for (let j = 1; j < sevenDayPeriod.length; j++) {
                const prevDate = sevenDayPeriod[j - 1].date;
                const currentDate = sevenDayPeriod[j].date;
                const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
                
                if (dayDiff !== 1) {
                    isConsecutive = false;
                    break;
                }
            }
            
            if (isConsecutive) {
                const weeklyAverage = sevenDayPeriod.reduce((sum, day) => sum + day.averageTemp, 0) / 7;
                
                mwatResults.push({
                    endDate: sevenDayPeriod[6].date,
                    startDate: sevenDayPeriod[0].date,
                    weeklyAverage: weeklyAverage,
                    dailyAverages: sevenDayPeriod.map(d => d.averageTemp)
                });
            }
        }
    } else {
        // Calculate MWAT only within individual discharge periods
        dischargePeriods.forEach(period => {
            // Get daily averages that fall within this discharge period
            const periodDays = dailyAvgArray.filter(day => {
                const dayTime = day.date.getTime();
                return dayTime >= period.start.getTime() && dayTime <= period.end.getTime();
            });
            
            // Only calculate MWAT if we have at least 7 consecutive days in this period
            if (periodDays.length >= 7) {
                // Check for consecutive days and calculate 7-day rolling averages
                for (let i = 6; i < periodDays.length; i++) {
                    const sevenDayPeriod = periodDays.slice(i - 6, i + 1);
                    
                    // Verify these 7 days are consecutive calendar days
                    let isConsecutive = true;
                    for (let j = 1; j < sevenDayPeriod.length; j++) {
                        const prevDate = sevenDayPeriod[j - 1].date;
                        const currentDate = sevenDayPeriod[j].date;
                        const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);
                        
                        if (dayDiff !== 1) {
                            isConsecutive = false;
                            break;
                        }
                    }
                    
                    if (isConsecutive) {
                        const weeklyAverage = sevenDayPeriod.reduce((sum, day) => sum + day.averageTemp, 0) / 7;
                        
                        mwatResults.push({
                            endDate: sevenDayPeriod[6].date,
                            startDate: sevenDayPeriod[0].date,
                            weeklyAverage: weeklyAverage,
                            dailyAverages: sevenDayPeriod.map(d => d.averageTemp),
                            dischargePeriod: `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`
                        });
                    }
                }
            }
        });
    }
    
    return mwatResults;
}

async function loadTestData() {
    clearLog();
    
    try {
        addLogMessage('Loading test data from UST1A CSV files...', 'info');
        
        // Paths to the test data files (relative to the root of the project)
        const testFiles = [
            '../../data/UST1A-03112025_2025-04-16_11_55_34_MDT_(Data_MDT).csv',
            '../../data/UST1A-04162025_2025-05-16_12_19_32_MDT_(Data_MDT).csv'
        ];
        
        const allData = [];
        
        for (const filePath of testFiles) {
            try {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`Failed to load ${filePath}: ${response.status}`);
                }
                const text = await response.text();
                const data = parseCSV(text);
                allData.push(data);
                addLogMessage(`Loaded ${data.length} records from ${filePath.split('/').pop()}`, 'success');
            } catch (error) {
                console.warn(`Error loading ${filePath}:`, error);
                addLogMessage(`Failed to load ${filePath.split('/').pop()}: ${error.message}`, 'error');
            }
        }
        
        if (allData.length === 0) {
            throw new Error('No test data files could be loaded');
        }
        
        // Combine and process the test data
        temperatureData = combineMultipleFiles(allData);
        
        // Update the file input display to show test data is loaded
        const wrapper = document.getElementById('file1-wrapper');
        const display = wrapper.querySelector('.file-input-display');
        const textElement = display.querySelector('.file-input-text');
        const subtextElement = display.querySelector('.file-input-subtext');
        const iconElement = display.querySelector('.file-input-icon');
        
        wrapper.classList.remove('border-gray-300', 'hover:border-primary-400', 'hover:bg-primary-50/50');
        wrapper.classList.add('border-secondary-400', 'bg-secondary-50/50');
        
        textElement.textContent = 'Test Data Loaded';
        subtextElement.textContent = `${allData.length} UST1A files loaded (${temperatureData.length} total records)`;
        iconElement.textContent = '🧪';
        textElement.classList.add('text-secondary-700');
        subtextElement.classList.add('text-secondary-600');
        
        // Enable the process button
        document.getElementById('processBtn').disabled = false;
        
        addLogMessage(`Test data loaded successfully! Combined ${temperatureData.length} temperature readings from ${allData.length} files.`, 'success');
        
    } catch (error) {
        addLogMessage(`Error loading test data: ${error.message}`, 'error');
    }
}

async function calculateMWATAndDailyMax() {
    const fileInput = document.getElementById('file1');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    clearLog();
    
    try {
        // Check if we already have test data loaded, otherwise read from files
        if (temperatureData.length === 0) {
            addLogMessage('Reading uploaded CSV files...', 'info');
            
            // Read all files
            const allData = [];
            for (let i = 0; i < fileInput.files.length; i++) {
                const text = await fileInput.files[i].text();
                const data = parseCSV(text);
                allData.push(data);
                addLogMessage(`Parsed ${data.length} records from ${fileInput.files[i].name}`, 'success');
            }
            
            // Combine all files
            temperatureData = combineMultipleFiles(allData);
            addLogMessage(`Combined data from ${allData.length} file(s) - ${temperatureData.length} total records`, 'success');
        } else {
            addLogMessage(`Using previously loaded data (${temperatureData.length} records)`, 'info');
        }
        
        // Filter by date range if specified
        let filteredData = filterByDateRange(temperatureData, startDate, endDate);
        if (startDate || endDate) {
            addLogMessage(`Applied date range filter - ${filteredData.length} records remain`, 'info');
        }
        
        // Filter by discharge periods
        filteredData = filterByDischargePeriods(filteredData);
        
        if (filteredData.length === 0) {
            throw new Error('No data found in the specified date range or discharge periods');
        }
        
        // Show discharge period filtering info
        if (dischargePeriods.length > 0) {
            addLogMessage(`Applied ${dischargePeriods.length} discharge period filter(s) - ${filteredData.length} records within discharge periods`, 'warning');
        }
        
        addLogMessage('Calculating Daily Maximum Temperature values...', 'info');
        // Calculate Daily Maximum Temperature
        dailyMaxResults = calculateDailyMaximum(filteredData);
        addLogMessage(`Calculated ${dailyMaxResults.length} Daily Maximum values`, 'success');
        
        addLogMessage('Calculating MWAT (7-day rolling averages)...', 'info');
        // Calculate MWAT
        mwatResults = calculateMWAT(filteredData);
        addLogMessage(`Calculated ${mwatResults.length} MWAT periods`, 'success');
        
        addLogMessage('Calculations completed successfully! Results displayed below.', 'success');
        
        // Display results
        displayMWATResults(filteredData, dailyMaxResults, mwatResults);
        
    } catch (error) {
        addLogMessage(`Error calculating MWAT and Daily Max: ${error.message}`, 'error');
    }
}

function displayMWATResults(rawData, dailyMax, mwat) {
    const resultsDiv = document.getElementById('results');
    const statsDiv = document.getElementById('stats');
    const tableDiv = document.getElementById('dataTable');
    
    // Find overall MWAT (highest weekly average)
    const overallMWAT = mwat.length > 0 ? Math.max(...mwat.map(w => w.weeklyAverage)) : 0;
    const overallDailyMax = dailyMax.length > 0 ? Math.max(...dailyMax.map(d => d.temperature)) : 0;
    
    const dateRange = rawData.length > 0 ? 
        `${rawData[0].dateTime.toLocaleDateString()} - ${rawData[rawData.length - 1].dateTime.toLocaleDateString()}` : 
        'N/A';
    
    statsDiv.innerHTML = `
        <h3 class="text-2xl font-bold text-green-800 mb-6 flex items-center gap-2">
            📊 DMR Calculation Results
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Column: MWAT -->
            <div class="space-y-4">
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 text-center">
                    <div class="text-4xl font-bold text-blue-700 mb-2">${overallMWAT.toFixed(3)}°C</div>
                    <div class="text-blue-600 font-semibold">Maximum Weekly Average Temperature (MWAT)</div>
                </div>
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200 text-center">
                    <div class="text-2xl font-bold text-gray-700 mb-1">${mwat.length}</div>
                    <div class="text-gray-600 font-semibold">7-Day MWAT Periods</div>
                </div>
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200 text-center">
                    <div class="text-2xl font-bold text-gray-700 mb-1">${rawData.length}</div>
                    <div class="text-gray-600 font-semibold">Total Temperature Readings</div>
                </div>
            </div>
            
            <!-- Right Column: Daily Maximum -->
            <div class="space-y-4">
                <div class="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl p-6 border border-orange-200 text-center">
                    <div class="text-4xl font-bold text-orange-700 mb-2">${overallDailyMax.toFixed(3)}°C</div>
                    <div class="text-orange-600 font-semibold">Highest Daily Maximum Temperature</div>
                </div>
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200 text-center">
                    <div class="text-2xl font-bold text-gray-700 mb-1">${dailyMax.length}</div>
                    <div class="text-gray-600 font-semibold">Days with Daily Maximum</div>
                </div>
                <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200 text-center">
                    <div class="text-xl font-bold text-gray-700 mb-1">${dateRange}</div>
                    <div class="text-gray-600 font-semibold">Date Range</div>
                </div>
            </div>
        </div>
    `;
    
    // Create results table showing top MWAT periods and daily maximums
    let tableHTML = `
        <div class="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-8 mb-8 border border-blue-200 shadow-2xl">
            <h3 class="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text mb-6 flex items-center gap-3">
                📈 Top MWAT Periods (7-Day Rolling Averages)
            </h3>
            <div class="overflow-hidden rounded-2xl shadow-lg bg-white border border-blue-100">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Period End Date</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">7-Day Period</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Weekly Average (°C)</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Show top 10 MWAT periods
    const topMWAT = [...mwat].sort((a, b) => b.weeklyAverage - a.weeklyAverage).slice(0, 10);
    topMWAT.forEach((period, index) => {
        const isHighest = index === 0;
        const rowClass = index % 2 === 0 ? 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50' : 'bg-white';
        const statusClass = isHighest 
            ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse' 
            : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md';
        const statusText = isHighest ? '🏆 MWAT VALUE' : '📊 Weekly Avg';
        const tempClass = isHighest ? 'text-2xl font-black text-transparent bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text' : 'text-xl font-bold text-blue-700';
        
        tableHTML += `
            <tr class="${rowClass} hover:bg-gradient-to-r hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 border-b border-blue-100/50">
                <td class="px-6 py-4 font-semibold text-gray-800">${period.endDate.toLocaleDateString()}</td>
                <td class="px-6 py-4 text-gray-600 font-medium">${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}</td>
                <td class="px-6 py-4 ${tempClass}">${period.weeklyAverage.toFixed(3)}</td>
                <td class="px-6 py-4"><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
    
    tableHTML += `
                    </tbody>
                </table>
            </div>
        </div>

        <div class="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-3xl p-8 border border-orange-200 shadow-2xl">
            <h3 class="text-2xl font-bold text-transparent bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text mb-6 flex items-center gap-3">
                🌡️ Top Daily Maximum Temperatures (2-Hour Rolling Averages)
            </h3>
            <div class="overflow-hidden rounded-2xl shadow-lg bg-white border border-orange-100">
                <table class="w-full">
                    <thead>
                        <tr class="bg-gradient-to-r from-orange-600 via-orange-700 to-amber-700 text-white">
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Date</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Time Range</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Daily Maximum (°C)</th>
                            <th class="px-6 py-5 text-left font-bold text-sm uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Show top 10 daily maximum temperatures
    const topDailyMax = [...dailyMax].sort((a, b) => b.temperature - a.temperature).slice(0, 10);
    topDailyMax.forEach((day, index) => {
        const rowClass = index % 2 === 0 ? 'bg-gradient-to-r from-orange-50/50 to-amber-50/50' : 'bg-white';
        const isHighest = index === 0;
        const statusClass = isHighest 
            ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse' 
            : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md';
        const statusText = isHighest ? '🏆 MAX VALUE' : '🌡️ Daily Max';
        const tempClass = isHighest ? 'text-2xl font-black text-transparent bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text' : 'text-xl font-bold text-orange-700';
        
        tableHTML += `
            <tr class="${rowClass} hover:bg-gradient-to-r hover:from-orange-100 hover:to-amber-100 transition-all duration-300 border-b border-orange-100/50">
                <td class="px-6 py-4 font-semibold text-gray-800">${day.date.toLocaleDateString()}</td>
                <td class="px-6 py-4 text-gray-600 font-medium">${day.timeRange}</td>
                <td class="px-6 py-4 ${tempClass}">${day.temperature.toFixed(3)}</td>
                <td class="px-6 py-4"><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
    
    tableHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    tableDiv.innerHTML = tableHTML;
    resultsDiv.classList.remove('hidden');
}

function downloadResults() {
    if (mwatResults.length === 0 && dailyMaxResults.length === 0) return;
    
    const overallMWAT = mwatResults.length > 0 ? Math.max(...mwatResults.map(w => w.weeklyAverage)) : 0;
    const overallDailyMax = dailyMaxResults.length > 0 ? Math.max(...dailyMaxResults.map(d => d.temperature)) : 0;
    
    let csvContent = 'DMR Temperature Calculation Results\n';
    csvContent += `Maximum Weekly Average Temperature (MWAT),${overallMWAT.toFixed(3)}C\n`;
    csvContent += `Highest Daily Maximum Temperature,${overallDailyMax.toFixed(3)}C\n\n`;
    
    csvContent += 'MWAT 7-Day Rolling Averages\n';
    csvContent += 'Period End Date,Start Date,Weekly Average (C)\n';
    
    mwatResults.forEach(period => {
        csvContent += `${period.endDate.toLocaleDateString()},${period.startDate.toLocaleDateString()},${period.weeklyAverage.toFixed(3)}\n`;
    });
    
    csvContent += '\nDaily Maximum Temperatures\n';
    csvContent += 'Date,Daily Maximum (C),Time Range,Reading Count\n';
    
    dailyMaxResults.forEach(day => {
        csvContent += `${day.date.toLocaleDateString()},${day.temperature.toFixed(3)},"${day.timeRange}",${day.readingCount}\n`;
    });
    
    // Create timestamp for filename
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MWAT_DailyMax_Results_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function downloadRawData() {
    if (temperatureData.length === 0) return;
    
    let csvContent = 'Date Time,Temperature (C),Source\n';
    
    temperatureData.forEach(row => {
        const dateStr = row.dateTime.toLocaleString();
        const temp = row.temperature.toFixed(3);
        const source = row.wasAveraged ? 'Combined/Averaged' : 'Original';
        csvContent += `"${dateStr}",${temp},"${source}"\n`;
    });
    
    // Create timestamp for filename
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `processed_temperature_data_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}