import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./asyncHandler.js";
import { fetchDataLog } from "../utils/loggers.js";
import axios, { AxiosResponse } from "axios";
import { AllResourcesResponse, Film, MiddlewareResource, Resource } from "../interfaces/Resources.js";
import { getRedisKeyValue, setRedisKeyValue } from "./cacheMechanism.js";

export const fetchData = (allResourcesRequest: boolean) =>
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const reqQuery: object = { ...req.query };
        fetchDataLog.debug(`Request query parameters ${JSON.stringify(reqQuery)}`);

        const requestOriginalUrl: string = req.originalUrl;
        const apiUrl: string = `${process.env.API_HOST}${requestOriginalUrl}`;
        let data: Resource | AllResourcesResponse;

        if (Object.keys(reqQuery).length === 0 && allResourcesRequest) {
            data = await unpaginateResponse(apiUrl);
        } else {
            fetchDataLog.info(`Fetching data from URL: ${apiUrl}`);
            const response: AxiosResponse = await axios.get(apiUrl);
            if (response.statusText != "OK") {
                return next({ statusCode: 500, message: `Can't fetch data from ${apiUrl}` });
            }
            fetchDataLog.debug(`Fetched data from URL: ${apiUrl}, ${response.data}`);
            data = overrideURLSInObject(response.data);
        }
        res.status(200).send(data);

        // Setting resource for next middleware
        req.resources = [{ key: requestOriginalUrl, resource: data }] as MiddlewareResource[];
        next();
    });

const unpaginateResponse = async (requestOriginalUrl: string): Promise<AllResourcesResponse> => {
    // Setting as page #1 to start process from begginig for all resources queries
    const firstPageURL: string = `${requestOriginalUrl}/?page=1`;
    let next: string | null = firstPageURL;
    let results: Resource[] = [];
    while (next) {
        // Checking if resource from 'next' url isn't already in cache
        const redisResourceCacheKey: string = next.replace(`${process.env.API_HOST}`, "");
        const cachedData: string | null = await getRedisKeyValue(redisResourceCacheKey);
        if (cachedData) {
            fetchDataLog.info(
                `Data already in cache for key: ${redisResourceCacheKey}, appending to all resource results.`,
            );
            const parsedCachedData: AllResourcesResponse = JSON.parse(cachedData);
            results.push(...parsedCachedData.results);

            // Checking if next page exist in cached results, then changing to API_HOST URL to fetch next page data
            next = parsedCachedData.next
                ? parsedCachedData.next.replace(
                      `http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`,
                      `${process.env.API_HOST}`,
                  )
                : null;
            continue;
        }

        fetchDataLog.info(`Fetching data from next page URL: ${next}`);
        const response: AxiosResponse = await axios.get(next);
        if (response.statusText != "OK") {
            throw Error(`Can't fetch data from ${next}`);
        }
        fetchDataLog.debug(`Fetched data from URL: ${next}, ${JSON.stringify(response.data)}`);

        const overridedDataToCache = overrideURLSInObject(response.data) as AllResourcesResponse;
        // Here we know that there isn't cached resources for this key
        // we can execute with override on true to avoid double cache check
        await setRedisKeyValue(redisResourceCacheKey, overridedDataToCache, true);

        // Appending fetched data to all resource results
        results.push(...overridedDataToCache.results);
        next = response.data.next;
    }
    fetchDataLog.debug(`Final unpaginated responses: ${JSON.stringify(results)}`);

    return { count: results.length, results: results } as AllResourcesResponse;
};

export const gatherRequiredResources = (urls: string[]) =>
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        let resourcesResults: MiddlewareResource[] = [];
        const asyncTasks: Promise<void>[] = urls.map(async (url) => {
            fetchDataLog.info(`Gathering data for resource from: ${url}`);
            const result: AllResourcesResponse = await unpaginateResponse(url);
            const redisResourceCacheKey: string = url.replace(`${process.env.API_HOST}`, "");
            resourcesResults.push({ key: redisResourceCacheKey, resource: result });
        });
        await Promise.all(asyncTasks);
        fetchDataLog.info(`Resources gathered for URLS: ${urls.toString()}`);
        fetchDataLog.debug(
            `Required resources results for URLS: ${urls.toString()}: ${JSON.stringify(resourcesResults)}`,
        );
        req.resources = resourcesResults as MiddlewareResource[];
        next();
    });

export const queryCommonWords = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const allFilmsResource: string | null = await getRedisKeyValue(`/api/films`);
    if (allFilmsResource === null) {
        return next({ statusCode: 500, message: "Can't find films resources in Redis." });
    }
    const parsedFilmResult = JSON.parse(allFilmsResource).results as Film[];

    // Need to think about this structure, will be changed in future
    const wordsMap: Map<string, number> = new Map();
    parsedFilmResult.forEach((film: Film) => {
        const words = film.opening_crawl.split(/[^a-zA-Z0-9']/g).filter((word) => word.trim().length > 0);
        words.forEach((word) => {
            const count = wordsMap.get(word) || 0;
            wordsMap.set(word, count + 1);
        });
    });

    const uniqueWords: [string, number][] = Array.from(wordsMap.entries());
    fetchDataLog.info(`UniqueWords: ${uniqueWords}`);
    res.status(200).send(uniqueWords);
});

const overrideURLSInObject = (data: object): object => {
    const stringifyData: string = JSON.stringify(data);
    const pattern: string = `${process.env.API_HOST}`;
    const target: string = `http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`;
    fetchDataLog.info(`Replacing ${pattern} to ${target}.`);
    const replacedString: string = stringifyData.replaceAll(pattern, target);
    return JSON.parse(replacedString);
};
