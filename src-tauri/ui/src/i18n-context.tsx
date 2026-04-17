import { createContext, useContext, type ReactNode } from "react";
import type { I18nKey, Lang } from "./i18n";

type TrFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: Lang;
  tr: TrFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  value,
  children,
}: {
  value: I18nContextValue;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return value;
}
