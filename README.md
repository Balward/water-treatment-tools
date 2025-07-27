# Water Treatment Tools

A comprehensive collection of data analysis and visualization tools for water treatment professionals. This workspace provides a centralized hub for various analytics applications designed specifically for water treatment operations and compliance reporting.

## 🚀 Quick Start

1. **Access the Dashboard**: Open `packages/dashboard/dashboard.html` for the main interface
2. **Navigate to Tools**: Use the dashboard to access individual applications
3. **Sample Data**: Test files are available in the `data/` directory
4. **Documentation**: Detailed guides available in the `docs/` directory

## 🛠️ Available Tools

### 📊 RoboJar Analyzer (`packages/robojar-analyzer/`)
**Advanced Excel report analyzer for RoboJar particle analysis data**

**Key Features:**
- **Tabbed Interface**: Analyze multiple parameters simultaneously (Mean Diameter, Mean Volume, Particle Count, Concentration)
- **Smart Date Formatting**: Run dates automatically formatted as MM-DD-YYYY HH:MM
- **Interactive Charts**: Line charts and scatter plots with Chart.js
- **Statistical Analysis**: Comprehensive statistics with noise filtering and time window controls
- **Advanced Forecasting**: Multiple algorithms (Adaptive, Windowed, Weighted, Simple polynomial regression)
- **Export Capabilities**: PNG charts and comprehensive PDF reports
- **Quality Metrics**: R², RMSE, MAE, MAPE for forecast validation
- **Help System**: Built-in modal help for statistics and forecast metrics explanations
- **Time Window Controls**: Full duration, steady state, final 10 minutes, or custom time ranges
- **Data Filtering**: Remove outliers (IQR method) and smooth data with moving averages
- **Header Action Bar**: Quick access buttons for chart generation and export functions
- **Test File Support**: Load sample data for testing and demonstrations
- **Notification System**: User-friendly alerts and status messages
- **Responsive Design**: Works on desktop and mobile devices

**Usage Instructions:**
1. **Upload File**: Import RoboJar Excel report (.xlsx/.xls) or load test file
2. **Generate Charts**: Click "Generate Charts" to create visualizations for all parameters
3. **Navigate Tabs**: Switch between Mean Diameter, Mean Volume, Particle Count, and Concentration
4. **Configure Analysis**: Adjust time windows, forecasting methods, and filtering options
5. **View Statistics**: Comprehensive statistics with help tooltips for understanding metrics
6. **Export Results**: Save individual PNG charts or generate comprehensive PDF reports

**Recent Updates:**
- ✅ Redesigned UI with tabbed interface for better workflow
- ✅ Enhanced run date parsing with timezone removal
- ✅ Header action buttons for streamlined operations
- ✅ Improved data visualization and statistics display
- ✅ Test file loading functionality for quick demos
- ✅ Comprehensive help modals for statistics and forecast metrics
- ✅ Advanced time window and filtering controls

### 💧 Dose Predictor (`packages/dose-predictor/`)
**Intelligent chemical dosing calculator for water treatment**

**Features:**
- Predictive dosing algorithms
- Historical data analysis
- Treatment optimization
- Chemical cost calculation

### 📈 MWAT/DDMAX Calculator (`packages/mwat-ddmax-calculator/`)
**Maximum Daily and Monthly Average calculations for regulatory compliance**

**Features:**
- DMR compliance calculations
- Continuous and batch discharge options
- Data merging and validation
- Automated report generation

### 🚀 Dashboard (`packages/dashboard/`)
**Centralized application hub with modern interface**

**Features:**
- Easy navigation between tools
- Tool status monitoring
- Quick access to documentation
- Responsive design for all devices

## 📁 Project Structure
```
water-treatment-tools/
├── packages/
│   ├── robojar-analyzer/        # RoboJar data analysis tool
│   ├── dose-predictor/          # Chemical dosing calculator
│   ├── mwat-ddmax-calculator/   # Regulatory compliance calculator
│   └── dashboard/               # Main application dashboard
├── data/                        # Sample data files and templates
├── docs/                        # Documentation and guides
├── scripts/                     # Build and deployment scripts
└── README.md                    # This file
```

## 🎯 Use Cases

- **Laboratory Analysis**: Process RoboJar particle analysis reports
- **Treatment Optimization**: Predict optimal chemical dosing
- **Regulatory Compliance**: Calculate MWAT/DDMAX for DMR reporting
- **Data Visualization**: Create professional charts and reports
- **Quality Control**: Statistical analysis with outlier detection

## 🔧 Technical Details

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js for interactive visualizations
- **File Processing**: SheetJS for Excel file parsing
- **PDF Generation**: jsPDF for report creation
- **Styling**: Modern CSS with CSS Variables and Flexbox/Grid
- **Responsive**: Mobile-first design approach

## 📊 Supported File Formats

- **Excel Files**: `.xls`, `.xlsx` (RoboJar reports)
- **CSV Files**: Comma-separated values
- **Export Formats**: PNG images, PDF reports

## 🏆 Key Benefits

- **No Installation Required**: Browser-based applications
- **Professional Results**: Publication-ready charts and reports
- **Regulatory Compliant**: Built for water treatment industry standards
- **User Friendly**: Intuitive interfaces with helpful tooltips
- **Fast Processing**: Optimized for large datasets
- **Quality Assurance**: Built-in data validation and error checking

## 📞 Support

For questions, issues, or feature requests, please check the documentation in the `docs/` folder or create an issue in the project repository.

---

*Built for water treatment professionals by water treatment professionals* 💧
