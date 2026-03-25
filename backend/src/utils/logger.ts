import pino from "pino";

const logFormat = process.env.LOG_FORMAT?.toLowerCase() || "json";

function getTransport(): pino.TransportSingleOptions | undefined {
  switch (logFormat) {
    case "logfmt":
      return {
        target: "pino-logfmt",
        options: { flattenNestedObjects: true, snakeCaseKeys: true },
      };
    case "pretty":
      return { target: "pino-pretty", options: { colorize: false } };
    default:
      return undefined;
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL?.toLowerCase() || "info",
  transport: getTransport(),
});
