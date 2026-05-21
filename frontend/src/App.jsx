import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import StudentChat from "./pages/StudentChat.jsx";
import InstructorDashboard from "./pages/InstructorDashboard.jsx";
import AdminUpload from "./pages/AdminUpload.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<StudentChat />} />
        <Route path="/dashboard" element={<InstructorDashboard />} />
        <Route path="/admin" element={<AdminUpload />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
