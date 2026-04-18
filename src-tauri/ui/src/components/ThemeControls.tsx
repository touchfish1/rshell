import { useEffect, useState } from "react";
import type { I18nKey } from "../i18n";
import { applyDocumentTheme, getThemeChoice, setThemeChoice, type ThemeChoice } from "../lib/appTheme";
import {
  getTerminalFontPreset,
  setTerminalFontPreset,
  TERMINAL_FONT_PRESET_IDS,
  type TerminalFontPresetId,
} from "../lib/terminalFontFamily";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  /** 是否在第二行展示终端等宽字体预设（终端页为 true） */
  showTerminalFont?: boolean;
}

export function ThemeControls({ tr, showTerminalFont }: Props) {
  const [theme, setTheme] = useState<ThemeChoice>(() => getThemeChoice());
  const [fontPreset, setFontPreset] = useState<TerminalFontPresetId>(() => getTerminalFontPreset());

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onSys = () => {
      if (getThemeChoice() === "system") {
        applyDocumentTheme("system");
        window.dispatchEvent(new CustomEvent("rshell-theme-changed"));
      }
    };
    mql.addEventListener("change", onSys);
    return () => mql.removeEventListener("change", onSys);
  }, []);

  return (
    <div className="theme-controls" role="group" aria-label={tr("theme.ariaGroup")}>
      <label className="theme-control">
        <span className="theme-control-label">{tr("theme.appearance")}</span>
        <select
          value={theme}
          onChange={(e) => {
            const next = e.target.value as ThemeChoice;
            setTheme(next);
            setThemeChoice(next);
          }}
        >
          <option value="dark">{tr("theme.dark")}</option>
          <option value="light">{tr("theme.light")}</option>
          <option value="system">{tr("theme.system")}</option>
        </select>
      </label>
      {showTerminalFont ? (
        <label className="theme-control">
          <span className="theme-control-label">{tr("theme.terminalFont")}</span>
          <select
            value={fontPreset}
            onChange={(e) => {
              const next = e.target.value as TerminalFontPresetId;
              if (!TERMINAL_FONT_PRESET_IDS.includes(next)) return;
              setFontPreset(next);
              setTerminalFontPreset(next);
            }}
          >
            <option value="ui">{tr("theme.fontUi")}</option>
            <option value="mono">{tr("theme.fontMono")}</option>
            <option value="classic">{tr("theme.fontClassic")}</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}
