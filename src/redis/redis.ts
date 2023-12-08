import redis, { RedisClientType } from "redis";
import { redisLog } from "../utils/loggers.js";

export const redisClient: RedisClientType = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT ?? "6379"),
  },
});

redisClient.on("connect", () => {
  redisLog.info("Connected to Redis");
});

redisClient.on("error", (err) => {
  redisLog.info("Error in Redis connection:", err);
});
