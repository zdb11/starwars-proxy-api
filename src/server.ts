import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { redisClient } from './redis/redis.js';
import { serverLog } from './utils/loggers.js';

dotenv.config();

const app: Express = express();

app.use(express.json());

if (process.env.ENVIRONMENT === "development") {
  app.use(morgan("dev"));
}

app.listen(process.env.SERVER_PORT, async () => {
  await redisClient.connect();
  serverLog.info(`Server is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`);
});
