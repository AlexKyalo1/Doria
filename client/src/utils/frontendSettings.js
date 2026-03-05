export const FRONTEND_SETTINGS_KEY = "frontend_settings";

export const defaultFrontendSettings = {
  compactSidebar: false,
  reducedMotion: false,
  denseContent: false,
  showInstitutionIds: true,
  colorMode: "light",
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
  };

  localStorage.setItem(FRONTEND_SETTINGS_KEY, JSON.stringify(payload));
  applyColorMode(payload.colorMode);
  window.dispatchEvent(new Event("frontend-settings-changed"));
}
