import { useEffect } from "react";
import type { I18nKey } from "../i18n";
import { useSettingsState } from "./settings/useSettingsState";
import { ANSI_COLOR_NAMES } from "../lib/appSettings";
import { TERMINAL_FONT_MIN, TERMINAL_FONT_MAX } from "../lib/terminalFontSize";
import type { Lang } from "../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  lang: Lang;
  onSwitchLang: (lang: Lang) => void;
}

export function SettingsModal({ open, onClose, tr, lang, onSwitchLang }: Props) {
  const s = useSettingsState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop settings-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{tr("settings.title")}</h4>
          <button type="button" className="modal-close" onClick={onClose} title={tr("modal.close")}>
            ×
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance */}
          <section className="settings-section">
            <h5 className="settings-section-title">{tr("settings.appearance")}</h5>

            <div className="settings-row">
              <span className="settings-label">{tr("theme.ariaGroup")}</span>
              <div className="color-theme-toggle settings-theme-toggle">
                {(["light", "dark", "system"] as const).map((val) => (
                  <button
                    key={val}
                    className={`color-theme-seg${s.themeMode === val ? " color-theme-seg-active" : ""}`}
                    onClick={() => s.setThemeMode(val)}
                  >
                    {tr(`theme.${val}` as I18nKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-label">{tr("top.ariaLanguageSwitch")}</span>
              <div className="lang-switch" role="group">
                <button
                  className={`btn btn-ghost ${lang === "zh-CN" ? "lang-active" : ""}`}
                  onClick={() => onSwitchLang("zh-CN")}
                  aria-pressed={lang === "zh-CN"}
                >
                  {tr("lang.zh")}
                </button>
                <button
                  className={`btn btn-ghost ${lang === "en-US" ? "lang-active" : ""}`}
                  onClick={() => onSwitchLang("en-US")}
                  aria-pressed={lang === "en-US"}
                >
                  {tr("lang.en")}
                </button>
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-label">{tr("settings.fontFamily")}</span>
              <select
                className="settings-select"
                value={s.fontPreset}
                onChange={(e) => s.handleFontPreset(e.target.value as any)}
              >
                {s.fontFamilyOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{tr(opt.labelKey)}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Terminal */}
          <section className="settings-section">
            <h5 className="settings-section-title">{tr("settings.terminal")}</h5>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.fontSizeHint")}>{tr("settings.fontSize")}</span>
              <div className="settings-font-size-control">
                <input
                  type="number"
                  className="settings-font-size-input"
                  min={TERMINAL_FONT_MIN}
                  max={TERMINAL_FONT_MAX}
                  value={s.fontSize}
                  onChange={(e) => s.handleFontSize(Number(e.target.value))}
                />
                <div className="settings-font-size-btns">
                  <button className="btn btn-ghost settings-size-btn" onClick={() => s.handleFontSize(s.fontSize - 1)} disabled={s.fontSize <= TERMINAL_FONT_MIN}>−</button>
                  <button className="btn btn-ghost settings-size-btn" onClick={() => s.handleFontSize(s.fontSize + 1)} disabled={s.fontSize >= TERMINAL_FONT_MAX}>+</button>
                </div>
              </div>
            </div>
            <span className="settings-hint">{tr("settings.fontSizeHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.terminalFgHint")}>{tr("settings.terminalFg")}</span>
              <label className="settings-color-input-wrap">
                <input type="color" value={s.fgColor} onChange={(e) => s.handleFgColor(e.target.value)} className="settings-color-input" />
                <code className="settings-color-value">{s.fgColor}</code>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.terminalFgHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.terminalBgHint")}>{tr("settings.terminalBg")}</span>
              <label className="settings-color-input-wrap">
                <input type="color" value={s.bgColor} onChange={(e) => s.handleBgColor(e.target.value)} className="settings-color-input" />
                <code className="settings-color-value">{s.bgColor}</code>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.terminalBgHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.terminalCursorHint")}>{tr("settings.terminalCursor")}</span>
              <label className="settings-color-input-wrap">
                <input type="color" value={s.cursorColor} onChange={(e) => s.handleCursorColor(e.target.value)} className="settings-color-input" />
                <code className="settings-color-value">{s.cursorColor}</code>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.terminalCursorHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.cursorStyleHint")}>{tr("settings.cursorStyle")}</span>
              <select
                className="settings-select"
                value={s.cursorStyle}
                onChange={(e) => s.handleCursorStyle(e.target.value as any)}
              >
                <option value="block">{tr("settings.cursorBlock")}</option>
                <option value="underline">{tr("settings.cursorUnderline")}</option>
                <option value="bar">{tr("settings.cursorBar")}</option>
              </select>
            </div>
            <span className="settings-hint">{tr("settings.cursorStyleHint")}</span>

            <div className="settings-row">
              <span className="settings-label">{tr("settings.cursorBlink")}</span>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={s.cursorBlink}
                  onChange={(e) => s.handleCursorBlink(e.target.checked)}
                />
                <span className="settings-toggle-track">
                  <span className={`settings-toggle-thumb${s.cursorBlink ? " on" : ""}`} />
                </span>
              </label>
            </div>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.scrollbackHint")}>{tr("settings.scrollback")}</span>
              <input
                type="number"
                className="settings-font-size-input"
                min={100}
                max={100000}
                value={s.scrollback}
                onChange={(e) => s.handleScrollback(Number(e.target.value))}
              />
            </div>
            <span className="settings-hint">{tr("settings.scrollbackHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.cursorWidthHint")}>{tr("settings.cursorWidth")}</span>
              <input
                type="number"
                className="settings-font-size-input"
                min={1}
                max={10}
                value={s.cursorWidth}
                onChange={(e) => s.handleCursorWidth(Number(e.target.value))}
              />
            </div>
            <span className="settings-hint">{tr("settings.cursorWidthHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.opacityHint")}>{tr("settings.opacity")}</span>
              <input
                type="range"
                className="settings-range-input"
                min={30}
                max={100}
                value={s.opacity}
                onChange={(e) => s.handleOpacity(Number(e.target.value))}
              />
              <code className="settings-range-value">{s.opacity}%</code>
            </div>
            <span className="settings-hint">{tr("settings.opacityHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.lineHeightHint")}>{tr("settings.lineHeight")}</span>
              <input
                type="number"
                className="settings-font-size-input"
                min={1.0}
                max={2.0}
                step={0.1}
                value={s.lineHeight}
                onChange={(e) => s.handleLineHeight(Number(e.target.value))}
              />
            </div>
            <span className="settings-hint">{tr("settings.lineHeightHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.letterSpacingHint")}>{tr("settings.letterSpacing")}</span>
              <input
                type="number"
                className="settings-font-size-input"
                min={0}
                max={10}
                value={s.letterSpacing}
                onChange={(e) => s.handleLetterSpacing(Number(e.target.value))}
              />
            </div>
            <span className="settings-hint">{tr("settings.letterSpacingHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.bellStyleHint")}>{tr("settings.bellStyle")}</span>
              <select
                className="settings-select"
                value={s.bellStyle}
                onChange={(e) => s.handleBellStyle(e.target.value as any)}
              >
                <option value="none">{tr("settings.bellNone")}</option>
                <option value="visual">{tr("settings.bellVisual")}</option>
                <option value="sound">{tr("settings.bellSound")}</option>
              </select>
            </div>
            <span className="settings-hint">{tr("settings.bellStyleHint")}</span>

            <div className="settings-preview" style={{ background: s.bgColor }}>
              <span style={{ color: s.fgColor }}>user@host:~$ </span>
              <span style={{ color: s.fgColor }}>ls</span>
              <span style={{ color: s.cursorColor }}>█</span>
            </div>
          </section>

          {/* Behavior */}
          <section className="settings-section">
            <h5 className="settings-section-title">{tr("settings.behavior")}</h5>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.confirmCloseHint")}>{tr("settings.confirmClose")}</span>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={s.confirmClose}
                  onChange={(e) => s.handleConfirmClose(e.target.checked)}
                />
                <span className="settings-toggle-track">
                  <span className={`settings-toggle-thumb${s.confirmClose ? " on" : ""}`} />
                </span>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.confirmCloseHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.pingIntervalHint")}>{tr("settings.pingInterval")}</span>
              <input
                type="number"
                className="settings-font-size-input"
                min={3}
                max={300}
                value={s.pingInterval}
                onChange={(e) => s.handlePingInterval(Number(e.target.value))}
              />
            </div>
            <span className="settings-hint">{tr("settings.pingIntervalHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.autoCopyHint")}>{tr("settings.autoCopy")}</span>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={s.autoCopy}
                  onChange={(e) => s.handleAutoCopy(e.target.checked)}
                />
                <span className="settings-toggle-track">
                  <span className={`settings-toggle-thumb${s.autoCopy ? " on" : ""}`} />
                </span>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.autoCopyHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.confirmTabCloseHint")}>{tr("settings.confirmTabClose")}</span>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={s.confirmTabClose}
                  onChange={(e) => s.handleConfirmTabClose(e.target.checked)}
                />
                <span className="settings-toggle-track">
                  <span className={`settings-toggle-thumb${s.confirmTabClose ? " on" : ""}`} />
                </span>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.confirmTabCloseHint")}</span>

            <div className="settings-row">
              <span className="settings-label" title={tr("settings.confirmPasteHint")}>{tr("settings.confirmPaste")}</span>
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  className="settings-toggle-input"
                  checked={s.confirmPaste}
                  onChange={(e) => s.handleConfirmPaste(e.target.checked)}
                />
                <span className="settings-toggle-track">
                  <span className={`settings-toggle-thumb${s.confirmPaste ? " on" : ""}`} />
                </span>
              </label>
            </div>
            <span className="settings-hint">{tr("settings.confirmPasteHint")}</span>
          </section>

          {/* ANSI Colors */}
          <section className="settings-section">
            <h5 className="settings-section-title">{tr("settings.ansiColors")}</h5>
            <div className="settings-ansi-grid">
              {ANSI_COLOR_NAMES.map((name) => (
                <label key={name} className="settings-ansi-item" title={tr(`settings.color.${name}` as I18nKey)}>
                  <span className="settings-ansi-label">{tr(`settings.color.${name}` as I18nKey)}</span>
                  <input
                    type="color"
                    className="settings-color-input"
                    value={s.ansiColors[name] ?? "#000000"}
                    onChange={(e) => s.handleAnsiColor(name, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Reset */}
          <section className="settings-section settings-section-danger">
            <h5 className="settings-section-title">{tr("settings.reset")}</h5>
            {s.resetFeedback ? (
              <span className="settings-reset-feedback">{tr("settings.resetDone")}</span>
            ) : s.confirmReset ? (
              <div className="settings-reset-confirm">
                <span>{tr("settings.resetConfirm")}</span>
                <div className="settings-reset-actions">
                  <button className="btn btn-ghost" onClick={() => s.setConfirmReset(false)}>{tr("modal.cancel")}</button>
                  <button className="btn settings-reset-btn" onClick={s.handleReset}>{tr("settings.reset")}</button>
                </div>
              </div>
            ) : (
              <button className="btn settings-reset-btn" onClick={() => s.setConfirmReset(true)}>
                {tr("settings.reset")}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
