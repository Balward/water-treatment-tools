// MWAT/DDMAX Compliance Calculator
// Colorado CDPHE Wastewater Discharge Monitoring

class MWATDDMAXCalculator {
  constructor() {
    this.sensor1Data = null;
    this.sensor2Data = null;
    this.mergedData = null;
    this.mergeStats = null;
    this.dischargePeriods = [];
    this.analysisMonth = null;
    this.results = null;

    this.initializeEventListeners();
    
    // Initial check for calculation readiness
    setTimeout(() => this.checkCalculationReady(), 100);
  }

  initializeEventListeners() {
    // File upload handlers
    document.getElementById('file1Input').addEventListener('change', (e) => this.handleFileUpload(e, 1));
    document.getElementById('file2Input').addEventListener('change', (e) => this.handleFileUpload(e, 2));

    // Discharge pattern selection
    document.getElementById('dischargePattern').addEventListener('change', (e) => this.handleDischargePatternChange(e));
    document.getElementById('analysisMonth').addEventListener('change', (e) => this.handleAnalysisMonthChange(e));
    
    // No additional event listeners needed for simplified discharge options

    // Calculation button
    document.getElementById('calculateBtn').addEventListener('click', () => this.calculateCompliance());

    // Custom period management
    document.getElementById('addCustomPeriod').addEventListener('click', () => this.addCustomPeriod());

    // Export and reset buttons
    document.getElementById('exportExcelBtn').addEventListener('click', () => this.exportToExcel());
    document.getElementById('resetCalculationBtn').addEventListener('click', () => this.resetCalculation());
    
    // Continue to configuration button
    document.getElementById('continueToConfigBtn').addEventListener('click', () => this.showDischargeConfiguration());
  }

  async handleFileUpload(event, sensorNumber) {
    const file = event.target.files[0];
    if (!file) return;

    const statusElement = document.getElementById(`file${sensorNumber}Status`);
    statusElement.textContent = 'Loading...';

    try {
      const data = await this.parseExcelFile(file);
      
      if (sensorNumber === 1) {
        this.sensor1Data = data;
      } else {
        this.sensor2Data = data;
      }

      statusElement.textContent = `✅ Loaded: ${data.length} records`;
      statusElement.classList.add('loaded');

      this.updateDataPreview();
      
      // If both sensors loaded, merge the data
      if (this.sensor1Data && this.sensor2Data) {
        this.mergeTemperatureData();
      }
      
      this.checkCalculationReady();

    } catch (error) {
      console.error('File upload error:', error);
      statusElement.textContent = '❌ Error loading file';
      this.showNotification('Error loading data file: ' + error.message, 'error');
    }
  }

  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          // Check if it's a CSV file
          if (file.name.toLowerCase().endsWith('.csv')) {
            const text = e.target.result;
            const parsedData = this.parseCSVData(text);
            resolve(parsedData);
          } else {
            // Handle Excel files
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Assume data is in the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON - assume timestamp in column B, temperature in column C (Excel format)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Skip header rows and parse data (start from row 2, index 2)
            const parsedData = [];
            for (let i = 2; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (row.length >= 3 && row[1] && row[2] !== undefined) {
                try {
                  // Parse Excel date/time from column B
                  const timestamp = this.parseExcelDateTime(row[1]);
                  const temperature = parseFloat(row[2]);
                  
                  if (!isNaN(temperature) && timestamp) {
                    parsedData.push({
                      timestamp: timestamp,
                      temperature: temperature
                    });
                  }
                } catch (error) {
                  // Skip invalid rows
                  continue;
                }
              }
            }
            
            if (parsedData.length === 0) {
              reject(new Error('No valid data found. Expected timestamp in column B and temperature in column C.'));
            } else {
              // Sort by timestamp
              parsedData.sort((a, b) => a.timestamp - b.timestamp);
              resolve(parsedData);
            }
          }
          
        } catch (error) {
          reject(new Error('Failed to parse file: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      // Read as text for CSV, as ArrayBuffer for Excel
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  parseCSVData(csvText) {
    const lines = csvText.split('\n');
    const parsedData = [];
    
    // Skip first 2 lines (title and headers), start from line 3 (index 2)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      try {
        // Parse CSV line - handle quoted values
        const columns = this.parseCSVLine(line);
        
        if (columns.length >= 3) {
          // Column B (index 1) = Date/Time, Column C (index 2) = Temperature
          const dateTimeStr = columns[1];
          const tempStr = columns[2];
          
          if (dateTimeStr && tempStr) {
            const timestamp = this.parseCSVDateTime(dateTimeStr);
            const temperature = parseFloat(tempStr);
            
            if (!isNaN(temperature) && timestamp) {
              parsedData.push({
                timestamp: timestamp,
                temperature: temperature
              });
            }
          }
        }
      } catch (error) {
        // Skip invalid rows
        continue;
      }
    }
    
    if (parsedData.length === 0) {
      throw new Error('No valid data found. Expected Date/Time in column B and Temperature in column C.');
    }
    
    // Sort by timestamp
    parsedData.sort((a, b) => a.timestamp - b.timestamp);
    return parsedData;
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  parseCSVDateTime(dateTimeStr) {
    // Handle format: MM/dd/yy hh:mm:ss AM/PM
    // Example: "03/11/25 11:15:00 AM"
    
    try {
      // Clean the string
      const cleaned = dateTimeStr.replace(/^"+|"+$/g, ''); // Remove quotes
      
      // Parse the date/time
      const parsed = new Date(cleaned);
      
      if (isNaN(parsed.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Handle 2-digit years (assume 20xx for years < 50, 19xx for years >= 50)
      if (parsed.getFullYear() < 1000) {
        const year = parsed.getFullYear();
        if (year < 50) {
          parsed.setFullYear(2000 + year);
        } else {
          parsed.setFullYear(1900 + year);
        }
      }
      
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse date: ${dateTimeStr}`);
    }
  }

  mergeTemperatureData() {
    if (!this.sensor1Data || !this.sensor2Data) {
      return;
    }

    this.showNotification('Merging temperature data from both sensors...', 'info');

    // Create a map to store all temperature readings by timestamp
    const temperatureMap = new Map();
    let overlaps = 0;
    let sensor1Count = 0;
    let sensor2Count = 0;

    // Add sensor 1 data
    for (const record of this.sensor1Data) {
      const timestampKey = record.timestamp.getTime();
      temperatureMap.set(timestampKey, {
        timestamp: record.timestamp,
        temperatures: [record.temperature],
        sources: ['sensor1']
      });
      sensor1Count++;
    }

    // Add sensor 2 data, handling overlaps
    for (const record of this.sensor2Data) {
      const timestampKey = record.timestamp.getTime();
      
      if (temperatureMap.has(timestampKey)) {
        // Overlap found - add temperature to existing entry
        const existing = temperatureMap.get(timestampKey);
        existing.temperatures.push(record.temperature);
        existing.sources.push('sensor2');
        overlaps++;
      } else {
        // New timestamp
        temperatureMap.set(timestampKey, {
          timestamp: record.timestamp,
          temperatures: [record.temperature],
          sources: ['sensor2']
        });
      }
      sensor2Count++;
    }

    // Create merged dataset with averaged temperatures
    this.mergedData = [];
    for (const [timestampKey, data] of temperatureMap) {
      const averageTemp = data.temperatures.reduce((sum, temp) => sum + temp, 0) / data.temperatures.length;
      
      this.mergedData.push({
        timestamp: data.timestamp,
        temperature: averageTemp,
        sources: data.sources,
        originalCount: data.temperatures.length
      });
    }

    // Sort by timestamp
    this.mergedData.sort((a, b) => a.timestamp - b.timestamp);

    // Store merge statistics
    this.mergeStats = {
      sensor1Records: sensor1Count,
      sensor2Records: sensor2Count,
      totalInputRecords: sensor1Count + sensor2Count,
      mergedRecords: this.mergedData.length,
      overlapsFound: overlaps,
      duplicatesRemoved: (sensor1Count + sensor2Count) - this.mergedData.length
    };

    // Update the preview to show merged data
    this.updateDataPreview();
    
    // Generate the temperature chart
    this.generateTemperatureChart();

    this.showNotification(
      `Data merged successfully! ${overlaps} overlapping timestamps averaged.`, 
      'success'
    );
  }

  parseExcelDateTime(excelDate) {
    // Handle different Excel date formats
    if (typeof excelDate === 'number') {
      // Excel serial date
      return new Date((excelDate - 25569) * 86400 * 1000);
    } else if (typeof excelDate === 'string') {
      // Try to parse as string
      const parsed = new Date(excelDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } else if (excelDate instanceof Date) {
      return excelDate;
    }
    
    throw new Error('Invalid date format');
  }

  updateDataPreview() {
    if (this.sensor1Data) {
      const stats1 = this.generateDataStats(this.sensor1Data, 1);
      document.getElementById('sensor1Stats').innerHTML = stats1;
    }

    if (this.sensor2Data) {
      const stats2 = this.generateDataStats(this.sensor2Data, 2);
      document.getElementById('sensor2Stats').innerHTML = stats2;
    }

    // Show merged data statistics if available
    if (this.mergedData && this.mergeStats) {
      const mergedStats = this.generateMergedDataStats();
      // Add merged data preview section if it doesn't exist
      if (!document.getElementById('mergedStats')) {
        this.addMergedDataPreview();
      }
      document.getElementById('mergedStats').innerHTML = mergedStats;
    }

    if (this.sensor1Data || this.sensor2Data) {
      document.getElementById('previewSection').style.display = 'block';
    }

    // Don't automatically show discharge section - user must click Continue button after viewing chart
  }

  generateDataStats(data, sensorNumber) {
    const count = data.length;
    const startDate = new Date(Math.min(...data.map(d => d.timestamp)));
    const endDate = new Date(Math.max(...data.map(d => d.timestamp)));
    const temperatures = data.map(d => d.temperature);
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;

    return `
      <strong>Records:</strong> ${count.toLocaleString()}<br>
      <strong>Date Range:</strong> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}<br>
      <strong>Temperature Range:</strong> ${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C<br>
      <strong>Average:</strong> ${avgTemp.toFixed(1)}°C
    `;
  }

  generateMergedDataStats() {
    if (!this.mergedData || !this.mergeStats) return '';
    
    const data = this.mergedData;
    const stats = this.mergeStats;
    
    const startDate = new Date(Math.min(...data.map(d => d.timestamp)));
    const endDate = new Date(Math.max(...data.map(d => d.timestamp)));
    const temperatures = data.map(d => d.temperature);
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    
    return `
      <div class="merge-summary">
        <strong>📊 Merged Dataset Summary</strong><br>
        <strong>Records:</strong> ${stats.mergedRecords.toLocaleString()} (from ${stats.totalInputRecords.toLocaleString()} total)<br>
        <strong>Date Range:</strong> ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}<br>
        <strong>Temperature Range:</strong> ${minTemp.toFixed(1)}°C - ${maxTemp.toFixed(1)}°C<br>
        <strong>Average:</strong> ${avgTemp.toFixed(1)}°C<br><br>
        
        <strong>🔗 Merge Details</strong><br>
        <strong>Overlaps Found:</strong> ${stats.overlapsFound.toLocaleString()} timestamps<br>
        <strong>Duplicates Removed:</strong> ${stats.duplicatesRemoved.toLocaleString()}<br>
        <strong>Data Quality:</strong> ${stats.overlapsFound > 0 ? 'Overlaps averaged' : 'No overlaps detected'}
      </div>
    `;
  }

  addMergedDataPreview() {
    const previewGrid = document.querySelector('.preview-grid');
    if (previewGrid && !document.getElementById('mergedPreview')) {
      const mergedCard = document.createElement('div');
      mergedCard.className = 'preview-card merged-card';
      mergedCard.innerHTML = `
        <h4>🔗 Merged Temperature Data</h4>
        <div class="preview-stats" id="mergedStats"></div>
      `;
      mergedCard.id = 'mergedPreview';
      previewGrid.appendChild(mergedCard);
    }
  }

  generateTemperatureChart() {
    if (!this.mergedData) return;
    
    // Show chart section
    document.getElementById('chartSection').style.display = 'block';
    
    // Prepare data for Chart.js
    const chartData = this.mergedData.map(record => ({
      x: record.timestamp,
      y: record.temperature,
      sources: record.sources,
      originalCount: record.originalCount
    }));
    
    // Get canvas context
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (this.temperatureChart) {
      this.temperatureChart.destroy();
    }
    
    // Create new chart
    this.temperatureChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Temperature (°C)',
          data: chartData,
          borderColor: '#5a7a95',
          backgroundColor: 'rgba(90, 122, 149, 0.1)',
          borderWidth: 2,
          pointRadius: function(context) {
            // Larger points for averaged data
            const point = context.parsed;
            const dataPoint = chartData[context.dataIndex];
            return dataPoint.originalCount > 1 ? 4 : 2;
          },
          pointBackgroundColor: function(context) {
            const dataPoint = chartData[context.dataIndex];
            if (dataPoint.originalCount > 1) {
              return '#c9a96e'; // Gold for averaged points
            } else if (dataPoint.sources.includes('sensor1') && dataPoint.sources.includes('sensor2')) {
              return '#7fb3b3'; // Teal for both sensors
            } else if (dataPoint.sources.includes('sensor1')) {
              return '#5a7a95'; // Blue for sensor 1
            } else {
              return '#8b7fb3'; // Purple for sensor 2
            }
          },
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'MMM dd HH:mm',
                day: 'MMM dd'
              }
            },
            title: {
              display: true,
              text: 'Date & Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Temperature (°C)'
            },
            beginAtZero: false
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Combined Temperature Data from Both Sensors',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            labels: {
              generateLabels: function(chart) {
                return [
                  { text: 'Sensor 1 Only', fillStyle: '#5a7a95', strokeStyle: '#5a7a95' },
                  { text: 'Sensor 2 Only', fillStyle: '#8b7fb3', strokeStyle: '#8b7fb3' },
                  { text: 'Both Sensors', fillStyle: '#7fb3b3', strokeStyle: '#7fb3b3' },
                  { text: 'Averaged Values', fillStyle: '#c9a96e', strokeStyle: '#c9a96e' }
                ];
              }
            }
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                const dataPoint = chartData[context[0].dataIndex];
                return new Date(dataPoint.x).toLocaleString();
              },
              label: function(context) {
                const dataPoint = chartData[context.dataIndex];
                let label = `Temperature: ${dataPoint.y.toFixed(2)}°C`;
                if (dataPoint.originalCount > 1) {
                  label += ` (averaged from ${dataPoint.originalCount} sensors)`;
                }
                label += `\nSource: ${dataPoint.sources.join(', ')}`;
                return label;
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
    
    // Show continue button
    document.getElementById('continueToConfigBtn').style.display = 'inline-flex';
    
    // Scroll to chart
    document.getElementById('chartSection').scrollIntoView({ behavior: 'smooth' });
  }

  showDischargeConfiguration() {
    // Show discharge configuration section
    document.getElementById('dischargeSection').style.display = 'block';
    
    // Scroll to discharge configuration
    document.getElementById('dischargeSection').scrollIntoView({ behavior: 'smooth' });
    
    this.showNotification('Ready to configure discharge periods!', 'success');
  }

  handleDischargePatternChange(event) {
    const pattern = event.target.value;
    
    // Hide all config sections
    document.getElementById('continuousDischargeConfig').style.display = 'none';
    document.getElementById('customScheduleConfig').style.display = 'none';

    // Show relevant config section
    switch (pattern) {
      case 'continuous':
        document.getElementById('continuousDischargeConfig').style.display = 'block';
        break;
      case 'custom':
        document.getElementById('customScheduleConfig').style.display = 'block';
        break;
    }

    this.checkCalculationReady();
  }

  handleAnalysisMonthChange(event) {
    this.analysisMonth = event.target.value;
    this.checkCalculationReady();
  }

  addCustomPeriod() {
    const customPeriods = document.getElementById('customPeriods');
    const periodIndex = customPeriods.children.length;
    
    const periodDiv = document.createElement('div');
    periodDiv.className = 'custom-period';
    periodDiv.innerHTML = `
      <div class="custom-period-header">
        <strong>Discharge Period ${periodIndex + 1}</strong>
        <button type="button" class="remove-period" onclick="this.parentElement.parentElement.remove(); calculator.checkCalculationReady();">Remove</button>
      </div>
      <div class="period-controls">
        <div class="control-group">
          <label>Start Date & Time:</label>
          <input type="datetime-local" class="custom-start" />
        </div>
        <div class="control-group">
          <label>End Date & Time:</label>
          <input type="datetime-local" class="custom-end" />
        </div>
      </div>
    `;
    
    customPeriods.appendChild(periodDiv);
    
    // Add event listeners to the new inputs
    const startInput = periodDiv.querySelector('.custom-start');
    const endInput = periodDiv.querySelector('.custom-end');
    startInput.addEventListener('change', () => this.checkCalculationReady());
    endInput.addEventListener('change', () => this.checkCalculationReady());
    
    // Check if calculation is ready after adding period
    this.checkCalculationReady();
  }

  checkCalculationReady() {
    const hasData = this.sensor1Data && this.sensor2Data && this.mergedData;
    const hasMonth = this.analysisMonth;
    const hasDischarge = this.validateDischargeConfiguration();
    
    // Debug logging
    console.log('Calculation readiness check:', {
      hasData,
      hasMonth,
      hasDischarge,
      sensor1Records: this.sensor1Data ? this.sensor1Data.length : 0,
      sensor2Records: this.sensor2Data ? this.sensor2Data.length : 0,
      mergedRecords: this.mergedData ? this.mergedData.length : 0,
      analysisMonth: this.analysisMonth,
      dischargePattern: document.getElementById('dischargePattern').value
    });
    
    const calculateBtn = document.getElementById('calculateBtn');
    // For the final calculation, we need data, month, and discharge config
    const isReady = hasData && hasMonth && hasDischarge;
    calculateBtn.disabled = !isReady;
    
    // Visual feedback
    if (isReady) {
      calculateBtn.style.opacity = '1';
      calculateBtn.style.cursor = 'pointer';
    } else {
      calculateBtn.style.opacity = '0.6';
      calculateBtn.style.cursor = 'not-allowed';
    }
  }

  validateDischargeConfiguration() {
    const pattern = document.getElementById('dischargePattern').value;
    
    // If no pattern selected, return false
    if (!pattern) return false;
    
    switch (pattern) {
      case 'continuous':
        // Continuous discharge always valid if pattern is selected
        return true;
        
      case 'custom':
        const customPeriods = document.querySelectorAll('.custom-period');
        if (customPeriods.length === 0) return false;
        
        for (let period of customPeriods) {
          const start = period.querySelector('.custom-start').value;
          const end = period.querySelector('.custom-end').value;
          if (!start || !end) return false;
        }
        return true;
        
      default:
        return false;
    }
  }

  calculateCompliance() {
    try {
      this.showNotification('Calculating MWAT/DDMAX compliance...', 'info');
      
      // Generate discharge periods
      this.dischargePeriods = this.generateDischargePeriods();
      
      // Filter merged data to discharge periods only
      const filteredData = this.filterDataToDischargePeriods(this.mergedData);
      
      // Calculate weekly MWAT and daily DDMAX
      this.results = this.performComplianceCalculations(filteredData);
      
      // Display results
      this.displayResults();
      
      this.showNotification('Compliance calculations completed successfully!', 'success');
      
    } catch (error) {
      console.error('Calculation error:', error);
      this.showNotification('Error during calculation: ' + error.message, 'error');
    }
  }

  generateDischargePeriods() {
    const pattern = document.getElementById('dischargePattern').value;
    const periods = [];
    
    switch (pattern) {
      case 'continuous':
        // For continuous discharge, create one large period covering all merged data
        if (this.mergedData && this.mergedData.length > 0) {
          const timestamps = this.mergedData.map(d => new Date(d.timestamp));
          const minTime = new Date(Math.min(...timestamps));
          const maxTime = new Date(Math.max(...timestamps));
          periods.push({ start: minTime, end: maxTime });
        }
        break;
        
      case 'custom':
        const customPeriods = document.querySelectorAll('.custom-period');
        customPeriods.forEach(period => {
          const start = new Date(period.querySelector('.custom-start').value);
          const end = new Date(period.querySelector('.custom-end').value);
          periods.push({ start, end });
        });
        break;
    }
    
    // Sort periods by start time
    periods.sort((a, b) => a.start - b.start);
    return periods;
  }

  filterDataToDischargePeriods(data) {
    const filtered = [];
    
    for (const record of data) {
      const timestamp = new Date(record.timestamp);
      
      // Check if timestamp falls within any discharge period
      for (const period of this.dischargePeriods) {
        if (timestamp >= period.start && timestamp <= period.end) {
          filtered.push(record);
          break;
        }
      }
    }
    
    return filtered;
  }

  performComplianceCalculations(filteredData) {
    // Use the already merged and filtered data
    const allData = filteredData.sort((a, b) => a.timestamp - b.timestamp);
    
    if (allData.length === 0) {
      throw new Error('No data found during discharge periods');
    }
    
    // Group data by calendar weeks
    const weeklyData = this.groupDataByWeeks(allData);
    
    // Calculate MWAT and DDMAX for each week
    const weeklyResults = [];
    let overallMWAT = 0;
    let overallDDMAX = 0;
    
    for (const [weekKey, weekData] of Object.entries(weeklyData)) {
      const weekResult = this.calculateWeeklyCompliance(weekKey, weekData);
      weeklyResults.push(weekResult);
      
      // Track overall maximums
      overallMWAT = Math.max(overallMWAT, weekResult.mwat);
      overallDDMAX = Math.max(overallDDMAX, weekResult.ddmax);
    }
    
    // Filter results for the analysis month based on DMR assignment rule
    const filteredResults = this.filterResultsForDMR(weeklyResults);
    
    return {
      overallMWAT,
      overallDDMAX,
      weeklyResults: filteredResults,
      allWeeklyResults: weeklyResults
    };
  }

  groupDataByWeeks(data) {
    const weeks = {};
    
    for (const record of data) {
      const date = new Date(record.timestamp);
      const weekKey = this.getWeekKey(date);
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      
      weeks[weekKey].push(record);
    }
    
    return weeks;
  }

  getWeekKey(date) {
    // Get the Sunday of the week containing this date
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    sunday.setHours(0, 0, 0, 0);
    
    return sunday.toISOString().split('T')[0];
  }

  calculateWeeklyCompliance(weekKey, weekData) {
    // Group data by day for DDMAX calculation
    const dailyData = this.groupDataByDays(weekData);
    
    // Calculate daily maximums
    const dailyMaximums = [];
    for (const [dayKey, dayData] of Object.entries(dailyData)) {
      const maxTemp = Math.max(...dayData.map(d => d.temperature));
      dailyMaximums.push({
        date: dayKey,
        maxTemp: maxTemp
      });
    }
    
    // DDMAX is the maximum of daily maximums for the week
    const ddmax = Math.max(...dailyMaximums.map(d => d.maxTemp));
    
    // MWAT is the average of daily maximum temperatures
    const mwat = dailyMaximums.reduce((sum, d) => sum + d.maxTemp, 0) / dailyMaximums.length;
    
    // Determine which month this week should be assigned to for DMR using Wednesday rule
    const weekStart = new Date(weekKey);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const dmrMonth = this.calculateDMRMonth(weekStart, weekEnd);
    
    return {
      weekKey,
      weekStart,
      weekEnd,
      dmrMonth,
      mwat: mwat,
      ddmax: ddmax,
      dailyMaximums,
      dischargeHours: this.calculateDischargeHours(weekData)
    };
  }

  calculateDMRMonth(weekStart, weekEnd) {
    // Wednesday rule: If the week ends on Wednesday or later in the month, 
    // it's included in that month. Otherwise, it goes to the next month.
    
    // Find Wednesday of the week (day 3, where Sunday = 0)
    const wednesday = new Date(weekStart);
    wednesday.setDate(weekStart.getDate() + 3); // Add 3 days to Sunday to get Wednesday
    
    // Get the month and year that Wednesday falls in
    const wednesdayMonth = wednesday.getMonth() + 1; // JavaScript months are 0-based
    const wednesdayYear = wednesday.getFullYear();
    
    // Get the last day of Wednesday's month
    const lastDayOfMonth = new Date(wednesdayYear, wednesdayMonth, 0).getDate();
    
    // If Wednesday is after the 3rd-to-last day of the month, 
    // the week goes to the next month
    if (wednesday.getDate() > lastDayOfMonth - 2) {
      // Week goes to next month
      const nextMonth = new Date(wednesdayYear, wednesdayMonth, 1); // First day of next month
      return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Week stays in Wednesday's month
      return `${wednesdayYear}-${String(wednesdayMonth).padStart(2, '0')}`;
    }
  }

  groupDataByDays(data) {
    const days = {};
    
    for (const record of data) {
      const date = new Date(record.timestamp);
      const dayKey = date.toISOString().split('T')[0];
      
      if (!days[dayKey]) {
        days[dayKey] = [];
      }
      
      days[dayKey].push(record);
    }
    
    return days;
  }

  calculateDischargeHours(weekData) {
    if (weekData.length === 0) return 0;
    
    // Approximate discharge hours based on data points (15-minute intervals)
    const intervals = weekData.length;
    return (intervals * 15) / 60; // Convert to hours
  }

  filterResultsForDMR(weeklyResults) {
    // Filter weeks that should be reported in the selected analysis month
    return weeklyResults.filter(week => week.dmrMonth === this.analysisMonth);
  }

  displayResults() {
    if (!this.results) return;
    
    // Display overall values
    document.getElementById('mwatValue').textContent = `${this.results.overallMWAT.toFixed(2)}°C`;
    document.getElementById('ddmaxValue').textContent = `${this.results.overallDDMAX.toFixed(2)}°C`;
    
    // Add details
    document.getElementById('mwatDetails').innerHTML = `
      Maximum Weekly Average Temperature<br>
      <small>Highest MWAT across all weeks in ${this.getMonthName(this.analysisMonth)}</small>
    `;
    
    document.getElementById('ddmaxDetails').innerHTML = `
      Daily Dissolved Maximum Temperature<br>
      <small>Highest daily maximum in ${this.getMonthName(this.analysisMonth)}</small>
    `;
    
    // Populate results table
    this.populateResultsTable();
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
  }

  populateResultsTable() {
    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = '';
    
    this.results.weeklyResults.forEach((week, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>Week ${index + 1}</td>
        <td>${week.weekStart.toLocaleDateString()} - ${week.weekEnd.toLocaleDateString()}</td>
        <td>${this.getMonthName(week.dmrMonth)}</td>
        <td>${week.mwat.toFixed(2)}°C</td>
        <td>${week.ddmax.toFixed(2)}°C</td>
        <td>${week.dischargeHours.toFixed(1)} hours</td>
      `;
      tbody.appendChild(row);
    });
  }

  getMonthName(monthString) {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  exportToExcel() {
    if (!this.results) return;
    
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['MWAT/DDMAX Compliance Report'],
        [`Analysis Month: ${this.getMonthName(this.analysisMonth)}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ['Overall Results'],
        ['Maximum Weekly Average Temperature (MWAT)', `${this.results.overallMWAT.toFixed(2)}°C`],
        ['Daily Dissolved Maximum (DDMAX)', `${this.results.overallDDMAX.toFixed(2)}°C`],
        [],
        ['Weekly Breakdown'],
        ['Week', 'Date Range', 'DMR Month', 'MWAT (°C)', 'DDMAX (°C)', 'Discharge Hours']
      ];
      
      this.results.weeklyResults.forEach((week, index) => {
        summaryData.push([
          `Week ${index + 1}`,
          `${week.weekStart.toLocaleDateString()} - ${week.weekEnd.toLocaleDateString()}`,
          this.getMonthName(week.dmrMonth),
          week.mwat.toFixed(2),
          week.ddmax.toFixed(2),
          week.dischargeHours.toFixed(1)
        ]);
      });
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      
      // Save file
      const filename = `MWAT_DDMAX_${this.analysisMonth}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      this.showNotification('Excel report exported successfully!', 'success');
      
    } catch (error) {
      console.error('Export error:', error);
      this.showNotification('Error exporting to Excel: ' + error.message, 'error');
    }
  }

  resetCalculation() {
    // Reset data
    this.sensor1Data = null;
    this.sensor2Data = null;
    this.dischargePeriods = [];
    this.analysisMonth = null;
    this.results = null;
    
    // Reset UI
    document.getElementById('file1Input').value = '';
    document.getElementById('file2Input').value = '';
    document.getElementById('file1Status').textContent = 'No file selected';
    document.getElementById('file2Status').textContent = 'No file selected';
    document.getElementById('file1Status').classList.remove('loaded');
    document.getElementById('file2Status').classList.remove('loaded');
    
    document.getElementById('analysisMonth').value = '';
    document.getElementById('dischargePattern').value = '';
    
    // Hide sections
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('dischargeSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    
    // Clear custom periods
    document.getElementById('customPeriods').innerHTML = '';
    
    this.checkCalculationReady();
    this.showNotification('Calculation reset. Ready for new analysis.', 'info');
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span class="notification-message">${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });
  }
}

// Global functions for HTML event handlers
function showHelp() {
  alert(`MWAT/DDMAX Compliance Calculator Help

This tool calculates Maximum Weekly Average Temperature (MWAT) and Daily Dissolved Maximum (DDMAX) values for Colorado CDPHE wastewater discharge compliance.

Key Features:
• Import two CSV or Excel files with 15-minute temperature sensor data
• Define discharge periods (continuous, single, daily recurring, or custom schedule)
• Calculate weekly averages with proper DMR month assignment using Wednesday rule
• Export compliance reports for regulatory submission

Discharge Pattern Options:
• Continuous: All data included (assumes discharge throughout entire period)
• Custom Periods: Define specific discharge time ranges (can be single periods, daily patterns, or irregular schedules)

Supported File Formats:
• CSV files: Date/Time in column B, Temperature in column C (starting row 3)
• Excel files: Date/Time in column B, Temperature in column C (starting row 3)

DMR Assignment Rule (Wednesday Rule):
Weeks are assigned based on where Wednesday falls. If Wednesday is in the last 3 days of a month, the week goes to the next month's DMR. Otherwise, it stays in the current month.

Examples:
• April 2025 DMR includes weeks from 3/30-4/30
• June 2025 DMR includes weeks from 6/1-6/28 (last week goes to July)

For technical support or questions about calculations, contact your environmental compliance team.`);
}

// Initialize the calculator when the page loads
let calculator;
document.addEventListener('DOMContentLoaded', () => {
  calculator = new MWATDDMAXCalculator();
});