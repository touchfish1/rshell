import type { RefObject } from "react";
import type { EtcdConnection, MySqlConnection, MySqlConnectionInput, RedisConnection, RedisConnectionInput, Session, SessionInput, ZookeeperConnection, ZookeeperConnectionInput } from "../../services/types";
import type { TrFn } from "../../i18n-context";
import { ConfirmDialog } from "../ConfirmDialog";
import { HostCreateModal } from "./HostCreateModal";
import { HostEditModal } from "./HostEditModal";
import { RedisConnectionEditModal } from "../redis/RedisConnectionEditModal";
import { ZkConnectionEditModal } from "../zookeeper/ZkConnectionEditModal";
import { MySqlConnectionEditModal } from "../mysql/MySqlConnectionEditModal";

interface Props {
  tr: TrFn;
  pendingDelete: Session | null;
  pendingDeleteRedis: RedisConnection | null;
  pendingDeleteMySql: MySqlConnection | null;
  pendingDeleteZk: ZookeeperConnection | null;
  pendingDeleteEtcd: EtcdConnection | null;
  onCancelDeleteSession: () => void;
  onCancelDeleteRedis: () => void;
  onCancelDeleteMySql: () => void;
  onCancelDeleteZk: () => void;
  onCancelDeleteEtcd: () => void;
  onConfirmDeleteSession: () => void;
  onConfirmDeleteRedis: () => void;
  onConfirmDeleteMySql: () => void;
  onConfirmDeleteZk: () => void;

  showCreateModal: boolean;
  createForm: SessionInput;
  createSecret: string;
  createTesting: boolean;
  createSubmitting: boolean;
  createTestResult: string | null;
  hostInputRef: RefObject<HTMLInputElement>;
  createProtocolPort: number;
  onCloseCreate: () => void;
  onChangeCreateForm: (v: SessionInput) => void;
  onChangeCreateSecret: (v: string) => void;
  onTestCreate: () => void;
  onSubmitCreate: (connect?: boolean) => void;

  editSession: Session | null;
  editForm: SessionInput;
  editSecret: string;
  editSecretVisible: boolean;
  editSecretLoading: boolean;
  editTesting: boolean;
  editTestResult: string | null;
  editProtocolPort: number;
  onCloseEdit: () => void;
  onChangeEditForm: (v: SessionInput) => void;
  onChangeEditSecret: (v: string) => void;
  onToggleEditSecretVisible: () => void;
  onTestEdit: () => void;
  onSubmitEdit: () => void;
  onMarkEditSecretDirty: () => void;

  zkEditConnection: ZookeeperConnection | null;
  zkEditForm: ZookeeperConnectionInput;
  zkEditSecret: string;
  zkEditSecretVisible: boolean;
  zkEditSecretLoading: boolean;
  zkEditTesting: boolean;
  zkEditSaving: boolean;
  zkEditTestResult: string | null;
  onCloseEditZk: () => void;
  onChangeZkEditForm: (v: ZookeeperConnectionInput) => void;
  onChangeZkEditSecret: (v: string) => void;
  onToggleZkEditSecretVisible: () => void;
  onTestEditZk: () => void;
  onSubmitEditZk: () => void;

  redisEditConnection: RedisConnection | null;
  redisEditForm: RedisConnectionInput;
  redisEditSecret: string;
  redisEditSecretVisible: boolean;
  redisEditSecretLoading: boolean;
  redisEditTesting: boolean;
  redisEditSaving: boolean;
  redisEditResult: string | null;
  onCloseEditRedis: () => void;
  onChangeRedisEditForm: (v: RedisConnectionInput) => void;
  onChangeRedisEditSecret: (v: string) => void;
  onToggleRedisEditSecretVisible: () => void;
  onTestEditRedis: () => void;
  onSubmitEditRedis: () => void;

  mysqlEditConnection: MySqlConnection | null;
  mysqlEditForm: MySqlConnectionInput;
  mysqlEditSecret: string;
  mysqlEditSecretVisible: boolean;
  mysqlEditSecretLoading: boolean;
  mysqlEditTesting: boolean;
  mysqlEditSaving: boolean;
  mysqlEditResult: string | null;
  onCloseEditMySql: () => void;
  onChangeMySqlEditForm: (v: MySqlConnectionInput) => void;
  onChangeMySqlEditSecret: (v: string) => void;
  onToggleMySqlEditSecretVisible: () => void;
  onTestEditMySql: () => void;
  onSubmitEditMySql: () => void;
}

export function SessionListModals(props: Props) {
  const {
    tr,
    pendingDelete,
    pendingDeleteRedis,
    pendingDeleteMySql,
    pendingDeleteZk,
    pendingDeleteEtcd,
    onCancelDeleteSession,
    onCancelDeleteRedis,
    onCancelDeleteMySql,
    onCancelDeleteZk,
    onCancelDeleteEtcd,
    onConfirmDeleteSession,
    onConfirmDeleteRedis,
    onConfirmDeleteMySql,
    onConfirmDeleteZk,
    onConfirmDeleteEtcd,
    showCreateModal,
    createForm,
    createSecret,
    createTesting,
    createSubmitting,
    createTestResult,
    hostInputRef,
    createProtocolPort,
    onCloseCreate,
    onChangeCreateForm,
    onChangeCreateSecret,
    onTestCreate,
    onSubmitCreate,
    editSession,
    editForm,
    editSecret,
    editSecretVisible,
    editSecretLoading,
    editTesting,
    editTestResult,
    editProtocolPort,
    onCloseEdit,
    onChangeEditForm,
    onChangeEditSecret,
    onToggleEditSecretVisible,
    onTestEdit,
    onSubmitEdit,
    onMarkEditSecretDirty,
    zkEditConnection,
    zkEditForm,
    zkEditSecret,
    zkEditSecretVisible,
    zkEditSecretLoading,
    zkEditTesting,
    zkEditSaving,
    zkEditTestResult,
    onCloseEditZk,
    onChangeZkEditForm,
    onChangeZkEditSecret,
    onToggleZkEditSecretVisible,
    onTestEditZk,
    onSubmitEditZk,
    redisEditConnection,
    redisEditForm,
    redisEditSecret,
    redisEditSecretVisible,
    redisEditSecretLoading,
    redisEditTesting,
    redisEditSaving,
    redisEditResult,
    onCloseEditRedis,
    onChangeRedisEditForm,
    onChangeRedisEditSecret,
    onToggleRedisEditSecretVisible,
    onTestEditRedis,
    onSubmitEditRedis,
    mysqlEditConnection,
    mysqlEditForm,
    mysqlEditSecret,
    mysqlEditSecretVisible,
    mysqlEditSecretLoading,
    mysqlEditTesting,
    mysqlEditSaving,
    mysqlEditResult,
    onCloseEditMySql,
    onChangeMySqlEditForm,
    onChangeMySqlEditSecret,
    onToggleMySqlEditSecretVisible,
    onTestEditMySql,
    onSubmitEditMySql,
  } = props;

  return (
    <>
      <HostCreateModal
        open={showCreateModal}
        form={createForm}
        secret={createSecret}
        testing={createTesting}
        saving={createSubmitting}
        testResult={createTestResult}
        hostInputRef={hostInputRef}
        protocolPort={createProtocolPort}
        onClose={onCloseCreate}
        onChangeForm={onChangeCreateForm}
        onChangeSecret={onChangeCreateSecret}
        onTest={onTestCreate}
        onSubmit={() => onSubmitCreate()}
        onSubmitAndConnect={() => onSubmitCreate(true)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={tr("session.delete")}
        message={pendingDelete ? tr("session.deleteConfirm", { name: pendingDelete.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={onCancelDeleteSession}
        onConfirm={onConfirmDeleteSession}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteRedis)}
        title={tr("session.delete")}
        message={pendingDeleteRedis ? tr("redis.page.deleteConfirm", { name: pendingDeleteRedis.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={onCancelDeleteRedis}
        onConfirm={onConfirmDeleteRedis}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteMySql)}
        title={tr("session.delete")}
        message={pendingDeleteMySql ? tr("session.deleteConfirm", { name: pendingDeleteMySql.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={onCancelDeleteMySql}
        onConfirm={onConfirmDeleteMySql}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteZk)}
        title={tr("session.delete")}
        message={pendingDeleteZk ? tr("zk.page.deleteConfirm", { name: pendingDeleteZk.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={onCancelDeleteZk}
        onConfirm={onConfirmDeleteZk}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteEtcd)}
        title={tr("session.delete")}
        message={pendingDeleteEtcd ? tr("etcd.page.deleteConfirm", { key: pendingDeleteEtcd.name }) : ""}
        cancelLabel={tr("modal.cancel")}
        confirmLabel={tr("session.delete")}
        danger
        onCancel={onCancelDeleteEtcd}
        onConfirm={onConfirmDeleteEtcd}
      />

      <HostEditModal
        session={editSession}
        form={editForm}
        secret={editSecret}
        secretVisible={editSecretVisible}
        secretLoading={editSecretLoading}
        testResult={editTestResult}
        testing={editTesting}
        protocolPort={editProtocolPort}
        onClose={onCloseEdit}
        onChangeForm={onChangeEditForm}
        onChangeSecret={onChangeEditSecret}
        onChangeSecretVisible={onToggleEditSecretVisible}
        onTest={onTestEdit}
        onSubmit={onSubmitEdit}
        onMarkSecretDirty={onMarkEditSecretDirty}
      />
      <ZkConnectionEditModal
        connection={zkEditConnection}
        form={zkEditForm}
        secret={zkEditSecret}
        secretVisible={zkEditSecretVisible}
        secretLoading={zkEditSecretLoading}
        testing={zkEditTesting}
        saving={zkEditSaving}
        testResult={zkEditTestResult}
        onClose={onCloseEditZk}
        onChangeForm={onChangeZkEditForm}
        onChangeSecret={onChangeZkEditSecret}
        onToggleSecretVisible={onToggleZkEditSecretVisible}
        onTest={onTestEditZk}
        onSubmit={onSubmitEditZk}
      />
      <RedisConnectionEditModal
        connection={redisEditConnection}
        form={redisEditForm}
        secret={redisEditSecret}
        secretVisible={redisEditSecretVisible}
        secretLoading={redisEditSecretLoading}
        testing={redisEditTesting}
        saving={redisEditSaving}
        testResult={redisEditResult}
        onClose={onCloseEditRedis}
        onChangeForm={onChangeRedisEditForm}
        onChangeSecret={onChangeRedisEditSecret}
        onToggleSecretVisible={onToggleRedisEditSecretVisible}
        onTest={onTestEditRedis}
        onSubmit={onSubmitEditRedis}
      />
      <MySqlConnectionEditModal
        connection={mysqlEditConnection}
        form={mysqlEditForm}
        secret={mysqlEditSecret}
        secretVisible={mysqlEditSecretVisible}
        secretLoading={mysqlEditSecretLoading}
        testing={mysqlEditTesting}
        saving={mysqlEditSaving}
        testResult={mysqlEditResult}
        onClose={onCloseEditMySql}
        onChangeForm={onChangeMySqlEditForm}
        onChangeSecret={onChangeMySqlEditSecret}
        onToggleSecretVisible={onToggleMySqlEditSecretVisible}
        onTest={onTestEditMySql}
        onSubmit={onSubmitEditMySql}
      />
    </>
  );
}
