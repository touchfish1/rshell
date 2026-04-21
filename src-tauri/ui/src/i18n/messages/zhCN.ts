import type { I18nKey } from "../keys";
import { zhCN as source } from "../zhCN";
import { splitByPrefix } from "./splitByPrefix";

type Dict = Record<I18nKey, string>;

const langAndTop = splitByPrefix(source, ["lang.", "top.", "theme.", "updater.", "status.", "tray.", "app."]);
const homeAndSession = splitByPrefix(source, ["home.", "session.", "modal.", "form.", "shortcutHelp.", "zk.", "redis.", "mysql."]);
const terminalAndSftp = splitByPrefix(source, ["terminal.", "sftp."]);
const errorsAndToasts = splitByPrefix(source, ["error.", "toast.", "prompt."]);

export const zhCNMessages: Dict = {
  ...langAndTop,
  ...homeAndSession,
  ...terminalAndSftp,
  ...errorsAndToasts,
} as Dict;

