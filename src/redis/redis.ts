import * as redis from "redis";
import { redisLog } from "../utils/loggers";
import dotenv from "dotenv";

// Loading .env file before initialization of redis client
dotenv.config();

export const redisClient: redis.RedisClientType = redis.createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redisClient.on("connect", () => {
    redisLog.info(`Connected to Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});

redisClient.on("error", (err) => {
    redisLog.info(`Error in Redis connection: ${err}`);
});
