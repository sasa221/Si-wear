import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

type RequestWithId = Request & { id?: unknown };

const pinoHttp = (
  typeof pinoHttpModule === "function"
    ? pinoHttpModule
    : (pinoHttpModule as any).default
);

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.use("/api", router);

export default app;

export type ApiRequest = Request;
export type ApiResponse = Response;
export type ApiNextFunction = NextFunction;
