import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import MyPage from "./pages/MyPage";

function App() {
  return (
    <Router>
      {/* Navbar */}
      <nav style={{
        padding: "15px",
        backgroundColor: "#0f5132",
        color: "white",
        display: "flex",
        justifyContent: "flex-start",
        gap: "15px"
      }}>
        <Link to="/" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>Home</Link>
        <Link to="/login" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>Login</Link>
        <Link to="/register" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>Registration</Link>

      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<MyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegistrationPage />} />
      </Routes>
    </Router>
  );
}

export default App;