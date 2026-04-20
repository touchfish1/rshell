import ZookeeperPage from "../pages/ZookeeperPage";
import type { ZookeeperConnection, ZookeeperConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";
import { testZookeeperConnection } from "../services/bridge";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppZookeeperSectionProps {
  connections: ZookeeperConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: ZookeeperConnectionInput, secret?: string) => Promise<ZookeeperConnection | null>;
  onUpdate: (id: string, input: ZookeeperConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: TranslateFn;
}

export function AppZookeeperSection({
  connections,
  selectedId,
  status,
  error,
  onDismissError,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onGetSecret,
  onBack,
  tr,
}: AppZookeeperSectionProps) {
  return (
    <ZookeeperPage
      connections={connections}
      selectedId={selectedId}
      status={status}
      error={error}
      onDismissError={onDismissError}
      onSelect={onSelect}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onTest={async (input: ZookeeperConnectionInput, secret?: string) => {
        await testZookeeperConnection(input.connect_string, input.session_timeout_ms, secret);
      }}
      onGetSecret={onGetSecret}
      onBack={onBack}
      tr={tr}
    />
  );
}
