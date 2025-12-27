# Detoolkit

**The Data Engineering Toolkit**

🔗 **Live Demo:** [https://ajmalcs.github.io/detoolkit/](https://ajmalcs.github.io/detoolkit/)

Detoolkit is a comprehensive suite of utilities designed specifically for data engineers and developers. It provides a collection of lightweight, browser-based tools to simplify common daily tasks, from SQL analysis to time conversion and format validation.

![Detoolkit Dashboard](/public/logo.png)

## 🚀 Features

### 🛠️ SQL Suite
- **SQL Formatter**: Pretty-print and standardize your SQL queries.
- **SQL Analyzer**: Static analysis to identify performance anti-patterns and improvement opportunities.
- **SQL Lineage**: Visualize table relationships and join dependencies.
- **JDBC Builder**: Quickly generate JDBC connection strings for various databases.

### 📊 Data Formats
- **JSON Utilities**: Validate, format, and convert JSON data.
- **CSV to JSON**: Convert CSV data into JSON array format instantly.
- **Parquet Viewer**: Query and inspect Parquet files directly in the browser using DuckDB.

### ☁️ Cloud & Infrastructure
- **ARN Parser**: Parse and inspect AWS Resource Names (ARNs) to extract partition, region, account, and resource details.
- **Airflow Cron**: Generate and validate cron schedules for Apache Airflow DAGs.

### ⏱️ Time & Productivity
- **Time Conversion**: Compare overlapping working hours across different timezones (useful for remote teams).
- **Unix Time**: Convert between Unix timestamps and human-readable dates.
- **Diff Checker**: Side-by-side text and code comparison.

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
- **[Mermaid](https://mermaid.js.org/)**: Diagramming and charting tool (used for SQL Lineage).
- **[node-sql-parser](https://github.com/taozhi8833998/node-sql-parser)** & **[sql-formatter](https://github.com/sql-formatter-org/sql-formatter)**: Parsing and formatting SQL queries.
- **[date-fns](https://date-fns.org/)**: Modern JavaScript date utility library (used for time calculations).

## 👨‍💻 Author
Created by **ajmal.cs**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
