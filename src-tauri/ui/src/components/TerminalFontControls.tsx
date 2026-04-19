import { useState } from "react";
import type { I18nKey } from "../i18n";
import {
  getTerminalFontPreset,
  setTerminalFontPreset,
  TERMINAL_FONT_PRESET_IDS,
  type TerminalFontPresetId,
} from "../lib/terminalFontFamily";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function TerminalFontControls({ tr }: Props) {
  const [fontPreset, setFontPreset] = useState<TerminalFontPresetId>(() => getTerminalFontPreset());

  return (
    <div className="theme-controls" role="group" aria-label={tr("theme.ariaGroup")}>
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
    </div>
  );
}
