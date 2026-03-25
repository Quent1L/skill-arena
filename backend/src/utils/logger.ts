import pino from "pino";

const logFormat = process.env.LOG_FORMAT?.toLowerCase() || "json";

function toLogfmt(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const k = key.replaceAll(/([A-Z])/g, "_$1").toLowerCase();
    let v: string;
    if (typeof value === "object" && value !== null) {
      v = JSON.stringify(value);
    } else if (typeof value === "string" && value.includes(" ")) {
      v = `"${value}"`;
    } else {
      v = String(value as string | number | boolean);
    }
    parts.push(`${k}=${v}`);
  }
  return parts.join(" ");
}

function buildDestination(): pino.DestinationStream | undefined {
  if (logFormat !== "logfmt") return undefined;
  return {
    write(msg: string) {
      const obj = JSON.parse(msg);
      const { level, time, pid, hostname, msg: message, ...rest } = obj;
      const levelLabel = pino.levels.labels[level] || level;
      const formatted = toLogfmt({ level: levelLabel, time: new Date(time).toISOString(), msg: message, ...rest });
      process.stdout.write(formatted + "\n");
    },
  };
}

export const logger = pino(
  { level: process.env.LOG_LEVEL?.toLowerCase() || "info" },
  buildDestination() ?? pino.destination(1),
);
