import type { Session, SessionInput } from "../services/types";

export function sessionInputFromSession(session: Session, nameOverride?: string): SessionInput {
  return {
    name: nameOverride ?? session.name,
    protocol: session.protocol,
    host: session.host,
    port: session.port,
    username: session.username,
    encoding: session.encoding,
    keepalive_secs: session.keepalive_secs,
  };
}
