import type { I18nKey } from "../i18n";
import { useAppTheme, type ColorThemeMode } from "../theme-context";

interface Props {
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export function ColorThemeToggle({ tr }: Props) {
  const { mode, setMode } = useAppTheme();

  const segment = (value: ColorThemeMode, label: string) => (
    <button
      key={value}
      type="button"
      className={`color-theme-seg ${mode === value ? "color-theme-seg-active" : ""}`}
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
    >
      {label}
    </button>
  );

  return (
    <div className="color-theme-toggle" role="group" aria-label={tr("theme.colorModeAria")}>
      {segment("light", tr("theme.light"))}
      {segment("dark", tr("theme.dark"))}
      {segment("system", tr("theme.system"))}
    </div>
  );
}
