import type { I18nKey } from "../i18n";
import type { RedisConnection, RedisConnectionInput } from "../services/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { RedisBrowserPane } from "./redis/RedisBrowserPane";
import { RedisCommandLog } from "./redis/RedisCommandLog";
import { RedisConnectionModal } from "./redis/RedisConnectionModal";
import { RedisConnectionsPane } from "./redis/RedisConnectionsPane";
import { RedisDbSwitchModal } from "./redis/RedisDbSwitchModal";
import { RedisHeader } from "./redis/RedisHeader";
import { useRedisPageState } from "./redis/useRedisPageState";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface Props {
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
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

export default function RedisPage({
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
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const state = useRedisPageState({
    connections,
    selectedId,
    tr,
    onSelect,
    onCreate,
    onUpdate,
    onDelete,
    onGetSecret,
  });
  const {
    selected,
    connected,
    terminalLayoutRef,
    redisPageRef,
    browserBodyRef,
    connPanelWidth,
    commandPanelHeight,
    commandLogs,
    createOpen,
    setCreateOpen,
    createForm,
    setCreateForm,
    createSecret,
    setCreateSecret,
    createHost,
    setCreateHost,
    createPort,
    setCreatePort,
    createSecretVisible,
    setCreateSecretVisible,
    createSaving,
    createSaveResult,
    createTesting,
    createTestResult,
    editOpen,
    setEditOpen,
    editForm,
    setEditForm,
    editSecret,
    setEditSecret,
    editHost,
    setEditHost,
    editPort,
    setEditPort,
    editSecretVisible,
    setEditSecretVisible,
    editSaving,
    editSaveResult,
    editTesting,
    editTestResult,
    dbSwitchOpen,
    dbSwitchConn,
    dbSwitchLoading,
    dbSwitchOptions,
    dbSwitchValue,
    dbSwitchSaving,
    dbSwitchResult,
    setDbSwitchOpen,
    setDbSwitchValue,
    scanLoading,
    scanCursor,
    keysLoaded,
    keys,
    keyTree,
    expandedGroups,
    selectedKeyData,
    ttlInput,
    saveResult,
    editorText,
    hashEntries,
    listItems,
    setMembers,
    setEditIndex,
    setDraft,
    zsetEntries,
    resizingDataPane,
    zkDataWidth,
    pattern,
    groupDelimiter,
    toggleGroup,
    setPattern,
    setGroupDelimiter,
    loadKeys,
    pickKey,
    saveValue,
    saveTtl,
    openDbSwitchModal,
    switchConnectionDb,
    testCreateConnection,
    testEditConnection,
    saveCreateConnection,
    saveEditConnection,
    disconnectActive,
    setTtlInput,
    setEditorText,
    setHashEntries,
    setListItems,
    setSetMembers,
    setSetEditIndex,
    setSetDraft,
    setZsetEntries,
    setResizingConnPanel,
    setResizingCommandPanel,
    setResizingDataPane,
  } = state;
  const pendingDeleteConn = useMemo(
    () => connections.find((item) => item.id === pendingDeleteId) ?? null,
    [connections, pendingDeleteId]
  );

  return (
    <section className="workspace redis-page" ref={redisPageRef}>
      <RedisHeader
        tr={tr}
        selected={selected}
        connected={connected}
        status={status}
        onBack={onBack}
        onOpenCreate={() => setCreateOpen(true)}
        onDisconnect={() => void disconnectActive()}
      />

      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <div
        className="terminal-layout"
        ref={terminalLayoutRef}
        style={{ gridTemplateColumns: `${connPanelWidth}px 8px minmax(0, 1fr)` }}
      >
        <RedisConnectionsPane
          tr={tr}
          connections={connections}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpenDbSwitch={openDbSwitchModal}
          onOpenEdit={(conn) => {
            onSelect(conn.id);
            setEditOpen(true);
          }}
          onDelete={(id) => setPendingDeleteId(id)}
        />
        <div
          className="terminal-splitter redis-layout-splitter"
          onMouseDown={() => setResizingConnPanel(true)}
          title="拖动调整连接列表宽度"
        />
        <RedisBrowserPane
          tr={tr}
          selected={Boolean(selected)}
          pattern={pattern}
          groupDelimiter={groupDelimiter}
          scanLoading={scanLoading}
          scanCursor={scanCursor}
          keysLoaded={keysLoaded}
          keys={keys}
          keyTree={keyTree}
          expandedGroups={expandedGroups}
          selectedKeyData={selectedKeyData}
          ttlInput={ttlInput}
          saveResult={saveResult}
          editorText={editorText}
          hashEntries={hashEntries}
          listItems={listItems}
          setMembers={setMembers}
          setEditIndex={setEditIndex}
          setDraft={setDraft}
          zsetEntries={zsetEntries}
          resizingDataPane={resizingDataPane}
          zkDataWidth={zkDataWidth}
          browserBodyRef={browserBodyRef}
          onPatternChange={setPattern}
          onGroupDelimiterChange={setGroupDelimiter}
          onLoadKeys={(reset) => void loadKeys(reset)}
          onToggleGroup={toggleGroup}
          onPickKey={(key) => void pickKey(key)}
          onResizeDataPaneStart={() => setResizingDataPane(true)}
          onSaveValue={() => void saveValue()}
          onTtlChange={setTtlInput}
          onSaveTtl={() => void saveTtl()}
          onChangeEditorText={setEditorText}
          onChangeHashEntries={setHashEntries}
          onChangeListItems={setListItems}
          onChangeSetMembers={setSetMembers}
          onChangeSetEditIndex={setSetEditIndex}
          onChangeSetDraft={setSetDraft}
          onChangeZsetEntries={setZsetEntries}
        />
      </div>
      <RedisCommandLog logs={commandLogs} height={commandPanelHeight} onResizeStart={() => setResizingCommandPanel(true)} />

      <RedisConnectionModal
        open={createOpen}
        confirmOnClose
        title={tr("redis.page.addConnection")}
        host={createHost}
        port={createPort}
        form={createForm}
        secret={createSecret}
        secretVisible={createSecretVisible}
        testing={createTesting}
        saving={createSaving}
        testResult={createTestResult}
        saveResult={createSaveResult}
        submitLabel={tr("modal.add")}
        tr={tr}
        onClose={() => setCreateOpen(false)}
        onChangeHost={setCreateHost}
        onChangePort={setCreatePort}
        onChangeForm={setCreateForm}
        onChangeSecret={setCreateSecret}
        onToggleSecretVisible={() => setCreateSecretVisible((v) => !v)}
        onTest={() => void testCreateConnection()}
        onSubmit={() => void saveCreateConnection()}
      />

      <RedisConnectionModal
        open={editOpen && Boolean(selected)}
        confirmOnClose
        title={tr("modal.editHost")}
        host={editHost}
        port={editPort}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        testing={editTesting}
        saving={editSaving}
        testResult={editTestResult}
        saveResult={editSaveResult}
        submitLabel={tr("modal.save")}
        tr={tr}
        onClose={() => setEditOpen(false)}
        onChangeHost={setEditHost}
        onChangePort={setEditPort}
        onChangeForm={setEditForm}
        onChangeSecret={setEditSecret}
        onToggleSecretVisible={() => setEditSecretVisible((v) => !v)}
        onTest={() => void testEditConnection()}
        onSubmit={() => void saveEditConnection()}
      />

      <RedisDbSwitchModal
        open={dbSwitchOpen}
        conn={dbSwitchConn}
        loading={dbSwitchLoading}
        options={dbSwitchOptions}
        value={dbSwitchValue}
        saving={dbSwitchSaving}
        result={dbSwitchResult}
        tr={tr}
        onClose={() => setDbSwitchOpen(false)}
        onChangeValue={setDbSwitchValue}
        onSubmit={() => void switchConnectionDb()}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteConn)}
        title={tr("session.delete")}
        message={pendingDeleteConn ? tr("redis.page.deleteConfirm", { name: pendingDeleteConn.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteConn) return;
          void onDelete(pendingDeleteConn.id);
          setPendingDeleteId(null);
        }}
      />
    </section>
  );
}
