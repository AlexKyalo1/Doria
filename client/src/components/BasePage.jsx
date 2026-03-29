import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { ACCOUNTS_API_BASE } from "../utils/apiBase";
import { applyColorMode, getFrontendSettings } from "../utils/frontendSettings";

const routeTitles = {
  "/profile": "Profile",
  "/profile/update": "Edit Profile",
  "/institutions": "Institutions",
  "/facilities": "Facilities",
  "/facilities/map": "Facility Map",
  "/emergency-services": "Emergency Services",
  "/incidents": "Incidents",
  "/incidents/manage": "Incident Manager",
  "/incidents/area-intelligence": "Area Intelligence",
  "/incidents/vip-surveillance": "VIP Surveillance",
  "/chat": "Call Center Board",
  "/ai/insights": "AI Insights",
  "/settings": "Settings",
  "/billing": "Billing",
  "/demo-guide": "5-Minute Demo",
  "/dashboard": "Dashboard",
  "/api-platform": "API Platform",
  "/admin/users": "Admin Users",
  "/admin/security": "Security Control",
  "/admin/billing": "Billing Admin",
  "/admin/ai-console": "Admin AI Console",
};

const BasePage = () => {
  const getImpersonationInfo = () => {
    const impersonatorToken = localStorage.getItem("impersonator_access_token");
    if (!impersonatorToken) return null;
    let impersonatedUser = null;
    try {
      impersonatedUser = JSON.parse(localStorage.getItem("impersonated_user") || "null");
    } catch {
      impersonatedUser = null;
    }
    return { impersonatedUser };
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    account: false,
    operations: false,
    core: false,
    admin: false,
  });

  const navGroups = [
    {
      id: "account",
      label: "Account",
      icon: "\u{1F464}",
      items: [
        { to: "/profile", label: "Profile", icon: "\u{1F464}" },
        { to: "/profile/update", label: "Edit Profile", icon: "\u{270E}" },
        { to: "/settings", label: "Settings", icon: "\u{2699}\u{FE0F}" },
        { to: "/billing", label: "Billing", icon: "\u{1F4B3}" },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      icon: "\u{1F6E1}\u{FE0F}",
      items: [
        { to: "/institutions", label: "Institutions", icon: "\u{1F3DB}\u{FE0F}" },
        { to: "/facilities", label: "Facilities", icon: "\u{1F4CD}" },
        { to: "/facilities/map", label: "Facility Map", icon: "\u{1F5FA}\u{FE0F}" },
        { to: "/emergency-services", label: "Emergency Services", icon: "\u{1F691}" },
        { to: "/chat", label: "Call Center Board", icon: "\u{1F4DE}" },
        { to: "/incidents", label: "Incidents", icon: "\u{1F6A8}" },
        { to: "/incidents/manage", label: "Incident Manager", icon: "\u{1F5C2}\u{FE0F}" },
        { to: "/incidents/area-intelligence", label: "Area Intelligence", icon: "\u{1F5FA}\u{FE0F}" },
        { to: "/incidents/vip-surveillance", label: "VIP Surveillance", icon: "\u{1F576}\u{FE0F}" },
      ],
    },
    {
      id: "core",
      label: "Core",
      icon: "\u{1F4CC}",
      items: [
        { to: "/demo-guide", label: "5-Min Demo", icon: "\u{23F1}\u{FE0F}" },
        { to: "/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
        { to: "/ai/insights", label: "AI Insights", icon: "\u{1F9E0}" },
        { to: "/api-platform", label: "API Platform", icon: "\u{1F517}" },
      ],
    },
    {
      id: "admin",
      label: "Admin",
      icon: "\u{1F6E0}\u{FE0F}",
      items: [
        { to: "/admin/users", label: "Admin Users", icon: "\u{1F6E0}\u{FE0F}" },
        { to: "/admin/security", label: "Security Control", icon: "\u{1F510}" },
        { to: "/admin/billing", label: "Billing Admin", icon: "\u{1F4BC}" },
        { to: "/admin/ai-console", label: "AI Console", icon: "\u{1F916}", requiresSuperuser: true },
      ],
      gated: true,
    },
  ];

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const [frontendSettings, setFrontendSettings] = useState(getFrontendSettings());
  const [currentUser, setCurrentUser] = useState(null);
  const [impersonationInfo, setImpersonationInfo] = useState(getImpersonationInfo());
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
    setImpersonationInfo(getImpersonationInfo());
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${ACCOUNTS_API_BASE}/profile/`, {
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

  const stopImpersonation = () => {
    const adminAccess = localStorage.getItem("impersonator_access_token");
    const adminRefresh = localStorage.getItem("impersonator_refresh_token");

    if (adminAccess && adminRefresh) {
      localStorage.setItem("access_token", adminAccess);
      localStorage.setItem("refresh_token", adminRefresh);
    } else {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }

    localStorage.removeItem("impersonator_access_token");
    localStorage.removeItem("impersonator_refresh_token");
    localStorage.removeItem("impersonator_user");
    localStorage.removeItem("impersonated_user");

    window.location.href = "/admin/users";
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("impersonator_access_token");
    localStorage.removeItem("impersonator_refresh_token");
    localStorage.removeItem("impersonator_user");
    localStorage.removeItem("impersonated_user");
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

  const sidebarExpanded = sidebarOpen || sidebarHovered;

  const sidebarWidth = sidebarExpanded
    ? frontendSettings.compactSidebar
      ? "220px"
      : "260px"
    : frontendSettings.compactSidebar
      ? "64px"
      : "72px";

  const transition = frontendSettings.reducedMotion ? "none" : "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  const dynamicContentStyle = useMemo(
    () => ({
      ...contentStyle,
      padding: frontendSettings.denseContent ? "14px" : "24px",
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
        onMouseEnter={() => {
          if (!sidebarOpen) {
            setSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (!sidebarOpen) {
            setSidebarHovered(false);
          }
        }}
      >
        <div style={logoContainerStyle}>
          <div style={logoWrapperStyle}>
            <span style={logoIconStyle}>🛡️</span>
            {sidebarExpanded && <span style={logoTextStyle}>Doria</span>}
          </div>
        </div>

        <nav style={navStyle}>
  {navGroups
    .filter((group) => !group.gated || Boolean(currentUser?.is_staff))
    .map((group) => (
      <div key={group.id} style={groupBlockStyle}>
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          style={groupHeaderStyle(sidebarExpanded)}
          aria-expanded={openGroups[group.id]}
        >
          <span style={linkIconStyle}>{group.icon}</span>
          {sidebarExpanded && (
            <>
              <span style={groupLabelStyle}>{group.label}</span>
              <span style={groupChevronStyle}>{openGroups[group.id] ? "\u{1F53C}" : "\u{1F53D}"}</span>
            </>
          )}
        </button> 
        {sidebarExpanded && openGroups[group.id] && (
          <div style={groupItemsStyle}>
            {group.items.filter((item) => !item.requiresSuperuser || Boolean(currentUser?.is_superuser)).map((item) => (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => getLinkStyle(isActive, sidebarExpanded)}>
                <span style={linkIconStyle}>{item.icon}</span>
                {sidebarExpanded && <span style={linkTextStyle}>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    ))}
</nav>

        {sidebarExpanded && (
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

          <div style={headerRightStyle}>
            {impersonationInfo && (
              <div style={impersonationBannerStyle}>
                <span style={impersonationTextStyle}>
                 Admin Logged in as: {impersonationInfo.impersonatedUser?.username || "user"}
                </span>
                <button onClick={stopImpersonation} style={impersonationButtonStyle}>
                  Return to Admin
                </button>
              </div>
            )}
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
              <span style={logoutIconStyle}>{"\u21AA"}</span>
              Logout
            </button>
          </div>
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
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif",
};

const sidebarStyle = {
  color: "white",
  paddingTop: "24px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "4px 0 20px rgba(15, 81, 50, 0.15)",
  position: "relative",
  zIndex: 10,
  overflow: "hidden",
  minHeight: 0,
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
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
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
  flexShrink: 0,
  background: "inherit",
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
  minWidth: 0,
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

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const impersonationBannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "12px",
  color: "#9a3412",
  fontSize: "13px",
  fontWeight: "600",
};

const impersonationTextStyle = {
  whiteSpace: "nowrap",
};

const impersonationButtonStyle = {
  backgroundColor: "#ea580c",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
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


const groupBlockStyle = {
  marginBottom: "10px",
};

const groupHeaderStyle = (sidebarOpen) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: sidebarOpen ? "10px 12px" : "10px 0",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "white",
  cursor: "pointer",
  justifyContent: sidebarOpen ? "space-between" : "center",
});

const groupLabelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  opacity: 0.85,
};

const groupChevronStyle = {
  fontSize: "14px",
  opacity: 0.8,
};

const groupItemsStyle = {
  display: "grid",
  gap: "4px",
  marginTop: "6px",
  overflow: "hidden",
};


export default BasePage;





















