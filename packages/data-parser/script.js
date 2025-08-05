let temperatureData = [];
let mwatResults = [];
let dailyMaxResults = [];
let dischargePeriods = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('file1').addEventListener('change', function() { 
        updateFileDisplay('file1'); 
        checkFiles(); 
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
        wrapper.classList.add('has-file');
        display.classList.add('file-selected');
        if (fileInput.files.length === 1) {
            textElement.textContent = fileInput.files[0].name;
            subtextElement.textContent = `File selected (${formatFileSize(fileInput.files[0].size)})`;
        } else {
            textElement.textContent = `${fileInput.files.length} files selected`;
            subtextElement.textContent = `Multiple files selected`;
        }
        iconElement.textContent = '✅';
    } else {
        wrapper.classList.remove('has-file');
        display.classList.remove('file-selected');
        textElement.textContent = 'Click to select file(s)';
        subtextElement.textContent = 'Continuous temperature monitoring data - select multiple files if needed';
        iconElement.textContent = '📁';
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
    periodDiv.className = 'discharge-item';
    periodDiv.id = `dischargePeriod${periodIndex}`;
    
    periodDiv.innerHTML = `
        <div class="discharge-info">
            <div class="discharge-period-text">Discharge Period ${periodIndex + 1}</div>
            <div class="discharge-dates-text">${startDate.toLocaleString()} - ${endDate.toLocaleString()}</div>
        </div>
        <button class="remove-period-btn" onclick="removeDischargePeriod(${periodIndex})">Remove</button>
    `;
    
    container.appendChild(periodDiv);
    
    // Show the list and clear inputs
    listDiv.style.display = 'block';
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
            document.getElementById('dischargeList').style.display = 'none';
            const addButton = document.querySelector('.add-period-btn');
            addButton.textContent = 'Add Discharge Period';
        }
    }
}

function updateDischargePeriodTitles() {
    const container = document.getElementById('dischargePeriods');
    const periods = container.querySelectorAll('.discharge-item');
    
    periods.forEach((period, index) => {
        const title = period.querySelector('.discharge-period-text');
        title.textContent = `Discharge Period ${index + 1}`;
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
        
        // Start date: 12:00 AM (beginning of day)
        let start = 0;
        if (startDate) {
            const startDateTime = new Date(startDate);
            start = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate(), 0, 0, 0).getTime();
        }
        
        // End date: 11:59:59 PM (end of day)
        let end = Infinity;
        if (endDate) {
            const endDateTime = new Date(endDate);
            end = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate(), 23, 59, 59, 999).getTime();
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
    
    // Calculate 7-day rolling averages
    const mwatResults = [];
    
    for (let i = 6; i < dailyAvgArray.length; i++) { // Start from index 6 to have 7 days
        const sevenDayPeriod = dailyAvgArray.slice(i - 6, i + 1);
        const weeklyAverage = sevenDayPeriod.reduce((sum, day) => sum + day.averageTemp, 0) / 7;
        
        mwatResults.push({
            endDate: sevenDayPeriod[6].date,
            startDate: sevenDayPeriod[0].date,
            weeklyAverage: weeklyAverage,
            dailyAverages: sevenDayPeriod.map(d => d.averageTemp)
        });
    }
    
    return mwatResults;
}

async function loadTestData() {
    const messagesDiv = document.getElementById('messages');
    const fileInput = document.getElementById('file1');
    
    messagesDiv.innerHTML = '';
    
    try {
        messagesDiv.innerHTML += '<div class="message info">Loading test data from UST1A CSV files...</div>';
        
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
                messagesDiv.innerHTML += `<div class="message success">Loaded ${data.length} records from ${filePath.split('/').pop()}</div>`;
            } catch (error) {
                console.warn(`Error loading ${filePath}:`, error);
                messagesDiv.innerHTML += `<div class="message error">Failed to load ${filePath.split('/').pop()}: ${error.message}</div>`;
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
        
        wrapper.classList.add('has-file');
        display.classList.add('file-selected');
        textElement.textContent = 'Test Data Loaded';
        subtextElement.textContent = `${allData.length} UST1A files loaded (${temperatureData.length} total records)`;
        iconElement.textContent = '🧪';
        
        // Enable the process button
        document.getElementById('processBtn').disabled = false;
        
        messagesDiv.innerHTML += `<div class="message success">Test data loaded successfully! Combined ${temperatureData.length} temperature readings from ${allData.length} files.</div>`;
        
    } catch (error) {
        messagesDiv.innerHTML += `<div class="message error">Error loading test data: ${error.message}</div>`;
    }
}

async function calculateMWATAndDailyMax() {
    const fileInput = document.getElementById('file1');
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const messagesDiv = document.getElementById('messages');
    
    messagesDiv.innerHTML = '';
    
    try {
        // Check if we already have test data loaded, otherwise read from files
        if (temperatureData.length === 0) {
            // Read all files
            const allData = [];
            for (let i = 0; i < fileInput.files.length; i++) {
                const text = await fileInput.files[i].text();
                const data = parseCSV(text);
                allData.push(data);
                messagesDiv.innerHTML += `<div class="message success">Parsed ${data.length} records from ${fileInput.files[i].name}</div>`;
            }
            
            // Combine all files
            temperatureData = combineMultipleFiles(allData);
        } else {
            messagesDiv.innerHTML += `<div class="message info">Using previously loaded data (${temperatureData.length} records)</div>`;
        }
        
        // Filter by date range if specified
        let filteredData = filterByDateRange(temperatureData, startDate, endDate);
        
        // Filter by discharge periods
        filteredData = filterByDischargePeriods(filteredData);
        
        if (filteredData.length === 0) {
            throw new Error('No data found in the specified date range or discharge periods');
        }
        
        // Show discharge period filtering info
        if (dischargePeriods.length > 0) {
            messagesDiv.innerHTML += `<div class="message info">Applied ${dischargePeriods.length} discharge period filter(s). Only data within discharge periods will be used for calculations.</div>`;
        }
        
        // Calculate Daily Maximum Temperature
        dailyMaxResults = calculateDailyMaximum(filteredData);
        
        // Calculate MWAT
        mwatResults = calculateMWAT(filteredData);
        
        // Display results
        displayMWATResults(filteredData, dailyMaxResults, mwatResults);
        
    } catch (error) {
        messagesDiv.innerHTML += `<div class="message error">Error calculating MWAT and Daily Max: ${error.message}</div>`;
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
        <h3>DMR Calculation Results</h3>
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${overallMWAT.toFixed(2)}°C</div>
                <div class="stat-label">Maximum Weekly Average Temperature (MWAT)</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${overallDailyMax.toFixed(2)}°C</div>
                <div class="stat-label">Highest Daily Maximum Temperature</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${rawData.length}</div>
                <div class="stat-label">Total Temperature Readings</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${dailyMax.length}</div>
                <div class="stat-label">Days with Daily Maximum</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${mwat.length}</div>
                <div class="stat-label">7-Day MWAT Periods</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${dateRange}</div>
                <div class="stat-label">Date Range</div>
            </div>
        </div>
    `;
    
    // Create results table showing top MWAT periods and daily maximums
    let tableHTML = `
        <h3>Top MWAT Periods (7-Day Rolling Averages)</h3>
        <table>
            <thead>
                <tr>
                    <th>Period End Date</th>
                    <th>7-Day Period</th>
                    <th>Weekly Average (°C)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Show top 10 MWAT periods
    const topMWAT = [...mwat].sort((a, b) => b.weeklyAverage - a.weeklyAverage).slice(0, 10);
    topMWAT.forEach((period, index) => {
        const isHighest = index === 0;
        const statusClass = isHighest ? 'status-averaged' : 'status-single';
        const statusText = isHighest ? 'MWAT VALUE' : 'Weekly Avg';
        
        tableHTML += `
            <tr>
                <td>${period.endDate.toLocaleDateString()}</td>
                <td>${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}</td>
                <td>${period.weeklyAverage.toFixed(3)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>
        <h3 style="margin-top: 2rem;">Top Daily Maximum Temperatures (2-Hour Rolling Averages)</h3>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Daily Maximum (°C)</th>
                    <th>Time Range</th>
                    <th>Readings in 2-Hour Window</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Show top 10 daily maximum temperatures
    const topDailyMax = [...dailyMax].sort((a, b) => b.temperature - a.temperature).slice(0, 10);
    topDailyMax.forEach(day => {
        tableHTML += `
            <tr>
                <td>${day.date.toLocaleDateString()}</td>
                <td>${day.temperature.toFixed(3)}</td>
                <td>${day.timeRange}</td>
                <td>${day.readingCount}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    
    tableDiv.innerHTML = tableHTML;
    resultsDiv.style.display = 'block';
}

function downloadResults() {
    if (mwatResults.length === 0 && dailyMaxResults.length === 0) return;
    
    const overallMWAT = mwatResults.length > 0 ? Math.max(...mwatResults.map(w => w.weeklyAverage)) : 0;
    const overallDailyMax = dailyMaxResults.length > 0 ? Math.max(...dailyMaxResults.map(d => d.temperature)) : 0;
    
    let csvContent = 'DMR Temperature Calculation Results\n';
    csvContent += `Maximum Weekly Average Temperature (MWAT),${overallMWAT.toFixed(3)}°C\n`;
    csvContent += `Highest Daily Maximum Temperature,${overallDailyMax.toFixed(3)}°C\n\n`;
    
    csvContent += 'MWAT 7-Day Rolling Averages\n';
    csvContent += 'Period End Date,Start Date,Weekly Average (°C)\n';
    
    mwatResults.forEach(period => {
        csvContent += `${period.endDate.toLocaleDateString()},${period.startDate.toLocaleDateString()},${period.weeklyAverage.toFixed(3)}\n`;
    });
    
    csvContent += '\nDaily Maximum Temperatures\n';
    csvContent += 'Date,Daily Maximum (°C),Time Range,Reading Count\n';
    
    dailyMaxResults.forEach(day => {
        csvContent += `${day.date.toLocaleDateString()},${day.temperature.toFixed(3)},"${day.timeRange}",${day.readingCount}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MWAT_DailyMax_Results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function downloadRawData() {
    if (temperatureData.length === 0) return;
    
    let csvContent = 'Date Time,Temperature (°C),Source\n';
    
    temperatureData.forEach(row => {
        const dateStr = row.dateTime.toLocaleString();
        const temp = row.temperature.toFixed(3);
        const source = row.wasAveraged ? 'Combined/Averaged' : 'Original';
        csvContent += `"${dateStr}",${temp},"${source}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed_temperature_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}