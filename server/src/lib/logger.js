import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
// vitest sets NODE_ENV=test — request logs would otherwise bury the actual
// pass/fail summary under a JSON dump of every supertest request.
const isTest = process.env.NODE_ENV === "test";

// JSON in production — Railway's log viewer parses structured logs fine, and
// that's the format any log tooling downstream would expect. Pretty-printed
// in dev so the terminal stays readable while iterating locally.
export const logger = pino({
  level: isTest ? "silent" : "info",
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});
