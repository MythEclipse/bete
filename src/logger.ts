import fs from "node:fs";
import path from "node:path";
import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";
const logLevel = process.env.LOG_LEVEL || (isDev ? "debug" : "info");
const logsDir = path.resolve(process.cwd(), "logs");

fs.mkdirSync(logsDir, { recursive: true });

type LogMetadata = Record<string, unknown>;

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  statusCode?: unknown;
} & Record<string, unknown>;

const serializeError = (error: Error): SerializedError => {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    serialized.stack = error.stack;
  }

  const errorWithFields = error as Error & {
    code?: unknown;
    statusCode?: unknown;
    [key: string]: unknown;
  };

  if (errorWithFields.code !== undefined) {
    serialized.code = errorWithFields.code;
  }

  if (errorWithFields.statusCode !== undefined) {
    serialized.statusCode = errorWithFields.statusCode;
  }

  for (const [key, value] of Object.entries(errorWithFields)) {
    if (serialized[key] === undefined) {
      serialized[key] = value;
    }
  }

  return serialized;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const serializeLogValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeLogValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeLogValue(nestedValue),
      ]),
    );
  }

  return value;
};

const formatLogMetadata = (metadata: LogMetadata): LogMetadata => {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, serializeLogValue(value)]),
  );
};

const metadataFormat = winston.format((info) => {
  const { level: _level, message: _message, timestamp: _timestamp, ...metadata } =
    info;

  for (const key of Object.keys(metadata)) {
    delete info[key];
  }

  Object.assign(info, formatLogMetadata(metadata));
  return info;
});

const consoleFormat = winston.format.printf((info) => {
  const { level, message, timestamp, context, ...metadata } = info;
  const contextLabel = context ? ` [${String(context)}]` : "";
  const metadataText = Object.keys(metadata).length
    ? ` ${JSON.stringify(metadata)}`
    : "";

  return `${timestamp} ${level}${contextLabel}: ${message}${metadataText}`;
});

export interface CustomLogger {
  error: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  warn: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  info: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  debug: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  trace: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  fatal: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  silent: (msgOrObj: any, msgOrArgs?: any, ...args: any[]) => void;
  child(options: { context: string } & Record<string, any>): CustomLogger;
  [key: string]: any;
}

const winstonLogger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    metadataFormat(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        metadataFormat(),
        consoleFormat,
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "app.log"),
      format: winston.format.json(),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: winston.format.json(),
    }),
  ],
});

function wrapLogger(wLogger: winston.Logger): CustomLogger {
  const logAtLevel = (level: string) => {
    return (arg1: any, arg2?: any) => {
      if (arg1 instanceof Error) {
        wLogger.log(level, arg1.message, { error: arg1 });
      } else if (typeof arg1 === "object" && arg1 !== null) {
        const message = typeof arg2 === "string" ? arg2 : "";
        wLogger.log(level, message, { ...arg1 });
      } else {
        const message = typeof arg1 === "string" ? arg1 : String(arg1);
        const metadata = typeof arg2 === "object" && arg2 !== null ? arg2 : {};
        wLogger.log(level, message, metadata);
      }
    };
  };

  const wrapped: CustomLogger = {
    error: logAtLevel("error"),
    warn: logAtLevel("warn"),
    info: logAtLevel("info"),
    debug: logAtLevel("debug"),
    trace: logAtLevel("debug"), // Map trace to debug in Winston npm levels
    fatal: logAtLevel("error"), // Map fatal to error in Winston npm levels
    silent: () => {},
    child: (options: any) => {
      const childWinston = wLogger.child(options);
      return wrapLogger(childWinston);
    }
  };

  // Add all winston.Logger properties/methods to custom logger to make typescript happy for standard properties
  const proxy = new Proxy(wrapped, {
    get(target, prop) {
      if (prop in target) {
        return (target as any)[prop];
      }
      const val = (wLogger as any)[prop];
      if (typeof val === "function") {
        return val.bind(wLogger);
      }
      return val;
    }
  });

  return proxy;
}

export const logger: CustomLogger = wrapLogger(winstonLogger);

export const createChildLogger = (context: string): CustomLogger => {
  return logger.child({ context });
};

export const serializeLogValueForTest = serializeLogValue;
export const formatLogMetadataForTest = formatLogMetadata;
