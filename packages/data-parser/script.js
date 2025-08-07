let temperatureData = [];
let mwatResults = [];
let dailyMaxResults = [];
let dischargePeriods = [];
let dataSource = 'none'; // 'none', 'files', 'test'

// Calendar state
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedStartDate = null;
let selectedEndDate = null;

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
                bgClass: 'bg-success-50 border-l-4 border-success-200',
                textClass: 'text-success-500',
                iconClass: 'text-success-300'
            };
            break;
        case 'error':
            iconAndClass = {
                icon: '❌',
                bgClass: 'bg-warning-50 border-l-4 border-warning-200',
                textClass: 'text-warning-500',
                iconClass: 'text-warning-300'
            };
            break;
        case 'warning':
            iconAndClass = {
                icon: '⚠️',
                bgClass: 'bg-secondary-50 border-l-4 border-secondary-100',
                textClass: 'text-secondary-700',
                iconClass: 'text-secondary-400'
            };
            break;
        case 'info':
        default:
            iconAndClass = {
                icon: 'ℹ️',
                bgClass: 'bg-primary-50 border-l-4 border-primary-200',
                textClass: 'text-primary-700',
                iconClass: 'text-primary-500'
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
    // Set up file inputs
    document.getElementById('file1').addEventListener('change', function() { 
        handleFileUpload('file1'); 
        checkFiles(); 
    });
    
    document.getElementById('file2').addEventListener('change', function() { 
        handleFileUpload('file2'); 
        checkFiles(); 
    });
    
    // Initialize interactive calendar
    initializeCalendar();
});

function handleFileUpload(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    const statusDiv = document.getElementById(fileInputId + '-status');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        statusDiv.innerHTML = `
            <div class="flex items-center gap-2 text-primary-700 bg-primary-50 px-3 py-2 rounded-lg border border-primary-200">
                <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span class="font-medium">${file.name}</span>
                <span class="text-primary-500 text-xs">(${formatFileSize(file.size)})</span>
            </div>
        `;
        
        // Clear test data if files are uploaded
        if (dataSource === 'test') {
            clearTestDataState();
            addLogMessage('Uploaded files detected - cleared test data', 'info');
        }
        dataSource = 'files';
    } else {
        statusDiv.innerHTML = '';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearTestDataState() {
    temperatureData = [];
    dataSource = 'none';
    addLogMessage('Test data cleared', 'info');
}

function clearFileInputs() {
    document.getElementById('file1').value = '';
    document.getElementById('file2').value = '';
    document.getElementById('file1-status').innerHTML = '';
    document.getElementById('file2-status').innerHTML = '';
    addLogMessage('File inputs cleared', 'info');
}

function checkFiles() {
    const file1 = document.getElementById('file1');
    const file2 = document.getElementById('file2');
    const processBtn = document.getElementById('processBtn');
    
    // Check if we have files uploaded or test data loaded
    const hasFiles = file1.files.length > 0 || file2.files.length > 0;
    const hasData = dataSource === 'test' || hasFiles;
    
    if (hasData) {
        processBtn.disabled = false;
    } else {
        processBtn.disabled = true;
    }
}

// Interactive Calendar Functions
function initializeCalendar() {
    // Set up navigation buttons
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });
    
    // Set up reset button
    document.getElementById('resetDates').addEventListener('click', () => {
        selectedStartDate = null;
        selectedEndDate = null;
        updateDateRangeInfo();
        renderCalendar();
    });
    
    // Initial render
    renderCalendar();
    updateDateRangeInfo();
}

function updateDateRangeInfo() {
    const dateRangeInfo = document.getElementById('dateRangeInfo');
    const dateRangeText = document.getElementById('dateRangeText');
    
    if (selectedStartDate || selectedEndDate) {
        const startText = selectedStartDate ? selectedStartDate.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        }) : 'Not selected';
        const endText = selectedEndDate ? selectedEndDate.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        }) : 'Not selected';
        
        dateRangeText.textContent = `${startText} → ${endText}`;
        dateRangeInfo.classList.remove('hidden');
    } else {
        dateRangeInfo.classList.add('hidden');
    }
}

function renderCalendar() {
    const calendarContent = document.getElementById('calendarContent');
    const currentMonthYear = document.getElementById('currentMonthYear');
    
    // Update month/year display
    const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { 
        month: 'long', year: 'numeric' 
    });
    currentMonthYear.textContent = monthName;
    
    // Generate calendar HTML
    const html = generateInteractiveCalendar();
    calendarContent.innerHTML = html;
    
    // Add click handlers to calendar days
    addCalendarClickHandlers();
}

function generateInteractiveCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    let html = '<div class="calendar-grid">';
    
    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        const prevMonthDay = new Date(currentYear, currentMonth, -(startingDayOfWeek - 1 - i));
        const dateString = prevMonthDay.toISOString().split('T')[0];
        
        let classes = 'calendar-day other-month interactive';
        
        // Determine if this previous month day is in the selected range
        if (selectedStartDate && selectedEndDate) {
            const start = selectedStartDate.toISOString().split('T')[0];
            const end = selectedEndDate.toISOString().split('T')[0];
            
            if (dateString === start && dateString === end) {
                classes += ' single-day';
            } else if (dateString === start) {
                classes += ' start-date';
            } else if (dateString === end) {
                classes += ' end-date';
            } else if (dateString > start && dateString < end) {
                classes += ' in-range';
            }
        } else if (selectedStartDate && dateString === selectedStartDate.toISOString().split('T')[0]) {
            classes += ' start-date';
        } else if (selectedEndDate && dateString === selectedEndDate.toISOString().split('T')[0]) {
            classes += ' end-date';
        }
        
        html += `<div class="${classes}" data-date="${dateString}">${prevMonthDay.getDate()}</div>`;
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(currentYear, currentMonth, day);
        const dateString = currentDate.toISOString().split('T')[0];
        
        let classes = 'calendar-day current-month interactive';
        
        // Determine if this day is in the selected range
        if (selectedStartDate && selectedEndDate) {
            const start = selectedStartDate.toISOString().split('T')[0];
            const end = selectedEndDate.toISOString().split('T')[0];
            
            if (dateString === start && dateString === end) {
                classes += ' single-day';
            } else if (dateString === start) {
                classes += ' start-date';
            } else if (dateString === end) {
                classes += ' end-date';
            } else if (dateString > start && dateString < end) {
                classes += ' in-range';
            }
        } else if (selectedStartDate && dateString === selectedStartDate.toISOString().split('T')[0]) {
            classes += ' start-date';
        } else if (selectedEndDate && dateString === selectedEndDate.toISOString().split('T')[0]) {
            classes += ' end-date';
        }
        
        html += `<div class="${classes}" data-date="${dateString}">${day}</div>`;
    }
    
    // Fill remaining cells
    const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;
    const remainingCells = totalCells - (daysInMonth + startingDayOfWeek);
    
    for (let i = 1; i <= remainingCells; i++) {
        const nextMonthDay = new Date(currentYear, currentMonth + 1, i);
        const dateString = nextMonthDay.toISOString().split('T')[0];
        
        let classes = 'calendar-day other-month interactive';
        
        // Determine if this next month day is in the selected range
        if (selectedStartDate && selectedEndDate) {
            const start = selectedStartDate.toISOString().split('T')[0];
            const end = selectedEndDate.toISOString().split('T')[0];
            
            if (dateString === start && dateString === end) {
                classes += ' single-day';
            } else if (dateString === start) {
                classes += ' start-date';
            } else if (dateString === end) {
                classes += ' end-date';
            } else if (dateString > start && dateString < end) {
                classes += ' in-range';
            }
        } else if (selectedStartDate && dateString === selectedStartDate.toISOString().split('T')[0]) {
            classes += ' start-date';
        } else if (selectedEndDate && dateString === selectedEndDate.toISOString().split('T')[0]) {
            classes += ' end-date';
        }
        
        html += `<div class="${classes}" data-date="${dateString}">${i}</div>`;
    }
    
    html += '</div>';
    return html;
}

function addCalendarClickHandlers() {
    const interactiveDays = document.querySelectorAll('.calendar-day.interactive');
    
    interactiveDays.forEach(day => {
        day.addEventListener('click', (e) => {
            const dateString = e.target.getAttribute('data-date');
            // Fix timezone issue by parsing date components locally
            const [year, month, day] = dateString.split('-').map(Number);
            const clickedDate = new Date(year, month - 1, day); // month is 0-based
            
            handleDateClick(clickedDate);
        });
    });
}

function handleDateClick(clickedDate) {
    if (!selectedStartDate) {
        // First click - set start date
        selectedStartDate = clickedDate;
        selectedEndDate = null;
    } else if (!selectedEndDate) {
        // Second click - set end date
        if (clickedDate >= selectedStartDate) {
            selectedEndDate = clickedDate;
        } else {
            // If clicked date is before start date, make it the new start date
            selectedEndDate = selectedStartDate;
            selectedStartDate = clickedDate;
        }
    } else {
        // Third click - reset and set new start date
        selectedStartDate = clickedDate;
        selectedEndDate = null;
    }
    
    updateDateRangeInfo();
    renderCalendar();
}

// Helper function to get selected date values for other parts of the application
function getSelectedDateRange() {
    return {
        startDate: selectedStartDate ? selectedStartDate.toISOString().split('T')[0] : '',
        endDate: selectedEndDate ? selectedEndDate.toISOString().split('T')[0] : ''
    };
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
    periodDiv.className = 'bg-white/80 rounded-xl p-4 border border-secondary-100 flex items-center justify-between transition-all duration-300 hover:shadow-md';
    periodDiv.id = `dischargePeriod${periodIndex}`;
    
    periodDiv.innerHTML = `
        <div class="flex-1">
            <div class="font-bold text-secondary-700 mb-1">Discharge Period ${periodIndex + 1}</div>
            <div class="text-secondary-600 text-sm">${startDate.toLocaleString()} - ${endDate.toLocaleString()}</div>
        </div>
        <button class="bg-warning-300 hover:bg-warning-400 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105" onclick="removeDischargePeriod(${periodIndex})">
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
    const parts = dateStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1];
    const ampm = parts[2]; // May be undefined for 24-hour format
    
    const [month, day, year] = datePart.split('/');
    const [hours, minutes, seconds] = timePart.split(':');
    
    let hour24 = parseInt(hours);
    
    // Handle AM/PM conversion if present
    if (ampm) {
        if (ampm === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (ampm === 'AM' && hour24 === 12) {
            hour24 = 0;
        }
    }
    
    // Handle both 2-digit and 4-digit years
    let fullYear = parseInt(year);
    if (fullYear < 100) {
        fullYear = 2000 + fullYear;
    }
    
    return new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds || 0));
}

function parseCSV(text) {
    const lines = text.split('\n');
    const data = [];
    
    // Detect CSV format by checking if first line contains "Plot Title"
    let dataStartIndex = 1; // Default: data starts at row 2 (index 1)
    
    if (lines.length > 0 && lines[0].toLowerCase().includes('plot title')) {
        // Format 2: Has plot title row, data starts at row 3 (index 2)
        dataStartIndex = 2;
    }
    
    // Parse data starting from the detected index
    for (let i = dataStartIndex; i < lines.length; i++) {
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
    
    // Debug logging
    console.log('filterByDateRange called with:', { startDate, endDate, dataLength: data.length });
    
    const filtered = data.filter(row => {
        const rowTime = row.dateTime.getTime();
        
        // Start date: 00:00:00 (beginning of day)
        let start = 0;
        if (startDate) {
            const startDateTime = new Date(startDate + 'T00:00:00');
            start = startDateTime.getTime();
            console.log('Start filter:', startDate, startDateTime.toLocaleString(), start);
        }
        
        // End date: 23:59:59.999 (end of day)
        let end = Infinity;
        if (endDate) {
            const endDateTime = new Date(endDate + 'T23:59:59.999');
            end = endDateTime.getTime();
            console.log('End filter:', endDate, endDateTime.toLocaleString(), end);
        }
        
        const isInRange = rowTime >= start && rowTime <= end;
        if (!isInRange) {
            console.log('Row filtered out:', row.dateTime.toLocaleString(), 'not in range', new Date(start).toLocaleString(), 'to', new Date(end).toLocaleString());
        }
        
        return isInRange;
    });
    
    console.log('Filter result:', filtered.length, 'records remain');
    return filtered;
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
    
    // Clear any uploaded files if test data is being loaded
    if (dataSource === 'files') {
        clearFileInputs();
        addLogMessage('File uploads detected - cleared uploaded files', 'info');
    }
    
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
        dataSource = 'test';
        
        // Update the file status displays to show test data is loaded
        document.getElementById('file1-status').textContent = `Test Data: ${allData.length} UST1A files (${temperatureData.length} records)`;
        document.getElementById('file1-status').classList.add('text-secondary-600', 'font-semibold');
        document.getElementById('file1-status').classList.remove('text-gray-500');
        
        // Enable the process button
        checkFiles();
        
        addLogMessage(`Test data loaded successfully! Combined ${temperatureData.length} temperature readings from ${allData.length} files.`, 'success');
        
    } catch (error) {
        addLogMessage(`Error loading test data: ${error.message}`, 'error');
    }
}

async function calculateMWATAndDailyMax() {
    const file1 = document.getElementById('file1');
    const file2 = document.getElementById('file2');
    const dateRange = getSelectedDateRange();
    const startDate = dateRange.startDate;
    const endDate = dateRange.endDate;
    
    clearLog();
    
    try {
        // Check if we already have data loaded, otherwise read from files
        if (temperatureData.length === 0 || dataSource === 'none') {
            addLogMessage('Reading uploaded CSV files...', 'info');
            
            // Collect files from the two inputs
            const allFiles = [];
            
            if (file1.files.length > 0) {
                allFiles.push(file1.files[0]);
            }
            if (file2.files.length > 0) {
                allFiles.push(file2.files[0]);
            }
            
            if (allFiles.length === 0) {
                addLogMessage('No files selected. Please upload CSV files first.', 'error');
                return;
            }
            
            // Read all files
            const allData = [];
            for (let i = 0; i < allFiles.length; i++) {
                const text = await allFiles[i].text();
                const data = parseCSV(text);
                allData.push(data);
                addLogMessage(`Parsed ${data.length} records from ${allFiles[i].name}`, 'success');
            }
            
            // Combine all files
            temperatureData = combineMultipleFiles(allData);
            dataSource = 'files';
            addLogMessage(`Combined data from ${allData.length} file(s) - ${temperatureData.length} total records`, 'success');
        } else {
            addLogMessage(`Using previously loaded data (${temperatureData.length} records from ${dataSource})`, 'info');
        }
        
        // Filter by date range if specified
        let filteredData = filterByDateRange(temperatureData, startDate, endDate);
        if (startDate || endDate) {
            addLogMessage(`Applied date range filter (${startDate || 'no start'} to ${endDate || 'no end'}) - ${filteredData.length} records remain`, 'info');
            
            // Debug: Show first and last dates in original data
            if (temperatureData.length > 0) {
                const firstDate = temperatureData[0].dateTime.toLocaleDateString();
                const lastDate = temperatureData[temperatureData.length - 1].dateTime.toLocaleDateString();
                addLogMessage(`Original data range: ${firstDate} to ${lastDate}`, 'info');
            }
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
        <!-- Main Results Summary -->
        <div class="bg-white/70 rounded-2xl p-8 border-l-4 border-primary-500 mb-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- MWAT Result -->
                <div class="text-center">
                    <div class="text-5xl font-bold text-primary-700 mb-3">${overallMWAT.toFixed(3)}°C</div>
                    <div class="text-lg font-semibold text-primary-500 mb-2">Maximum Weekly Average Temperature</div>
                    <div class="text-sm text-gray-600">${mwat.length} MWAT periods analyzed</div>
                </div>
                
                <!-- Daily Max Result -->
                <div class="text-center">
                    <div class="text-5xl font-bold text-secondary-600 mb-3">${overallDailyMax.toFixed(3)}°C</div>
                    <div class="text-lg font-semibold text-secondary-500 mb-2">Highest Daily Maximum Temperature</div>
                    <div class="text-sm text-gray-600">${dailyMax.length} days analyzed</div>
                </div>
            </div>
            
            <!-- Data Summary Bar -->
            <div class="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                <div><strong>${rawData.length}</strong> total temperature readings</div>
                <div><strong>${dateRange}</strong> date range</div>
            </div>
            
            <!-- Download Actions -->
            <div class="mt-6 flex justify-center">
                <button onclick="downloadResults()" 
                        class="bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-700 hover:to-primary-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 text-lg">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Download Complete Results
                </button>
            </div>
        </div>
    `;
    
    // Create results table showing top MWAT periods and daily maximums
    let tableHTML = `
        <div class="bg-white/70 rounded-2xl p-8 mb-8 border-l-4 border-primary-500">
            <h3 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                📈 Top MWAT Periods (7-Day Rolling Averages)
            </h3>
            <div class="overflow-hidden rounded-2xl shadow-lg bg-white border border-primary-100">
                <table class="w-full">
                    <thead>
                        <tr class="bg-primary-500 text-white">
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
        const rowClass = index % 2 === 0 ? 'bg-primary-50' : 'bg-white';
        const statusClass = isHighest 
            ? 'bg-primary-600 text-white px-4 py-2 rounded-full text-xs font-bold animate-pulse' 
            : 'bg-primary-500 text-white px-4 py-2 rounded-full text-xs font-bold';
        const statusText = isHighest ? '🏆 MWAT VALUE' : '📊 Weekly Avg';
        const tempClass = isHighest ? 'text-2xl font-black text-primary-700' : 'text-xl font-bold text-primary-700';
        
        tableHTML += `
            <tr class="${rowClass} hover:bg-primary-100 transition-all duration-300 border-b border-primary-100">
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

        <div class="bg-white/70 rounded-2xl p-8 border-l-4 border-primary-500">
            <h3 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                🌡️ Top Daily Maximum Temperatures (2-Hour Rolling Averages)
            </h3>
            <div class="overflow-hidden rounded-2xl shadow-lg bg-white border border-primary-100">
                <table class="w-full">
                    <thead>
                        <tr class="bg-primary-500 text-white">
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
        const rowClass = index % 2 === 0 ? 'bg-primary-50' : 'bg-white';
        const isHighest = index === 0;
        const statusClass = isHighest 
            ? 'bg-primary-600 text-white px-4 py-2 rounded-full text-xs font-bold animate-pulse' 
            : 'bg-primary-500 text-white px-4 py-2 rounded-full text-xs font-bold';
        const statusText = isHighest ? '🏆 MAX VALUE' : '🌡️ Daily Max';
        const tempClass = isHighest ? 'text-2xl font-black text-primary-700' : 'text-xl font-bold text-primary-700';
        
        tableHTML += `
            <tr class="${rowClass} hover:bg-primary-100 transition-all duration-300 border-b border-primary-100">
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
    
    // Sheet 1: DMR Results Summary
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
    
    // Sheet 2: Processed Temperature Data
    if (temperatureData.length > 0) {
        csvContent += '\n\n--- PROCESSED TEMPERATURE DATA ---\n';
        csvContent += 'Date Time,Temperature (C),Source\n';
        
        temperatureData.forEach(row => {
            const dateStr = row.dateTime.toLocaleString();
            const temp = row.temperature.toFixed(3);
            const source = row.wasAveraged ? 'Combined/Averaged' : 'Original';
            csvContent += `"${dateStr}",${temp},"${source}"\n`;
        });
    }
    
    // Create timestamp for filename
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MWAT_DailyMax_Complete_Results_${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

