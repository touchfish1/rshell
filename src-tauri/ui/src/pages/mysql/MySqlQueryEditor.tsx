import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { sql, MySQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";

interface Props {
  value: string;
  editorViewRef: MutableRefObject<EditorView | null>;
  hasSuggestions: boolean;
  onChange?: (value: string, cursor: number) => void;
  onCursorActivity?: (value: string, cursor: number) => void;
  onKeyDown?: (key: string) => void;
  onBlur?: () => void;
  className?: string;
}

export function MySqlQueryEditor({
  value,
  editorViewRef,
  hasSuggestions,
  onChange,
  onCursorActivity,
  onKeyDown,
  onBlur,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateListener = EditorView.updateListener.of((update) => {
      const newValue = update.state.doc.toString();
      const cursor = update.state.selection.main.head;
      if (update.docChanged) {
        onChange?.(newValue, cursor);
      } else if (update.selectionSet && newValue === valueRef.current) {
        onCursorActivity?.(newValue, cursor);
      }
    });

    const blurHandler = EditorView.domEventHandlers({
      blur: () => onBlur?.(),
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          sql({ dialect: MySQL }),
          oneDark,
          updateListener,
          blurHandler,
          keymap.of([
            {
              key: "ArrowUp",
              run: () => {
                if (hasSuggestions) {
                  onKeyDown?.("ArrowUp");
                  return true;
                }
                return false;
              },
            },
            {
              key: "ArrowDown",
              run: () => {
                if (hasSuggestions) {
                  onKeyDown?.("ArrowDown");
                  return true;
                }
                return false;
              },
            },
            {
              key: "Enter",
              run: () => {
                if (hasSuggestions) {
                  onKeyDown?.("Enter");
                  return true;
                }
                return false;
              },
            },
            {
              key: "Tab",
              run: () => {
                if (hasSuggestions) {
                  onKeyDown?.("Tab");
                  return true;
                }
                return false;
              },
            },
            {
              key: "Escape",
              run: () => {
                if (hasSuggestions) {
                  onKeyDown?.("Escape");
                  return true;
                }
                return false;
              },
            },
          ]),
        ],
      }),
      parent: container,
    });

    viewRef.current = view;
    editorViewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className={className} />;
}
