"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeColor = "orange" | "blue" | "green" | "purple";
export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeColor;
  mode: ThemeMode;
  setTheme: (theme: ThemeColor) => void;
  setMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = "app.theme";
const MODE_STORAGE_KEY = "app.mode";
const THEME_VALUES: ThemeColor[] = ["orange", "blue", "green", "purple"];
const MODE_VALUES: ThemeMode[] = ["light", "dark"];

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeColor(value: string | null): value is ThemeColor {
  return value != null && THEME_VALUES.includes(value as ThemeColor);
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value != null && MODE_VALUES.includes(value as ThemeMode);
}

function applyTheme(theme: ThemeColor, mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-mode", mode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>("orange");
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const nextTheme = isThemeColor(storedTheme) ? storedTheme : "orange";
    const nextMode = isThemeMode(storedMode) ? storedMode : "light";

    setThemeState(nextTheme);
    setModeState(nextMode);
    applyTheme(nextTheme, nextMode);
  }, []);

  const setTheme = (nextTheme: ThemeColor) => {
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    document.documentElement.setAttribute("data-mode", nextMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
