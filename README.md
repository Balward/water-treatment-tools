# Analytics Workspace

A monorepo containing multiple data analysis and visualization tools. This workspace provides a centralized hub for various analytics applications and shared resources.

## Projects

### 📊 RoboJar Analyzer (`packages/robojar-analyzer/`)
Web-based analyzer for RoboJar Excel reports featuring interactive charts, statistical analysis, forecasting algorithms, and data export capabilities. Built with Chart.js and vanilla JavaScript.

### 🚀 Dashboard (`packages/dashboard/`)
Centralized application dashboard providing easy access to all analytics tools in the workspace.

## Getting Started

1. Open `packages/dashboard/dashboard.html` to access the main dashboard
2. Navigate to individual applications through the dashboard interface
3. Sample data files are located in the `data/` directory

## Structure
```
analytics-workspace/
├── packages/
│   ├── robojar-analyzer/    # RoboJar Excel report analyzer
│   └── dashboard/           # Main application dashboard
├── data/                    # Shared data files
├── docs/                    # Documentation
└── README.md               # This file
```
