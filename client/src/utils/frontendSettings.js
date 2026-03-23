export const FRONTEND_SETTINGS_KEY = "frontend_settings";

export const defaultFacilityIcons = {
  police_station: "👮",
  police_post: "🚔",
  dci: "🕵️",
  administration: "🏛️",
};

export const defaultIncidentIcons = {
  robbery: "🚨",
  assault: "🆘",
  accident: "🚑",
  missing_person: "🔎",
  murder: "⚠️",
  theft: "🔐",
  other: "📍",
};

export const defaultFrontendSettings = {
  compactSidebar: false,
  reducedMotion: false,
  denseContent: false,
  showInstitutionIds: true,
  colorMode: "light",
  facilityIcons: defaultFacilityIcons,
  incidentIcons: defaultIncidentIcons,
};

export function getFrontendSettings() {
  try {
    const raw = localStorage.getItem(FRONTEND_SETTINGS_KEY);
    if (!raw) {
      return { ...defaultFrontendSettings };
    }

    const parsed = JSON.parse(raw);
    const merged = {
      ...defaultFrontendSettings,
      ...parsed,
    };

    merged.colorMode = merged.colorMode === "dark" ? "dark" : "light";
    merged.facilityIcons = {
      ...defaultFacilityIcons,
      ...(parsed?.facilityIcons || {}),
    };
    merged.incidentIcons = {
      ...defaultIncidentIcons,
      ...(parsed?.incidentIcons || {}),
    };
    return merged;
  } catch {
    return { ...defaultFrontendSettings };
  }
}

export function applyColorMode(mode) {
  const normalizedMode = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", normalizedMode);
  document.body.style.backgroundColor = normalizedMode === "dark" ? "#0b1220" : "#ffffff";
  document.body.style.color = normalizedMode === "dark" ? "#e5e7eb" : "#111827";
}

export function saveFrontendSettings(nextSettings) {
  const payload = {
    ...defaultFrontendSettings,
    ...nextSettings,
    colorMode: nextSettings?.colorMode === "dark" ? "dark" : "light",
    facilityIcons: {
      ...defaultFacilityIcons,
      ...(nextSettings?.facilityIcons || {}),
    },
    incidentIcons: {
      ...defaultIncidentIcons,
      ...(nextSettings?.incidentIcons || {}),
    },
  };

  localStorage.setItem(FRONTEND_SETTINGS_KEY, JSON.stringify(payload));
  applyColorMode(payload.colorMode);
  window.dispatchEvent(new Event("frontend-settings-changed"));
}

export function getFacilityTypeIcon(type) {
  const settings = getFrontendSettings();
  return settings.facilityIcons?.[type] || defaultFacilityIcons[type] || "📍";
}

export function getIncidentTypeIcon(type) {
  const settings = getFrontendSettings();
  return settings.incidentIcons?.[type] || defaultIncidentIcons[type] || "📍";
}
