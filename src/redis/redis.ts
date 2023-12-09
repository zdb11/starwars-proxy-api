import redis, { RedisClientType } from "redis";
import { redisLog } from "../utils/loggers.js";
import dotenv from 'dotenv';

dotenv.config();

export const redisClient: RedisClientType = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.on("connect", () => {
  redisLog.info(`Connected to Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});

redisClient.on("error", (err) => {
  redisLog.info(`Error in Redis connection: ${err}`);
});
