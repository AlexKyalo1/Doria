import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import ProfilePage from "./pages/ProfilePage";
import InstitutionsPage from "./pages/InstitutionsPage";
import LandingPage from "./pages/LandingPage";
import PublicIncidentReportPage from "./pages/PublicIncidentReportPage";
import IncidentStatusLookupPage from "./pages/IncidentStatusLookupPage";
import BasePage from "./components/BasePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import DemoGuidePage from "./pages/DemoGuidePage";
import BillingPage from "./pages/BillingPage";
import BillingAdminPage from "./pages/BillingAdminPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminBlockedIpsPage from "./pages/AdminBlockedIpsPage";
import AiIncidentInsightsPage from "./pages/AiIncidentInsightsPage";
import FacilitiesPage from "./pages/FacilitiesPage";
import FacilitiesMapPage from "./pages/FacilitiesMapPage";
import EmergencyServicesPage from "./pages/EmergencyServicesPage";
import IncidentsPage from "./pages/IncidentsPage";
import ManageIncidentsPage from "./pages/ManageIncidentsPage";
import IncidentAreaIntelligencePage from "./pages/IncidentAreaIntelligencePage";
import VipSurveillancePage from "./pages/VipSurveillancePage";
import ChatPage from "./pages/ChatPage";
import CallCenterWorkboardPage from "./pages/CallCenterWorkboardPage";
import ApiPlatformPage from "./pages/ApiPlatformPage";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/report-incident" element={<PublicIncidentReportPage />} />
        <Route path="/incident-status" element={<IncidentStatusLookupPage />} />
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
          <Route path="demo-guide" element={<DemoGuidePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="api-platform" element={<ApiPlatformPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/update" element={<ProfileEditPage />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="facilities" element={<FacilitiesPage />} />
          <Route path="facilities/map" element={<FacilitiesMapPage />} />
          <Route path="emergency-services" element={<EmergencyServicesPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/manage" element={<ManageIncidentsPage />} />
          <Route path="incidents/area-intelligence" element={<IncidentAreaIntelligencePage />} />
          <Route path="incidents/vip-surveillance" element={<VipSurveillancePage />} />
          <Route path="chat" element={<CallCenterWorkboardPage />} />
          <Route path="ai/insights" element={<AiIncidentInsightsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="admin/billing" element={<BillingAdminPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/security" element={<AdminBlockedIpsPage />} />
          <Route path="admin/ai-console" element={<ChatPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
