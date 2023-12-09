import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { redisClient } from './redis/redis.js';
import { serverLog } from './utils/loggers.js';
import { peopleRouter } from './routes/people.js';
import { errorHandler } from './middleware/errorHandler.js';

// Loading .env file before initialization of express
dotenv.config();

const app: Express = express();

app.use(express.json());

if (process.env.ENVIRONMENT === "development") {
  app.use(morgan("dev"));
}

app.use("/api/people",peopleRouter);
app.use(errorHandler);

app.listen(process.env.SERVER_PORT, async () => {
  serverLog.info(`Connecting to Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`)
  await redisClient.connect();
  serverLog.info(`Server is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`);
});
