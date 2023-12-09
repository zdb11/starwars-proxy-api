import { NextFunction, Request, Response } from "express";
import { redisClient } from "../redis/redis.js";
import { cacheMechanismLog } from "../utils/loggers.js";
import { asyncHandler } from "./asyncHandler.js";

export const checkCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const requestOriginalUrl = req.originalUrl;
    cacheMechanismLog.info(`Checking cache for key ${requestOriginalUrl}`);
    const cachedResource = await redisClient.get(requestOriginalUrl)
    cacheMechanismLog.debug(`Cached resource for key ${requestOriginalUrl}: ${cachedResource}`);
    if (cachedResource === null) {
        next();
    } else {
        res.status(200).send(JSON.parse(cachedResource));
    }
});
export const persistCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const requestOriginalUrl = req.originalUrl;
    const resource = req.resource;
    if (!resource) {
        cacheMechanismLog.info(`Resource from previous middleware is undefined, can't persist it in cache. Skipping caching.`);
        return
    }
    await setRedisKeyValue(requestOriginalUrl, resource);
});

export const setRedisKeyValue = async (key: string, value: object): Promise<void> => {
    cacheMechanismLog.info(`Persisting resource on Redis key: ${key}`);
    const stringifyValue = JSON.stringify(value);
    await redisClient.set(key, stringifyValue, {EX: Number(process.env.EXPIRE_CACHE_TIME) ?? 60})
    cacheMechanismLog.debug(`Cached resource for key ${key}: ${stringifyValue}`);
}