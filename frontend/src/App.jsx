import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import StudentChat from "./pages/StudentChat.jsx";
import InstructorDashboard from "./pages/InstructorDashboard.jsx";
import AdminUpload from "./pages/AdminUpload.jsx";
import DevView from "./pages/DevView.jsx";
import ArchitectureDeck from "./pages/ArchitectureDeck.jsx";

const PROFESSOR_TABS = [
  { to: "/professor", label: "Escalation queue", end: true },
  { to: "/professor/materials", label: "Course materials" },
];

const DEV_TABS = [
  { to: "/dev", label: "Question log", end: true },
  { to: "/dev/architecture", label: "Architecture" },
];

export default function App() {
  return (
    <Routes>
      {/* Student portal — no nav tabs */}
      <Route element={<Layout />}>
        <Route path="/" element={<StudentChat />} />
      </Route>

      {/* Professor portal */}
      <Route element={<Layout tabs={PROFESSOR_TABS} />}>
        <Route path="/professor" element={<InstructorDashboard />} />
        <Route path="/professor/materials" element={<AdminUpload />} />
      </Route>

      {/* Developer portal */}
      <Route element={<Layout tabs={DEV_TABS} />}>
        <Route path="/dev" element={<DevView />} />
        <Route path="/dev/architecture" element={<ArchitectureDeck />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
