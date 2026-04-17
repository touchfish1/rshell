import type { Session } from "../../services/types";

export function resolveOs(session: Session) {
  const text = `${session.name} ${session.host}`.toLowerCase();
  if (text.includes("ubuntu")) return { label: "Ubuntu", code: "U", cls: "ubuntu" as const };
  if (text.includes("debian")) return { label: "Debian", code: "D", cls: "debian" as const };
  if (text.includes("centos")) return { label: "CentOS", code: "C", cls: "centos" as const };
  return { label: "Linux", code: "L", cls: "linux" as const };
}

