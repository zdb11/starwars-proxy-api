import { NextFunction, Request, Response } from "express";
import { redisClient } from "../redis/redis.js";
import { cacheMechanismLog } from "../utils/loggers.js";
import { asyncHandler } from "./asyncHandler.js";
import { MiddlewareResource } from "../interfaces/Resources.js";

export const checkCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const requestOriginalUrl: string = req.originalUrl;
    const keyExist: number = await redisClient.exists(requestOriginalUrl);
    if (keyExist === 0) {
        next();
    } else {
        const cachedResource = (await getRedisKeyValue(requestOriginalUrl)) as string;
        res.status(200).send(JSON.parse(cachedResource));
    }
});
export const persistCache = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const resources: MiddlewareResource[] | undefined = req.resources;
    if (resources === undefined) {
        cacheMechanismLog.info(
            `Resource from previous middleware is undefined, can't persist it in cache. Skipping caching.`,
        );
        return;
    }
    const asyncTasks: Promise<void>[] = resources.map((resource) =>
        setRedisKeyValue(resource.key, resource.resource, false),
    );
    await Promise.all(asyncTasks);
});

export const setRedisKeyValue = async (key: string, value: object, override: boolean): Promise<void> => {
    cacheMechanismLog.info(`Persisting resource on Redis key: ${key} with override on ${override}`);
    if (!override) {
        const keyExist: number = await redisClient.exists(key);
        if (keyExist === 1) {
            cacheMechanismLog.info(`Found resource on Redis key ${key}, not overriding it.`);
            return;
        }
        cacheMechanismLog.info(`Not found resource on Redis key ${key}, contiune to persist.`);
    }
    const stringifyValue: string = JSON.stringify(value);
    await redisClient.set(key, stringifyValue, { EX: Number(process.env.EXPIRE_CACHE_TIME) ?? 60 });
    cacheMechanismLog.debug(`Cached resource for key ${key}: ${stringifyValue}`);
};

export const getRedisKeyValue = async (key: string): Promise<string | null> => {
    cacheMechanismLog.info(`Checking cache for key ${key}`);
    const cachedResource: string | null = await redisClient.get(key);
    cacheMechanismLog.info(`Cache ${cachedResource === null ? "not " : ""}found for key ${key}`);
    cacheMechanismLog.debug(`Cached resource for key ${key}: ${cachedResource}`);
    return cachedResource;
};
