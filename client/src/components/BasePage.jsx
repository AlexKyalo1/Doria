import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { applyColorMode, getFrontendSettings } from "../utils/frontendSettings";

const routeTitles = {
  "/profile": "Profile",
  "/profile/update": "Edit Profile",
  "/institutions": "Institutions",
  "/settings": "Settings",
  "/dashboard": "Dashboard",
  "/admin/users": "Admin Users",
};

const BasePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [frontendSettings, setFrontendSettings] = useState(getFrontendSettings());
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const onSettingsChange = () => setFrontendSettings(getFrontendSettings());
    window.addEventListener("frontend-settings-changed", onSettingsChange);
    return () => {
      window.removeEventListener("frontend-settings-changed", onSettingsChange);
    };
  }, []);

  useEffect(() => {
    applyColorMode(frontendSettings.colorMode);
  }, [frontendSettings.colorMode]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/accounts/profile/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      } catch {
        // Keep footer fallbacks if profile fetch fails.
      }
    };

    fetchCurrentUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  };

  const isDark = frontendSettings.colorMode === "dark";
  const pageTitle = routeTitles[location.pathname] || "Dashboard";
  const userName =
    currentUser?.first_name || currentUser?.last_name
      ? `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim()
      : currentUser?.username || "User";
  const userEmail = currentUser?.email || "No email";
  const userInitials = (
    (currentUser?.first_name?.[0] || currentUser?.username?.[0] || "U") +
    (currentUser?.last_name?.[0] || "")
  ).toUpperCase();

  const sidebarWidth = sidebarOpen
    ? frontendSettings.compactSidebar
      ? "240px"
      : "280px"
    : frontendSettings.compactSidebar
      ? "72px"
      : "80px";

  const transition = frontendSettings.reducedMotion ? "none" : "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  const dynamicContentStyle = useMemo(
    () => ({
      ...contentStyle,
      padding: frontendSettings.denseContent ? "18px" : "32px",
      backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
    }),
    [frontendSettings.denseContent, isDark]
  );

  const theme = isDark
    ? {
        mainBg: "#0b1220",
        headerBg: "#0f172a",
        headerBorder: "#1f2937",
        pageTitle: "#e5e7eb",
        menuBg: "#111827",
        menuBorder: "#374151",
        menuColor: "#d1d5db",
        sidebarGradient: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
      }
    : {
        mainBg: "#f0fdf4",
        headerBg: "#ffffff",
        headerBorder: "#dcfce7",
        pageTitle: "#0f5132",
        menuBg: "#f0fdf4",
        menuBorder: "#bbf7d0",
        menuColor: "#166534",
        sidebarGradient: "linear-gradient(180deg, #0f5132 0%, #166534 100%)",
      };

  return (
    <div style={{ ...containerStyle, backgroundColor: theme.mainBg }}>
      <aside
        style={{
          ...sidebarStyle,
          width: sidebarWidth,
          transition,
          background: theme.sidebarGradient,
        }}
      >
        <div style={logoContainerStyle}>
          <div style={logoWrapperStyle}>
            <span style={logoIconStyle}>{"\ud83c\udf3f"}</span>
            {sidebarOpen && <span style={logoTextStyle}>Doria</span>}
          </div>
        </div>

        <nav style={navStyle}>
          <NavLink to="/profile" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
            <span style={linkIconStyle}>{"\ud83d\udc64"}</span>
            {sidebarOpen && <span style={linkTextStyle}>Profile</span>}
          </NavLink>

          <NavLink to="/profile/update" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
            <span style={linkIconStyle}>{"\u270e"}</span>
            {sidebarOpen && <span style={linkTextStyle}>Edit Profile</span>}
          </NavLink>

          <NavLink to="/dashboard" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
            <span style={linkIconStyle}>{"\ud83d\udcca"}</span>
            {sidebarOpen && <span style={linkTextStyle}>Dashboard</span>}
          </NavLink>

          <NavLink to="/settings" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
            <span style={linkIconStyle}>{"\u2699\ufe0f"}</span>
            {sidebarOpen && <span style={linkTextStyle}>Settings</span>}
          </NavLink>

          {Boolean(currentUser?.is_staff) && (
            <NavLink to="/admin/users" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
              <span style={linkIconStyle}>{"\ud83d\udee0\ufe0f"}</span>
              {sidebarOpen && <span style={linkTextStyle}>Admin Users</span>}
            </NavLink>
          )}

          <NavLink to="/institutions" style={({ isActive }) => getLinkStyle(isActive, sidebarOpen)}>
            <span style={linkIconStyle}>{"\ud83c\udfdb\ufe0f"}</span>
            {sidebarOpen && <span style={linkTextStyle}>Institutions</span>}
          </NavLink>
        </nav>

        {sidebarOpen && (
          <div style={sidebarFooterStyle}>
            <div style={userInfoStyle}>
              <span style={userAvatarStyle}>{userInitials}</span>
              <div style={userDetailsStyle}>
                <span style={userNameStyle}>{userName}</span>
                <span style={userEmailStyle}>{userEmail}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div style={{ ...mainContainerStyle, backgroundColor: theme.mainBg }}>
        <header
          style={{
            ...headerStyle,
            backgroundColor: theme.headerBg,
            borderBottom: `1px solid ${theme.headerBorder}`,
          }}
        >
          <div style={headerLeftStyle}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                ...menuButtonStyle,
                backgroundColor: theme.menuBg,
                border: `1px solid ${theme.menuBorder}`,
                color: theme.menuColor,
              }}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? "\u25c0" : "\u25b6"}
            </button>
            <span style={{ ...pageTitleStyle, color: theme.pageTitle }}>{pageTitle}</span>
          </div>

          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#9a2b2b";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#842029";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={logoutIconStyle}>{"\ud83d\udeaa"}</span>
            Logout
          </button>
        </header>

        <main style={dynamicContentStyle}>
          <div style={contentWrapperStyle}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const containerStyle = {
  display: "flex",
  height: "100vh",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
};

const sidebarStyle = {
  color: "white",
  paddingTop: "24px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "4px 0 20px rgba(15, 81, 50, 0.15)",
  position: "relative",
  zIndex: 10,
};

const logoContainerStyle = {
  padding: "0 20px 24px",
  marginBottom: "16px",
};

const logoWrapperStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.1)",
  borderRadius: "12px",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const logoIconStyle = {
  fontSize: "24px",
  fontWeight: "700",
  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  padding: "8px",
  borderRadius: "10px",
  width: "40px",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
};

const logoTextStyle = {
  fontSize: "22px",
  fontWeight: "600",
  color: "white",
  letterSpacing: "-0.5px",
  textShadow: "0 2px 4px rgba(0,0,0,0.1)",
};

const navStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  padding: "0 16px",
  flex: 1,
};

const getLinkStyle = (isActive, sidebarOpen) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: sidebarOpen ? "12px 16px" : "12px 0",
  textDecoration: "none",
  color: isActive ? "white" : "rgba(255,255,255,0.8)",
  backgroundColor: isActive ? "#198754" : "transparent",
  borderRadius: "12px",
  justifyContent: sidebarOpen ? "flex-start" : "center",
  transition: "all 0.2s ease",
  margin: "0 4px",
  whiteSpace: "nowrap",
  border: isActive ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
  boxShadow: isActive ? "0 4px 12px rgba(25, 135, 84, 0.3)" : "none",
});

const linkIconStyle = {
  fontSize: "18px",
  minWidth: "32px",
  textAlign: "center",
  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
};

const linkTextStyle = {
  fontSize: "15px",
  fontWeight: "500",
  flex: 1,
};

const sidebarFooterStyle = {
  padding: "20px 16px",
  borderTop: "1px solid rgba(255,255,255,0.1)",
  marginTop: "auto",
};

const userInfoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "8px",
  background: "rgba(0,0,0,0.2)",
  borderRadius: "12px",
  cursor: "pointer",
  transition: "background 0.2s",
  border: "1px solid rgba(255,255,255,0.1)",
};

const userAvatarStyle = {
  width: "40px",
  height: "40px",
  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: "600",
  color: "white",
};

const userDetailsStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const userNameStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "white",
};

const userEmailStyle = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.7)",
};

const mainContainerStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  height: "80px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 32px",
  boxShadow: "0 2px 8px rgba(15, 81, 50, 0.08)",
};

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
};

const menuButtonStyle = {
  background: "none",
  border: "none",
  fontSize: "20px",
  cursor: "pointer",
  padding: "8px 12px",
  borderRadius: "10px",
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
};

const pageTitleStyle = {
  fontSize: "24px",
  fontWeight: "600",
  letterSpacing: "-0.5px",
};

const logoutButtonStyle = {
  padding: "10px 24px",
  backgroundColor: "#842029",
  color: "white",
  border: "none",
  borderRadius: "12px",
  fontSize: "15px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 6px rgba(132, 32, 41, 0.2)",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const logoutIconStyle = {
  fontSize: "18px",
};

const contentStyle = {
  flex: 1,
  overflowY: "auto",
};

const contentWrapperStyle = {
  maxWidth: "1400px",
  margin: "0 auto",
  width: "100%",
};

export default BasePage;
