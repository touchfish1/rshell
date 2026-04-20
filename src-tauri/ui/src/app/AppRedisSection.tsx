import RedisPage from "../pages/RedisPage";
import type { RedisConnection, RedisConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppRedisSectionProps {
  connections: RedisConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: RedisConnectionInput, secret?: string) => Promise<RedisConnection | null>;
  onUpdate: (id: string, input: RedisConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: TranslateFn;
}

export function AppRedisSection(props: AppRedisSectionProps) {
  return <RedisPage {...props} />;
}
