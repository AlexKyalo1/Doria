import React, { useEffect, useMemo, useState } from "react";

import {
  applyColorMode,
  defaultFacilityIcons,
  defaultFrontendSettings,
  defaultIncidentIcons,
  getFrontendSettings,
  saveFrontendSettings,
} from "../utils/frontendSettings";
import { useColorMode } from "../utils/useColorMode";
import { apiFetch } from "../utils/apiFetch";

const API_BASE = "http://127.0.0.1:8000/api/accounts";

const settingRows = [
  {
    key: "compactSidebar",
    title: "Compact sidebar",
    description: "Use smaller sidebar width",
    icon: "📏",
  },
  {
    key: "reducedMotion",
    title: "Reduced motion",
    description: "Turn off UI animations",
    icon: "🎬",
  },
  {
    key: "denseContent",
    title: "Dense content",
    description: "Use tighter spacing",
    icon: "📦",
  },
  {
    key: "showInstitutionIds",
    title: "Show institution IDs",
    description: "Display HashIDs in lists",
    icon: "🆔",
  },
];

const facilityIconSuggestions = {
  police_station: ["👮", "🏢", "🛡️", "📍", "🚓"],
  police_post: ["🚔", "📍", "🛡️", "🚨", "🏚️"],
  dci: ["🕵️", "🧠", "📂", "🔍", "🏢"],
  administration: ["🏛️", "🧭", "📍", "🛡️", "🏘️"],
};

const incidentIconSuggestions = {
  robbery: ["🚨", "💥", "🔐", "🚔", "⚠️"],
  assault: ["🆘", "⚠️", "🚑", "🚨", "👥"],
  accident: ["🚑", "🚧", "⚠️", "🚨", "🛟"],
  missing_person: ["🔎", "👤", "🧭", "📣", "🚨"],
  murder: ["⚠️", "🚨", "🔴", "🧾", "🚔"],
  theft: ["🔐", "📦", "🚨", "👀", "🧾"],
  other: ["📍", "📝", "🚨", "⚙️", "📌"],
};

const typeLabels = {
  police_station: "Police Station",
  police_post: "Police Post",
  dci: "DCI Office",
  administration: "Administration",
  robbery: "Robbery",
  assault: "Assault",
  accident: "Accident",
  missing_person: "Missing Person",
  murder: "Murder",
  theft: "Theft",
  other: "Other",
};

const SettingsPage = () => {
  const token = localStorage.getItem("access_token");
  const [settings, setSettings] = useState(getFrontendSettings());
  const [profile, setProfile] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const { isDark, theme } = useColorMode();

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        return;
      }
      try {
        const res = await apiFetch(`${API_BASE}/profile/`, { headers });
        const data = await res.json();
        if (res.ok) {
          setProfile(data.user || null);
        }
      } catch {
        // Keep settings usable even if profile fetch fails.
      }
    };
    loadProfile();
  }, [headers, token]);

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert({ show: false, type: "", message: "" });
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  const isSuperAdmin = Boolean(profile?.is_superuser);

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
    showAlert(`${settingRows.find((r) => r.key === key)?.title || "Setting"} updated`, "success");
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

  const handleIconSelect = (groupKey, typeKey, icon) => {
    const nextSettings = {
      ...settings,
      [groupKey]: {
        ...(settings[groupKey] || {}),
        [typeKey]: icon,
      },
    };
    setSettings(nextSettings);
    saveFrontendSettings(nextSettings);
    showAlert(`Updated ${typeLabels[typeKey] || typeKey} icon`, "success");
  };

  const handleRestoreGroupDefaults = (groupKey) => {
    const nextSettings = {
      ...settings,
      [groupKey]: groupKey === "facilityIcons" ? defaultFacilityIcons : defaultIncidentIcons,
    };
    setSettings(nextSettings);
    saveFrontendSettings(nextSettings);
    showAlert("AI icon choices reset to defaults", "info");
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

  const renderIconGroup = (title, description, groupKey, suggestions) => {
    const currentIcons = settings[groupKey] || {};

    return (
      <div style={{ ...styles.iconCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.iconHeader}>
          <div>
            <h2 style={{ ...styles.cardTitle, color: theme.text }}>{title}</h2>
            <p style={{ ...styles.iconDescription, color: theme.mutedText }}>{description}</p>
          </div>
          <button type="button" style={styles.resetButtonSmall} onClick={() => handleRestoreGroupDefaults(groupKey)}>
            Restore defaults
          </button>
        </div>

        <div style={styles.iconGrid}>
          {Object.entries(suggestions).map(([typeKey, choices]) => (
            <div key={typeKey} style={styles.iconRow}>
              <div style={styles.iconRowHeader}>
                <span style={styles.iconTypeLabel}>{typeLabels[typeKey] || typeKey}</span>
                <span style={styles.iconCurrent}>{currentIcons[typeKey] || "📍"}</span>
              </div>
              <div style={styles.iconSuggestionCopy}>AI suggestions for this type</div>
              <div style={styles.iconChoices}>
                {choices.map((icon) => {
                  const active = currentIcons[typeKey] === icon;
                  return (
                    <button
                      key={`${typeKey}-${icon}`}
                      type="button"
                      style={{
                        ...styles.iconChoice,
                        ...(active ? styles.iconChoiceActive : {}),
                      }}
                      onClick={() => handleIconSelect(groupKey, typeKey, icon)}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      {alert.show && (
        <div style={getAlertStyles()} role="alert">
          <div style={styles.alertContent}>
            <span style={styles.alertIcon}>{alert.type === "success" ? "✓" : "ℹ"}</span>
            <span style={styles.alertMessage}>{alert.message}</span>
            <button style={styles.alertClose} onClick={handleDismissAlert} aria-label="Close alert">
              {"×"}
            </button>
          </div>
          <div style={styles.alertProgress}></div>
        </div>
      )}

      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={{ ...styles.title, color: theme.text }}>Settings</h1>
            <p style={{ ...styles.subtitle, color: theme.mutedText }}>
              Tune the interface and, for super admins, choose AI-suggested icons for facilities and incidents.
            </p>
          </div>
        </div>
      </div>

      <div style={{ ...styles.modeCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.modeRow}>
          <span style={styles.modeIcon}>{isDark ? "🌙" : "☀️"}</span>
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

      {isSuperAdmin ? (
        <>
          {renderIconGroup(
            "Facility Icons",
            "AI-suggested symbols that super admins can assign to facility types.",
            "facilityIcons",
            facilityIconSuggestions
          )}
          {renderIconGroup(
            "Incident Icons",
            "AI-suggested symbols that super admins can assign to incident categories.",
            "incidentIcons",
            incidentIconSuggestions
          )}
        </>
      ) : (
        <div style={{ ...styles.noticeCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.noticeTitle}>Super Admin Only</div>
          <div style={{ ...styles.noticeText, color: theme.mutedText }}>
            AI icon selection appears here for super admins so they can standardize how facilities and incidents appear on maps.
          </div>
        </div>
      )}

      <div style={styles.footer}>
        <button type="button" style={styles.resetButton} onClick={handleReset}>
          <span style={styles.buttonIcon}>↺</span>
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
    maxWidth: "980px",
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
    animation: "progress 2.2s linear forwards",
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
  subtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
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
  iconCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px",
  },
  iconHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
  },
  iconDescription: {
    margin: "6px 0 0",
    fontSize: "12px",
  },
  iconGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  iconRow: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px",
    backgroundColor: "#f8fafc",
  },
  iconRowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  iconTypeLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#0f172a",
  },
  iconCurrent: {
    fontSize: "22px",
  },
  iconSuggestionCopy: {
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "8px",
  },
  iconChoices: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  iconChoice: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    fontSize: "22px",
    cursor: "pointer",
  },
  iconChoiceActive: {
    borderColor: "#0f5132",
    boxShadow: "0 0 0 2px rgba(15, 81, 50, 0.15)",
  },
  noticeCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "14px",
  },
  noticeTitle: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "4px",
  },
  noticeText: {
    fontSize: "12px",
    lineHeight: 1.5,
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
  resetButtonSmall: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    color: "#475569",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  buttonIcon: {
    fontSize: "14px",
  },
};

export default SettingsPage;
