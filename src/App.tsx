import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import Dashboard from './pages/Dashboard'
import SqlFormatter from './pages/SqlFormatter'
import JsonUtils from './pages/JsonUtils'
import DiffChecker from './pages/DiffChecker'
import CsvConverter from './pages/CsvConverter'
import TimeConverter from './pages/TimeConverter'
import ParquetViewer from './pages/ParquetViewer'
import JdbcBuilder from './pages/JdbcBuilder'
import AirflowCron from './pages/AirflowCron'
import SqlAnalyzer from './pages/SqlAnalyzer'
import SqlLineage from './pages/SqlLineage'
import TeamTimeGrid from './pages/TeamTimeGrid'
import MockDataGenerator from './pages/MockDataGenerator'
import DdlDesigner from './pages/DdlDesigner'
import SqlCodeGenerator from './pages/SqlCodeGenerator'
import DataTypeMapper from './pages/DataTypeMapper'
import SynapseDdlHelper from './pages/SynapseDdlHelper'
import AdfPipelineAnalyzer from './pages/AdfPipelineAnalyzer'
import TriggerScheduleVisualizer from './pages/TriggerScheduleVisualizer'
import PipelineRunAnalyzer from './pages/PipelineRunAnalyzer'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sql" element={<SqlFormatter />} />
          <Route path="json" element={<JsonUtils />} />
          <Route path="diff" element={<DiffChecker />} />
          <Route path="csv" element={<CsvConverter />} />
          <Route path="time" element={<TimeConverter />} />
          <Route path="parquet" element={<ParquetViewer />} />
          <Route path="jdbc" element={<JdbcBuilder />} />
          <Route path="cron" element={<AirflowCron />} />
          <Route path="sql-analyzer" element={<SqlAnalyzer />} />
          <Route path="sql-lineage" element={<SqlLineage />} />
          <Route path="team-time" element={<TeamTimeGrid />} />
          <Route path="mock-data" element={<MockDataGenerator />} />
          <Route path="ddl-designer" element={<DdlDesigner />} />
          <Route path="sql-code-gen" element={<SqlCodeGenerator />} />
          <Route path="data-type-mapper" element={<DataTypeMapper />} />
          <Route path="synapse-ddl" element={<SynapseDdlHelper />} />
          <Route path="adf-pipeline" element={<AdfPipelineAnalyzer />} />
          <Route path="trigger-visualizer" element={<TriggerScheduleVisualizer />} />
          <Route path="run-analyzer" element={<PipelineRunAnalyzer />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App

