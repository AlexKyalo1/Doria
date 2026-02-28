import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const BasePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  };

  return (
    <div style={containerStyle}>
      
      {/* Sidebar */}
      <aside style={{ ...sidebarStyle, width: sidebarOpen ? "260px" : "80px" }}>
        {/* Logo */}
        <div style={logoContainerStyle}>
          <span style={logoIconStyle}>🛡️</span>
          {sidebarOpen && <span style={logoTextStyle}>Doria</span>}
        </div>

        {/* Navigation */}
        <nav style={navStyle}>
        <NavLink to="/profile" end style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
          <span style={linkIconStyle}>👤</span>
          {sidebarOpen && <span style={linkTextStyle}>Profile</span>}
        </NavLink>

          <NavLink 
            to="/profile/update" 
            style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}
          >
            <span style={linkIconStyle}>✏️</span>
            {sidebarOpen && <span style={linkTextStyle}>Edit Profile</span>}
          </NavLink>

          <NavLink 
            to="/dashboard" 
            style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}
          >
            <span style={linkIconStyle}>📊</span>
            {sidebarOpen && <span style={linkTextStyle}>Dashboard</span>}
          </NavLink>

          <NavLink 
            to="/settings" 
            style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}
          >
            <span style={linkIconStyle}>⚙️</span>
            {sidebarOpen && <span style={linkTextStyle}>Settings</span>}
          </NavLink>
        </nav>
      </aside>

      {/* Main Section */}
      <div style={mainContainerStyle}>
        
        {/* Top Bar */}
        <header style={headerStyle}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={menuButtonStyle}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#9a2b2b")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#842029")}
          >
            Logout
          </button>
        </header>

        {/* Page Content */}
        <main style={contentStyle}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/* ================= STYLES ================= */

const containerStyle = {
  display: "flex",
  height: "100vh",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const sidebarStyle = {
  backgroundColor: "#0f5132",
  color: "white",
  transition: "width 0.3s ease",
  paddingTop: "20px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
};

const logoContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "0 10px 20px",
  marginBottom: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.2)",
};

const logoIconStyle = {
  fontSize: "28px",
};

const logoTextStyle = {
  fontSize: "20px",
  fontWeight: "600",
  letterSpacing: "0.5px",
};

const navStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "0 8px",
};

const getLinkStyle = (isActive, sidebarOpen) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: sidebarOpen ? "12px 16px" : "12px 0",
  textDecoration: "none",
  color: "white",
  backgroundColor: isActive ? "#198754" : "transparent",
  borderRadius: "8px",
  justifyContent: sidebarOpen ? "flex-start" : "center",
  transition: "all 0.2s ease",
  margin: "0 4px",
  whiteSpace: "nowrap",
});

const linkIconStyle = {
  fontSize: "20px",
  minWidth: "24px",
  textAlign: "center",
};

const linkTextStyle = {
  fontSize: "15px",
  fontWeight: "500",
};

const mainContainerStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  backgroundColor: "#f8fdf9",
};

const headerStyle = {
  height: "70px",
  backgroundColor: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 24px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const menuButtonStyle = {
  background: "none",
  border: "none",
  fontSize: "24px",
  cursor: "pointer",
  color: "#4b5563",
  padding: "8px 12px",
  borderRadius: "6px",
  transition: "background-color 0.2s",
};

const logoutButtonStyle = {
  padding: "8px 20px",
  backgroundColor: "#842029",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "background-color 0.2s ease",
  boxShadow: "0 2px 4px rgba(132, 32, 41, 0.2)",
};

const contentStyle = {
  flex: 1,
  padding: "32px",
  overflowY: "auto",
};

export default BasePage;