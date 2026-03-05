import { createContext, useContext, useState } from "react";
import { defaultConfig } from "../halftoneConfig";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [hoveredTeam, setHoveredTeam] = useState(null);
  const [config, setConfig] = useState(defaultConfig);

  const updateConfig = (key, value) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const applyScenario = (scenario) =>
    setConfig({ ...scenario });

  return (
    <AppContext.Provider value={{ hoveredTeam, setHoveredTeam, config, updateConfig, applyScenario }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
