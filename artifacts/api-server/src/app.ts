import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttpModule, { type HttpLogger, type Options } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

type RequestWithId = Request & { id?: unknown };
type PinoHttpFactory = <IM = IncomingMessage, SR = ServerResponse, CustomLevels extends string = never>(
  opts?: Options<IM, SR, CustomLevels>,
) => HttpLogger<IM, SR, CustomLevels>;

const pinoHttp = (
  typeof pinoHttpModule === "function"
    ? pinoHttpModule
    : (pinoHttpModule as unknown as { default?: PinoHttpFactory }).default
) as PinoHttpFactory;

export const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: RequestWithId) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Response) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

export type ApiRequest = Request;
export type ApiResponse = Response;
export type ApiNextFunction = NextFunction;
