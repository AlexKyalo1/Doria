import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import ProfilePage from "./pages/ProfilePage";
import MyPage from "./pages/MyPage";
import BasePage from "./components/BasePage";

// 🔐 Simple Protected Route
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<MyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />

        {/* Protected Routes wrapped in BasePage */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BasePage />
            </ProtectedRoute>
          }
        >
          <Route path="profile" element={<ProfilePage />} />
        </Route>

      </Routes>
    </Router>
  );
}

export default App;