# Water Treatment Tools

A comprehensive collection of data analysis and visualization tools for water treatment professionals. This workspace provides a centralized hub for various analytics applications designed specifically for water treatment operations, regulatory compliance, and operator training.

## 🚀 Quick Start

1. **Access the Dashboard**: Open `packages/dashboard/dashboard.html` for the main interface
2. **Navigate to Tools**: Use the dashboard to access individual applications
3. **Sample Data**: Test files are available in the `data/` directory
4. **Documentation**: Detailed guides available in the `docs/` directory

## 🛠️ Available Tools

### 🏠 Dashboard (`packages/dashboard/`)
**Centralized application hub with modern interface**

**Features:**
- Clean, professional interface with city branding
- Easy navigation between all tools
- Tool descriptions and quick access
- Responsive design for all devices
- Official water treatment analysis platform

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
- ✅ Added "Load Water Quality Demo Data" button for specialized datasets
- ✅ Paddle RPM enabled by default for comprehensive analysis
- ✅ Removed dashboard button for cleaner interface
- ✅ Redesigned UI with tabbed interface for better workflow
- ✅ Enhanced run date parsing with timezone removal
- ✅ Header action buttons for streamlined operations
- ✅ Improved data visualization and statistics display
- ✅ Test file loading functionality for quick demos
- ✅ Comprehensive help modals for statistics and forecast metrics
- ✅ Advanced time window and filtering controls

### 🧪 Dose Predictor (`packages/dose-predictor/`)
**AI-powered sodium permanganate dose optimization using machine learning**

**Features:**
- Machine learning trained on operational data
- Predictive dosing algorithms for sodium permanganate
- Historical data analysis and trending
- Treatment optimization recommendations
- Chemical cost calculation and ROI analysis

### 📊 MWAT & Daily Maximum Calculator (`packages/data-parser/`)
**Calculate Maximum Weekly Average Temperature (MWAT) and Daily Maximum Temperature per Colorado DMR requirements**

**Features:**
- Colorado DMR compliance calculations
- MWAT (Maximum Weekly Average Temperature) calculations
- Daily Maximum temperature tracking
- Data merging and validation
- Automated regulatory report generation
- Temperature trend analysis

### 📚 Regulation 100 Study Guide (`packages/regulation-100-study/`)
**Interactive slideshow for mastering water and wastewater facility operator certification requirements**

**Features:**
- Interactive slideshow format
- Colorado Regulation 100 content
- Water and wastewater operator certification prep
- Professional exam preparation materials
- Self-paced learning modules

### 🃏 Water Treatment Flashcards (`packages/water-treatment-flashcards/`)
**Master water treatment terminology with interactive flashcards from professional reference books**

**Features:**
- Interactive flashcard system
- Professional water treatment terminology
- Reference book content integration
- Study progress tracking
- Spaced repetition learning

### 💧 Sodium Hypochlorite Calculator (`packages/sodium-hypochlorite-calculator/`)
**Calculate chemical addition to filter basins for residual increase using 10% sodium hypochlorite solution**

**Features:**
- Filter basin dosing calculations
- 10% sodium hypochlorite solution calculations
- Residual increase optimization
- Chemical addition rate calculations
- Real-time calculation updates

### 🏭 Fan Press Data Tracker (`packages/fan-press-tracker/`)
**Enter and analyze fan press operational data to optimize cake solids performance with interactive trending**

**Features:**
- Fan press operational data entry
- Cake solids performance optimization
- Interactive trending and visualization
- Historical performance tracking
- Operational efficiency analysis

### 📈 Water Data Explorer (`apps/water-data-explorer/`)
**Interactive analysis of water quality and treatment parameters with correlation, time series, distribution, and optimization charts**

**Features:**
- Water quality parameter analysis
- Water treatment parameter correlation
- Time series analysis and trending
- Distribution analysis and statistics
- Optimization charts and recommendations
- Interactive data visualization
- Multiple chart types and views

## 📁 Project Structure
```
water-treatment-tools/
├── packages/
│   ├── dashboard/                      # Main application dashboard
│   ├── robojar-analyzer/              # RoboJar data analysis tool
│   ├── dose-predictor/                # AI-powered chemical dosing calculator
│   ├── data-parser/                   # MWAT & Daily Maximum calculator
│   ├── regulation-100-study/          # Operator certification study guide
│   ├── water-treatment-flashcards/    # Interactive flashcards
│   ├── sodium-hypochlorite-calculator/# Chemical dosing calculator
│   ├── fan-press-tracker/            # Fan press operational data tracker
│   └── water-data-explorer/          # Water quality data analysis
├── data/                              # Sample data files and templates
├── docs/                              # Documentation and guides
├── city-logos/                        # Branding and visual assets
├── city-fonts/                        # Typography resources
├── api/                               # Backend services
└── README.md                          # This file
```

## 🎯 Use Cases

- **Laboratory Analysis**: Process RoboJar particle analysis reports with advanced statistics
- **Treatment Optimization**: AI-powered chemical dosing predictions and optimization
- **Regulatory Compliance**: Calculate MWAT/DDMAX for Colorado DMR reporting
- **Operator Training**: Interactive study guides and flashcards for certification
- **Data Visualization**: Create professional charts and reports for all parameters
- **Quality Control**: Statistical analysis with outlier detection and trending
- **Operations Management**: Track fan press performance and water treatment parameters
- **Chemical Calculations**: Precise dosing calculations for various treatment chemicals
- **Process Monitoring**: Real-time analysis of water quality and treatment data

## 🔧 Technical Details

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js for interactive visualizations
- **File Processing**: SheetJS for Excel file parsing
- **PDF Generation**: jsPDF for report creation
- **Styling**: Modern CSS with CSS Variables and Flexbox/Grid
- **Responsive**: Mobile-first design approach

## 📊 Supported File Formats

- **Excel Files**: `.xls`, `.xlsx` (RoboJar reports, water quality data, operational data)
- **CSV Files**: Comma-separated values for various data types
- **Export Formats**: PNG images, PDF reports, data exports
- **Demo Data**: Built-in test files for immediate functionality testing

## 🏆 Key Benefits

- **No Installation Required**: Browser-based applications work on any device
- **Professional Results**: Publication-ready charts and reports for presentations
- **Regulatory Compliant**: Built specifically for water treatment industry standards
- **User Friendly**: Intuitive interfaces with comprehensive help systems
- **Fast Processing**: Optimized for large datasets with real-time updates
- **Quality Assurance**: Built-in data validation, error checking, and statistical analysis
- **Comprehensive Coverage**: From lab analysis to operator training to regulatory compliance
- **AI-Powered**: Machine learning integration for predictive analytics
- **Customizable**: Flexible analysis options and export formats
- **Educational**: Built-in training materials and study guides

## 📞 Support

For questions, issues, or feature requests, please check the documentation in the `docs/` folder or create an issue in the project repository.

---

*Built for water treatment professionals by water treatment professionals* 💧
