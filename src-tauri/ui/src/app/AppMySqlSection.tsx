import MySqlPage from "../pages/MySqlPage";
import type { I18nKey } from "../i18n";
import type { MySqlConnection, MySqlConnectionInput } from "../services/types";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppMySqlSectionProps {
  connections: MySqlConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: MySqlConnectionInput, secret?: string) => Promise<MySqlConnection | null>;
  onUpdate: (id: string, input: MySqlConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: TranslateFn;
}

export function AppMySqlSection(props: AppMySqlSectionProps) {
  return <MySqlPage {...props} />;
}
