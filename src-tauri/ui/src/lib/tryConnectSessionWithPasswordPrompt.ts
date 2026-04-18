import { connectSession, updateSession } from "../services/bridge";
import type { Session } from "../services/types";
import type { I18nKey } from "../i18n";
import { sessionInputFromSession } from "./sessionInput";

type Tr = (key: I18nKey, vars?: Record<string, string | number>) => string;

/**
 * 尝试连接会话；若后端提示缺少 SSH 密码则弹窗、写回密码后重试连接。
 * @returns 是否已成功连上（含补密码后的重试成功）
 */
export async function tryConnectSessionWithPasswordPrompt(opts: {
  sessionId: string;
  targetSession: Session | undefined;
  tr: Tr;
  /** 展示连接失败（含翻译后的整句文案） */
  fail: (message: string) => void;
  /** 用户取消输入密码时 */
  onPasswordPromptCancelled: () => void;
}): Promise<boolean> {
  const { sessionId, targetSession, tr, fail, onPasswordPromptCancelled } = opts;
  try {
    await connectSession(sessionId);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("missing SSH password")) {
      fail(tr("error.connectFailed", { message }));
      return false;
    }
    const input = window.prompt(tr("prompt.inputSshPassword"));
    if (!input) {
      onPasswordPromptCancelled();
      return false;
    }
    try {
      if (targetSession) {
        await updateSession(sessionId, sessionInputFromSession(targetSession), input);
      }
      await connectSession(sessionId, input);
      return true;
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      fail(tr("error.connectFailed", { message: retryMsg }));
      return false;
    }
  }
}
