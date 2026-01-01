# Detoolkit

**The Data Engineering Toolkit**

🔗 **Live Demo:** [https://ajmalcs.github.io/detoolkit/](https://ajmalcs.github.io/detoolkit/)

Detoolkit is a comprehensive suite of utilities designed specifically for data engineers and developers. It provides a collection of lightweight, browser-based tools to simplify common daily tasks, from SQL analysis to time conversion and format validation.

![Detoolkit Dashboard](/public/logo.png)

## 🚀 Features

### 🛠️ SQL Suite
- **SQL Formatter**: Pretty-print and standardize your SQL queries.
- **SQL Analyzer**: Static analysis to identify performance anti-patterns and improvement opportunities.
- **SQL Lineage**: Visualize table relationships with an interactive, auto-layout graph.
- **SQL Code Generator**: Build complex SQL queries visually with support for joins, filters, aggregations, and window functions.
- **DDL Designer**: Interactive table designer to generate CREATE TABLE statements for multiple database platforms.
- **JDBC Builder**: Quickly generate JDBC connection strings for various databases.

### ☁️ Azure Data Engineering
- **ADF Pipeline Analyzer**: Parse and analyze Azure Data Factory pipeline JSON with visual dependency graphs, metrics, best practices validation, and auto-generated documentation.
- **Trigger Schedule Visualizer**: Visualize ADF trigger schedules on an interactive calendar to identify gaps, overlaps, and patterns.
- **Pipeline Run Analyzer**: Analyze ADF pipeline run history to identify bottlenecks, failures, and performance trends.
- **Synapse DDL Helper**: Generate optimized DDL for Azure Synapse Analytics with distribution, indexing, and partitioning strategies.
- **Data Type Mapper**: Convert data types across platforms (SQL Server, Synapse, Spark, Parquet, PostgreSQL).

### 📊 Data Formats & Utilities
- **JSON Utilities**: Validate, format, and convert JSON data.
- **CSV to JSON**: Convert CSV data into JSON array format instantly.
- **Parquet Viewer**: Query and inspect Parquet files directly in the browser using DuckDB.
- **Mock Data Generator**: Generate realistic test data for databases and APIs with customizable schemas.

### ⏱️ Time & Productivity
- **Time Conversion**: Compare overlapping working hours across different timezones (useful for remote teams).
- **Team Time Grid**: Visualize team availability across multiple timezones with a grid view.
- **Airflow Cron**: Generate and validate cron schedules for Apache Airflow DAGs.
- **Diff Checker**: Side-by-side text and code comparison.

### 📂 Global Features
- **File Toolkit**: Open, edit, copy, and download files directly within every tool (SQL, JSON, CSV).
- **Smart Layouts**: Auto-resizing panes and dedicated toolbars for a clean workspace.
- **Command Palette**: Quick navigation with ⌘K (Mac) or Ctrl+K (Windows/Linux).

## 🛠️ Built With

This project relies on a robust stack of modern web technologies and specialized libraries to deliver high-performance tools in the browser.

### Core Framework
- **[React](https://react.dev/)**: The library for web and native user interfaces.
- **[Vite](https://vitejs.dev/)**: Next Generation Frontend Tooling for fast builds and hot replacement.
- **[TypeScript](https://www.typescriptlang.org/)**: Strongly typed JavaScript for safer and more maintainable code.

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapid UI development.
- **[Shadcn UI](https://ui.shadcn.com/)** (via Radix UI): Accessible, reusable, and composable UI components.
- **[Lucide React](https://lucide.dev/)**: Beautiful & meaningful vector icons.
- **[CMDK](https://cmdk.paco.me/)**: Fast, accessible, and composable command menu.

### Specialized Libraries
- **[DuckDB Wasm](https://duckdb.org/docs/api/wasm/overview)**: A high-performance analytical database running entirely in the browser (used for Parquet Viewer).
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)**: The code editor that powers VS Code (used for SQL, JSON, and Diff editors).
- **[dnd-kit](https://dndkit.com/)**: Lightweight, performant, accessible drag-and-drop toolkit (used for Time Converter).
- **[React Flow](https://reactflow.dev/)**: Highly customizable library for building interactive node-based UIs (used for SQL Lineage).
- **[Dagre](https://github.com/dagrejs/dagre)**: Directed graph layout engine (used for auto-aligning Lineage graphs).
- **[node-sql-parser](https://github.com/taozhi8833998/node-sql-parser)** & **[sql-formatter](https://github.com/sql-formatter-org/sql-formatter)**: Parsing and formatting SQL queries.
- **[date-fns](https://date-fns.org/)**: Modern JavaScript date utility library (used for time calculations).

## 👨‍💻 Author
Created by **ajmal.cs**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
