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
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/update" element={<ProfileEditPage />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;