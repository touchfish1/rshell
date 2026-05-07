import { useState } from "react";
import { useAppTheme } from "../../theme-context";
import {
  getAllSettings, resetAllSettings, updateSetting,
  getAnsiColors, setAnsiColors, ANSI_COLOR_NAMES, ANSI_COLOR_DEFAULTS,
  type CursorStyle, type AnsiColorName,
  type BellStyle,
} from "../../lib/appSettings";
import {
  getTerminalFontPreset,
  setTerminalFontPreset,
  TERMINAL_FONT_PRESET_IDS,
  type TerminalFontPresetId,
} from "../../lib/terminalFontFamily";
import { persistTerminalFontSize, getTerminalFontSize, TERMINAL_FONT_MIN, TERMINAL_FONT_MAX } from "../../lib/terminalFontSize";

export function useSettingsState() {
  const { mode: themeMode, setMode: setThemeMode } = useAppTheme();

  const [fontPreset, setFontPresetState] = useState<TerminalFontPresetId>(() => getTerminalFontPreset());
  const [fontSize, setFontSizeState] = useState(() => getTerminalFontSize());
  const [fgColor, setFgColor] = useState(() => getAllSettings().terminalFgColor);
  const [bgColor, setBgColor] = useState(() => getAllSettings().terminalBgColor);
  const [cursorColor, setCursorColor] = useState(() => getAllSettings().terminalCursorColor);
  const [cursorStyle, setCursorStyleState] = useState<CursorStyle>(() => getAllSettings().terminalCursorStyle);
  const [cursorBlink, setCursorBlinkState] = useState(() => getAllSettings().terminalCursorBlink);
  const [scrollback, setScrollbackState] = useState(() => getAllSettings().terminalScrollback);
  const [cursorWidth, setCursorWidthState] = useState(() => getAllSettings().terminalCursorWidth);
  const [opacity, setOpacityState] = useState(() => getAllSettings().terminalOpacity);
  const [pingInterval, setPingIntervalState] = useState(() => getAllSettings().pingInterval);
  const [confirmClose, setConfirmCloseState] = useState(() => getAllSettings().confirmBeforeClose);
  const [autoCopy, setAutoCopyState] = useState(() => getAllSettings().autoCopySelection);
  const [lineHeight, setLineHeightState] = useState(() => getAllSettings().terminalLineHeight);
  const [letterSpacing, setLetterSpacingState] = useState(() => getAllSettings().terminalLetterSpacing);
  const [bellStyle, setBellStyleState] = useState<BellStyle>(() => getAllSettings().terminalBellStyle);
  const [confirmTabClose, setConfirmTabCloseState] = useState(() => getAllSettings().confirmTabClose);
  const [confirmPaste, setConfirmPasteState] = useState(() => getAllSettings().confirmPaste);
  const [ansiColors, setAnsiColorsState] = useState<Record<string, string>>(() => ({
    ...ANSI_COLOR_DEFAULTS,
    ...(getAnsiColors() ?? {}),
  }));
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(false);

  const handleFontPreset = (next: TerminalFontPresetId) => {
    if (!TERMINAL_FONT_PRESET_IDS.includes(next)) return;
    setFontPresetState(next);
    setTerminalFontPreset(next);
    updateSetting("terminalFontFamily", next);
  };

  const handleFontSize = (next: number) => {
    const clamped = Math.max(TERMINAL_FONT_MIN, Math.min(TERMINAL_FONT_MAX, Math.round(next)));
    setFontSizeState(clamped);
    persistTerminalFontSize(clamped);
    updateSetting("terminalFontSize", clamped);
  };

  const handleFgColor = (value: string) => {
    setFgColor(value);
    updateSetting("terminalFgColor", value);
  };

  const handleBgColor = (value: string) => {
    setBgColor(value);
    updateSetting("terminalBgColor", value);
  };

  const handleCursorColor = (value: string) => {
    setCursorColor(value);
    updateSetting("terminalCursorColor", value);
  };

  const handleCursorStyle = (value: CursorStyle) => {
    setCursorStyleState(value);
    updateSetting("terminalCursorStyle", value);
  };

  const handleCursorBlink = (value: boolean) => {
    setCursorBlinkState(value);
    updateSetting("terminalCursorBlink", value);
  };

  const handleScrollback = (value: number) => {
    const clamped = Math.max(100, Math.min(100000, Math.round(value)));
    setScrollbackState(clamped);
    updateSetting("terminalScrollback", clamped);
  };

  const handleCursorWidth = (value: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(value)));
    setCursorWidthState(clamped);
    updateSetting("terminalCursorWidth", clamped);
  };

  const handleOpacity = (value: number) => {
    const clamped = Math.max(30, Math.min(100, Math.round(value)));
    setOpacityState(clamped);
    updateSetting("terminalOpacity", clamped);
  };

  const handlePingInterval = (value: number) => {
    const clamped = Math.max(3, Math.min(300, Math.round(value)));
    setPingIntervalState(clamped);
    updateSetting("pingInterval", clamped);
  };

  const handleConfirmClose = (value: boolean) => {
    setConfirmCloseState(value);
    updateSetting("confirmBeforeClose", value);
  };

  const handleAutoCopy = (value: boolean) => {
    setAutoCopyState(value);
    updateSetting("autoCopySelection", value);
  };

  const handleLineHeight = (value: number) => {
    const clamped = Math.max(1.0, Math.min(2.0, Math.round(value * 10) / 10));
    setLineHeightState(clamped);
    updateSetting("terminalLineHeight", clamped);
  };

  const handleLetterSpacing = (value: number) => {
    const clamped = Math.max(0, Math.min(10, Math.round(value)));
    setLetterSpacingState(clamped);
    updateSetting("terminalLetterSpacing", clamped);
  };

  const handleBellStyle = (value: BellStyle) => {
    setBellStyleState(value);
    updateSetting("terminalBellStyle", value);
  };

  const handleConfirmTabClose = (value: boolean) => {
    setConfirmTabCloseState(value);
    updateSetting("confirmTabClose", value);
  };

  const handleConfirmPaste = (value: boolean) => {
    setConfirmPasteState(value);
    updateSetting("confirmPaste", value);
  };

  const handleAnsiColor = (name: AnsiColorName, hex: string) => {
    const next = { ...ansiColors, [name]: hex };
    setAnsiColorsState(next);
    setAnsiColors(next);
  };

  const handleReset = () => {
    resetAllSettings();
    const defaults = getAllSettings();
    setFontPresetState(defaults.terminalFontFamily as TerminalFontPresetId);
    setFontSizeState(defaults.terminalFontSize);
    setFgColor(defaults.terminalFgColor);
    setBgColor(defaults.terminalBgColor);
    setCursorColor(defaults.terminalCursorColor);
    setCursorStyleState(defaults.terminalCursorStyle);
    setCursorBlinkState(defaults.terminalCursorBlink);
    setScrollbackState(defaults.terminalScrollback);
    setCursorWidthState(defaults.terminalCursorWidth);
    setOpacityState(defaults.terminalOpacity);
    setPingIntervalState(defaults.pingInterval);
    setConfirmCloseState(defaults.confirmBeforeClose);
    setAutoCopyState(defaults.autoCopySelection);
    setLineHeightState(defaults.terminalLineHeight);
    setLetterSpacingState(defaults.terminalLetterSpacing);
    setBellStyleState(defaults.terminalBellStyle);
    setConfirmTabCloseState(defaults.confirmTabClose);
    setConfirmPasteState(defaults.confirmPaste);
    setAnsiColorsState({ ...ANSI_COLOR_DEFAULTS });
    setConfirmReset(false);
    setResetFeedback(true);
    window.setTimeout(() => setResetFeedback(false), 2000);
    setThemeMode("dark");
  };

  return {
    themeMode,
    setThemeMode,
    fontPreset,
    fontSize,
    fgColor,
    bgColor,
    cursorColor,
    cursorStyle,
    cursorBlink,
    scrollback,
    cursorWidth,
    opacity,
    pingInterval,
    confirmClose,
    autoCopy,
    lineHeight,
    letterSpacing,
    bellStyle,
    confirmTabClose,
    confirmPaste,
    ansiColors,
    confirmReset,
    resetFeedback,
    setConfirmReset,
    fontFamilyOptions: [
      { id: "ui" as TerminalFontPresetId, labelKey: "theme.fontUi" as const },
      { id: "mono" as TerminalFontPresetId, labelKey: "theme.fontMono" as const },
      { id: "classic" as TerminalFontPresetId, labelKey: "theme.fontClassic" as const },
    ],
    handleFontPreset,
    handleFontSize,
    handleFgColor,
    handleBgColor,
    handleCursorColor,
    handleCursorStyle,
    handleCursorBlink,
    handleScrollback,
    handleCursorWidth,
    handleOpacity,
    handlePingInterval,
    handleConfirmClose,
    handleAutoCopy,
    handleLineHeight,
    handleLetterSpacing,
    handleBellStyle,
    handleConfirmTabClose,
    handleConfirmPaste,
    handleAnsiColor,
    handleReset,
  };
}
