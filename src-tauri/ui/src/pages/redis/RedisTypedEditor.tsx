import type { RedisHashEntry, RedisKeyData, RedisZsetEntry } from "../../services/types";
import type { I18nKey } from "../../i18n";

interface Props {
  selectedKeyData: RedisKeyData | null;
  editorText: string;
  hashEntries: RedisHashEntry[];
  listItems: string[];
  setMembers: string[];
  setEditIndex: number | null;
  setDraft: string;
  zsetEntries: RedisZsetEntry[];
  tr: (key: I18nKey, vars?: Record<string, string | number>) => string;
  onChangeEditorText: (value: string) => void;
  onChangeHashEntries: (updater: (prev: RedisHashEntry[]) => RedisHashEntry[]) => void;
  onChangeListItems: (updater: (prev: string[]) => string[]) => void;
  onChangeSetMembers: (updater: (prev: string[]) => string[]) => void;
  onChangeSetEditIndex: (value: number | null) => void;
  onChangeSetDraft: (value: string) => void;
  onChangeZsetEntries: (updater: (prev: RedisZsetEntry[]) => RedisZsetEntry[]) => void;
}

export function RedisTypedEditor({
  selectedKeyData,
  editorText,
  hashEntries,
  listItems,
  setMembers,
  setEditIndex,
  setDraft,
  zsetEntries,
  tr,
  onChangeEditorText,
  onChangeHashEntries,
  onChangeListItems,
  onChangeSetMembers,
  onChangeSetEditIndex,
  onChangeSetDraft,
  onChangeZsetEntries,
}: Props) {
  if (!selectedKeyData) return null;
  switch (selectedKeyData.payload.kind) {
    case "string":
      return (
        <textarea
          className="zk-data-textarea"
          value={editorText}
          onChange={(e) => onChangeEditorText(e.target.value)}
          placeholder={tr("redis.page.valuePlaceholder")}
        />
      );
    case "hash":
      return (
        <div className="redis-typed-editor">
          {hashEntries.map((entry, index) => (
            <div className="redis-typed-row" key={`hash-${index}`}>
              <input
                value={entry.field}
                placeholder="field"
                onChange={(e) =>
                  onChangeHashEntries((prev) => prev.map((item, i) => (i === index ? { ...item, field: e.target.value } : item)))
                }
              />
              <input
                value={entry.value}
                placeholder="value"
                onChange={(e) =>
                  onChangeHashEntries((prev) => prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item)))
                }
              />
              <button className="btn btn-ghost" onClick={() => onChangeHashEntries((prev) => prev.filter((_, i) => i !== index))}>
                删除
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => onChangeHashEntries((prev) => [...prev, { field: "", value: "" }])}>
            新增 field
          </button>
        </div>
      );
    case "list":
      return (
        <div className="redis-typed-editor">
          {listItems.map((item, index) => (
            <div className="redis-typed-row" key={`list-${index}`}>
              <input
                value={item}
                placeholder={`index ${index}`}
                onChange={(e) => onChangeListItems((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
              />
              <button className="btn btn-ghost" onClick={() => onChangeListItems((prev) => prev.filter((_, i) => i !== index))}>
                删除
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => onChangeListItems((prev) => [...prev, ""])}>
            新增 item
          </button>
        </div>
      );
    case "set":
      return (
        <div className="redis-typed-editor redis-typed-editor-set">
          <div className="redis-set-chip-list">
            {setMembers.map((item, index) => (
              <div key={`set-chip-${index}`} className={`redis-set-chip ${setEditIndex === index ? "active" : ""}`}>
                <button
                  className="redis-set-chip-main"
                  title={item}
                  onClick={() => {
                    onChangeSetEditIndex(index);
                    onChangeSetDraft(item);
                  }}
                >
                  {item}
                </button>
                <button
                  className="redis-set-chip-remove"
                  title="删除 member"
                  onClick={() =>
                    onChangeSetMembers((prev) => {
                      const next = prev.filter((_, i) => i !== index);
                      if (setEditIndex === index) {
                        onChangeSetEditIndex(null);
                        onChangeSetDraft("");
                      } else if (setEditIndex != null && setEditIndex > index) {
                        onChangeSetEditIndex(setEditIndex - 1);
                      }
                      return next;
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="redis-set-editor-bar">
            <input
              value={setDraft}
              placeholder={setEditIndex == null ? "输入 member 后新增" : "编辑当前 member"}
              onChange={(e) => onChangeSetDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const next = setDraft.trim();
                if (!next) return;
                onChangeSetMembers((prev) => {
                  if (setEditIndex == null) return Array.from(new Set([...prev, next]));
                  const updated = prev.map((item, i) => (i === setEditIndex ? next : item));
                  return Array.from(new Set(updated));
                });
                onChangeSetEditIndex(null);
                onChangeSetDraft("");
              }}
            />
            <button
              className="btn btn-primary redis-set-apply-btn"
              onClick={() => {
                const next = setDraft.trim();
                if (!next) return;
                onChangeSetMembers((prev) => {
                  if (setEditIndex == null) return Array.from(new Set([...prev, next]));
                  const updated = prev.map((item, i) => (i === setEditIndex ? next : item));
                  return Array.from(new Set(updated));
                });
                onChangeSetEditIndex(null);
                onChangeSetDraft("");
              }}
            >
              {setEditIndex == null ? "新增 member" : "应用修改"}
            </button>
            {setEditIndex != null ? (
              <button
                className="btn btn-ghost redis-set-cancel-btn"
                onClick={() => {
                  onChangeSetEditIndex(null);
                  onChangeSetDraft("");
                }}
              >
                取消
              </button>
            ) : null}
          </div>
        </div>
      );
    case "zset":
      return (
        <div className="redis-typed-editor">
          {zsetEntries.map((entry, index) => (
            <div className="redis-typed-row" key={`zset-${index}`}>
              <input
                type="number"
                value={entry.score}
                placeholder="score"
                onChange={(e) =>
                  onChangeZsetEntries((prev) => prev.map((item, i) => (i === index ? { ...item, score: Number(e.target.value) } : item)))
                }
              />
              <input
                value={entry.member}
                placeholder="member"
                onChange={(e) =>
                  onChangeZsetEntries((prev) => prev.map((item, i) => (i === index ? { ...item, member: e.target.value } : item)))
                }
              />
              <button className="btn btn-ghost" onClick={() => onChangeZsetEntries((prev) => prev.filter((_, i) => i !== index))}>
                删除
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => onChangeZsetEntries((prev) => [...prev, { score: 0, member: "" }])}>
            新增 member
          </button>
        </div>
      );
    default:
      return null;
  }
}
