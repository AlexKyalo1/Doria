import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import ProfilePage from "./pages/ProfilePage";
import InstitutionsPage from "./pages/InstitutionsPage";
import LandingPage from "./pages/LandingPage";
import BasePage from "./components/BasePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import FacilitiesPage from "./pages/FacilitiesPage";
import FacilitiesMapPage from "./pages/FacilitiesMapPage";
import IncidentsPage from "./pages/IncidentsPage";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BasePage />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/update" element={<ProfileEditPage />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="facilities" element={<FacilitiesPage />} />
          <Route path="facilities/map" element={<FacilitiesMapPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

