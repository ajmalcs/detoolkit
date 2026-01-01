# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-01-01

### 🚀 New Features

#### Azure Data Engineering Suite
- **ADF Pipeline Analyzer**: Visual dependency graphs, metrics calculate, and best practices validation for Azure Data Factory pipelines.
- **Trigger Schedule Visualizer**: Interactive calendar view to visualize and analyze ADF trigger schedules.
- **Pipeline Run Analyzer**: Comprehensive dashboard for analyzing pipeline run history, identifying failures, and optimizing performance.
- **Synapse DDL Helper**: Tooling to generate optimized DDL statements for Azure Synapse Analytics (DW), including distribution and indexing strategies.
- **Data Type Mapper**: Utility to convert data types between SQL Server, Synapse, Spark, Parquet, and PostgreSQL.

#### SQL Power Tools
- **SQL Code Generator**: Visual query builder supports complex joins, aggregations, window functions, and CTEs.
- **DDL Designer**: Interactive visual designer for creating database schemas and generating DDL.
- **SQL Lineage**: Enhanced visualization with auto-layout for complex query dependencies.

#### Productivity & Utilities
- **Team Time Grid**: New tool for coordinating availability across global teams.
- **Mock Data Generator**: Generate realistic test datasets with customizable schemas.
- **Command Palette**: Added global command menu (Ctrl/Cmd + K) for quick navigation.

### 🛠 Improvements
- **Performance**: significant optimizations in large file processing for CSV and JSON tools.
- **UI/UX**: Fresh look with improved dark mode contrast and consistent component styling.
- **Documentation**: Comprehensive README update with detailed feature breakdown.

### 🐛 Bug Fixes
- Fixed ARN Parser issues (tool replaced/refactored).
- Resolved mobile navigation glitches.
- Fixed SQL generation edge cases in formatter.
