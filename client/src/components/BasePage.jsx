import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const BasePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? "250px" : "70px",
          backgroundColor: "#0f5132",
          color: "white",
          transition: "0.3s",
          paddingTop: "20px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ fontSize: sidebarOpen ? "20px" : "16px" }}>
            {sidebarOpen ? "🛡️ Doria" : "🛡️"}
          </h2>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <NavLink to="/profile" style={linkStyle}>
            👤 {sidebarOpen && "Profile"}
          </NavLink>
          <NavLink to="/dashboard" style={linkStyle}>
            📊 {sidebarOpen && "Dashboard"}
          </NavLink>
          <NavLink to="/settings" style={linkStyle}>
            ⚙️ {sidebarOpen && "Settings"}
          </NavLink>
        </nav>
      </div>

      {/* Main Section */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Navbar */}
        <div
          style={{
            height: "60px",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ☰
          </button>

          <div>
            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = "/";
              }}
              style={{
                padding: "8px 15px",
                backgroundColor: "#842029",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            padding: "30px",
            backgroundColor: "#f4fdf6",
            overflowY: "auto",
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const linkStyle = ({ isActive }) => ({
  padding: "10px 20px",
  textDecoration: "none",
  color: "white",
  backgroundColor: isActive ? "#198754" : "transparent",
  borderRadius: "5px",
  margin: "0 10px",
});

export default BasePage;