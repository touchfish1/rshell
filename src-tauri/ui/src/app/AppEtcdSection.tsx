import EtcdPage from "../pages/EtcdPage";
import type { EtcdConnection, EtcdConnectionInput } from "../services/types";
import type { I18nKey } from "../i18n";

type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface AppEtcdSectionProps {
  connections: EtcdConnection[];
  selectedId?: string;
  status: string;
  error: string | null;
  onDismissError: () => void;
  onSelect: (id: string) => void;
  onCreate: (input: EtcdConnectionInput, secret?: string) => Promise<EtcdConnection | null>;
  onUpdate: (id: string, input: EtcdConnectionInput, secret?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onGetSecret: (id: string) => Promise<string | null>;
  onBack: () => void;
  tr: TranslateFn;
}

export function AppEtcdSection({
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
}: AppEtcdSectionProps) {
  return (
    <EtcdPage
      connections={connections}
      selectedId={selectedId}
      status={status}
      error={error}
      onDismissError={onDismissError}
      onSelect={onSelect}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onGetSecret={onGetSecret}
      onBack={onBack}
      tr={tr}
    />
  );
}
