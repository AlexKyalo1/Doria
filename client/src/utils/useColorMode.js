import { useEffect, useMemo, useState } from "react";

import { getFrontendSettings } from "./frontendSettings";

export function useColorMode() {
  const [colorMode, setColorMode] = useState(getFrontendSettings().colorMode);

  useEffect(() => {
    const onSettingsChange = () => {
      setColorMode(getFrontendSettings().colorMode);
    };

    window.addEventListener("frontend-settings-changed", onSettingsChange);
    return () => {
      window.removeEventListener("frontend-settings-changed", onSettingsChange);
    };
  }, []);

  const isDark = colorMode === "dark";

  const theme = useMemo(
    () =>
      isDark
        ? {
            pageBg: "#0f172a",
            cardBg: "#111827",
            cardBorder: "#374151",
            text: "#e5e7eb",
            mutedText: "#9ca3af",
          }
        : {
            pageBg: "#f4fdf6",
            cardBg: "#ffffff",
            cardBorder: "#d0e6d2",
            text: "#0f5132",
            mutedText: "#6b7280",
          },
    [isDark]
  );

  return { colorMode, isDark, theme };
}
