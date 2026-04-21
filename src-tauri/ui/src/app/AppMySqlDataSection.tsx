import MySqlDataPage from "../pages/MySqlDataPage";
import type { I18nKey } from "../i18n";
import type { MySqlConnection } from "../services/types";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppMySqlDataSectionProps {
  connection?: MySqlConnection;
  schema: string;
  table: string;
  error: string | null;
  onDismissError: () => void;
  onBack: () => void;
  tr: TranslateFn;
}

export function AppMySqlDataSection(props: AppMySqlDataSectionProps) {
  return <MySqlDataPage {...props} />;
}
