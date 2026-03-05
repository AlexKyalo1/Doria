import React, { useEffect, useState } from "react";

import {
  applyColorMode,
  defaultFrontendSettings,
  getFrontendSettings,
  saveFrontendSettings,
} from "../utils/frontendSettings";
import { useColorMode } from "../utils/useColorMode";

const settingRows = [
  {
    key: "compactSidebar",
    title: "Compact sidebar",
    description: "Use smaller sidebar width",
    icon: "\ud83d\udccf",
  },
  {
    key: "reducedMotion",
    title: "Reduced motion",
    description: "Turn off UI animations",
    icon: "\ud83c\udfac",
  },
  {
    key: "denseContent",
    title: "Dense content",
    description: "Use tighter spacing",
    icon: "\ud83d\udce6",
  },
  {
    key: "showInstitutionIds",
    title: "Show institution IDs",
    description: "Display HashIDs in lists",
    icon: "\ud83c\udd94",
  },
];

const SettingsPage = () => {
  const [settings, setSettings] = useState(getFrontendSettings());
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const { isDark, theme } = useColorMode();

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert({ show: false, type: "", message: "" });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  const showAlert = (message, type = "success") => {
    setAlert({ show: true, type, message });
  };

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(newSettings);
    saveFrontendSettings(newSettings);
    showAlert(`${settingRows.find((r) => r.key === key).title} updated`, "success");
  };

  const handleModeChange = (mode) => {
    const newSettings = {
      ...settings,
      colorMode: mode,
    };
    setSettings(newSettings);
    saveFrontendSettings(newSettings);
    applyColorMode(mode);
    showAlert(`Color mode changed to ${mode}`, "success");
  };

  const handleReset = () => {
    setSettings({ ...defaultFrontendSettings });
    saveFrontendSettings(defaultFrontendSettings);
    applyColorMode(defaultFrontendSettings.colorMode);
    showAlert("Reset to defaults", "info");
  };

  const handleDismissAlert = () => {
    setAlert({ show: false, type: "", message: "" });
  };

  const getAlertStyles = () => {
    const baseStyles = { ...styles.alert };
    switch (alert.type) {
      case "success":
        return { ...baseStyles, ...styles.alertSuccess };
      case "info":
        return { ...baseStyles, ...styles.alertInfo };
      default:
        return { ...baseStyles, ...styles.alertInfo };
    }
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      {alert.show && (
        <div style={getAlertStyles()} role="alert">
          <div style={styles.alertContent}>
            <span style={styles.alertIcon}>{alert.type === "success" ? "\u2713" : "\u2139"}</span>
            <span style={styles.alertMessage}>{alert.message}</span>
            <button style={styles.alertClose} onClick={handleDismissAlert} aria-label="Close alert">
              {"\u00d7"}
            </button>
          </div>
          <div style={styles.alertProgress}></div>
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={{ ...styles.title, color: theme.text }}>Settings</h1>
        </div>
      </div>

      <div style={{ ...styles.modeCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.modeRow}>
          <span style={styles.modeIcon}>{isDark ? "\ud83c\udf19" : "\u2600\ufe0f"}</span>
          <span style={{ ...styles.modeLabel, color: theme.text }}>Color Mode</span>
          <div style={styles.modeButtons}>
            <button
              type="button"
              onClick={() => handleModeChange("light")}
              style={{
                ...styles.modeButton,
                ...(!isDark ? styles.modeButtonActive : {}),
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("dark")}
              style={{
                ...styles.modeButton,
                ...(isDark ? styles.modeButtonActive : {}),
              }}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {settingRows.map((row) => (
          <div key={row.key} style={{ ...styles.settingItem, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.settingContent}>
              <span style={styles.settingIcon}>{row.icon}</span>
              <div style={styles.settingInfo}>
                <div style={{ ...styles.settingTitle, color: theme.text }}>{row.title}</div>
                <div style={{ ...styles.settingDescription, color: theme.mutedText }}>{row.description}</div>
              </div>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings[row.key]}
                  onChange={() => handleToggle(row.key)}
                  style={styles.checkbox}
                />
                <span
                  style={{
                    ...styles.toggleSlider,
                    backgroundColor: settings[row.key] ? "#0f5132" : "#cbd5e1",
                  }}
                >
                  <span
                    style={{
                      ...styles.toggleKnob,
                      transform: settings[row.key] ? "translateX(18px)" : "translateX(0)",
                    }}
                  ></span>
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <button type="button" style={styles.resetButton} onClick={handleReset}>
          <span style={styles.buttonIcon}>{"\u21ba"}</span>
          Restore Defaults
        </button>
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    maxWidth: "800px",
    margin: "0 auto",
    position: "relative",
    minHeight: "100vh",
  },
  alert: {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 1000,
    minWidth: "240px",
    maxWidth: "320px",
    borderRadius: "8px",
    padding: "10px 12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  alertSuccess: {
    backgroundColor: "#e8f5e9",
    border: "1px solid #a5d6a7",
    color: "#1b5e20",
  },
  alertInfo: {
    backgroundColor: "#e3f2fd",
    border: "1px solid #bbdefb",
    color: "#0d47a1",
  },
  alertContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    position: "relative",
    zIndex: 1,
  },
  alertIcon: {
    fontSize: "16px",
    fontWeight: "600",
  },
  alertMessage: {
    flex: 1,
    fontSize: "13px",
    fontWeight: "500",
  },
  alertClose: {
    background: "none",
    border: "none",
    fontSize: "14px",
    cursor: "pointer",
    color: "inherit",
    opacity: 0.7,
    padding: "2px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  alertProgress: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: "2px",
    backgroundColor: "currentColor",
    opacity: 0.3,
    animation: "progress 2s linear forwards",
  },
  header: {
    marginBottom: "4px",
  },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
  },
  modeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 12px",
  },
  modeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  modeIcon: {
    fontSize: "18px",
    width: "32px",
    height: "32px",
    backgroundColor: "#ffffff",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f5132",
    border: "1px solid #e2e8f0",
  },
  modeLabel: {
    fontSize: "14px",
    fontWeight: "500",
    flex: 1,
  },
  modeButtons: {
    display: "flex",
    gap: "6px",
  },
  modeButton: {
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    backgroundColor: "#ffffff",
    color: "#64748b",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minWidth: "60px",
  },
  modeButtonActive: {
    backgroundColor: "#0f5132",
    borderColor: "#0f5132",
    color: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "8px",
  },
  settingItem: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px",
  },
  settingContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  settingIcon: {
    fontSize: "18px",
    width: "32px",
    height: "32px",
    backgroundColor: "#f8fafc",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f5132",
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "2px",
  },
  settingDescription: {
    fontSize: "11px",
    lineHeight: "1.4",
  },
  toggle: {
    position: "relative",
    display: "inline-block",
    width: "36px",
    height: "20px",
    cursor: "pointer",
  },
  checkbox: {
    opacity: 0,
    width: 0,
    height: 0,
    position: "absolute",
  },
  toggleSlider: {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: "20px",
    transition: "background-color 0.2s ease",
    display: "flex",
    alignItems: "center",
  },
  toggleKnob: {
    position: "absolute",
    height: "16px",
    width: "16px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "transform 0.2s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    left: "2px",
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    marginTop: "8px",
  },
  resetButton: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    color: "#64748b",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  buttonIcon: {
    fontSize: "14px",
  },
};

export default SettingsPage;
