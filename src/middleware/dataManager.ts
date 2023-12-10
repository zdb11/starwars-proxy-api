import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./asyncHandler";
import { fetchDataLog } from "../utils/loggers";
import axios, { AxiosResponse } from "axios";
import { AllResourcesResponse, Film, MiddlewareResource, People, Resource } from "../interfaces/Resources";
import { getRedisKeyValue, setRedisKeyValue } from "./cacheMechanism";

export const fetchData = (allResourcesRequest: boolean) =>
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const reqQuery: object = { ...req.query };
        fetchDataLog.debug(`Request query parameters ${JSON.stringify(reqQuery)}`);

        // Modify targrt URL to hit API from .env
        const requestOriginalUrl: string = req.originalUrl;
        const apiUrl: string = `${process.env.API_HOST}${requestOriginalUrl}`;
        let data: Resource | AllResourcesResponse;

        // Checking if this request is for all resources and without any query params
        if (Object.keys(reqQuery).length === 0 && allResourcesRequest) {
            data = await unpaginateResponse(apiUrl);
        } else {
            fetchDataLog.info(`Fetching data from URL: ${apiUrl}`);
            try {
                const response: AxiosResponse = await axios.get(apiUrl);
                fetchDataLog.debug(`Fetched data from URL: ${apiUrl}, ${response.data}`);
                data = overrideURLSInObject(response.data);
            } catch (error: any) {
                return next({ statusCode: error.response.status, message: `Can't fetch data from ${apiUrl}` });
            }
        }
        res.status(200).send(data);

        // Setting resource for next middleware
        req.resources = [{ key: requestOriginalUrl, resource: data }] as MiddlewareResource[];
        next();
    });

export const unpaginateResponse = async (requestOriginalUrl: string): Promise<AllResourcesResponse> => {
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
            throw new Error(`Can't fetch data from ${next}`);
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
        // Creating async task for every resource url provided to middleware
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
    const allFilmsMiddleware: MiddlewareResource[] | undefined = req.resources;

    // Double check if there is resources from previous middleware
    if (allFilmsMiddleware === undefined || allFilmsMiddleware.length === 0) {
        return next({ statusCode: 500, message: "Can't find films resources from previous middleware." });
    }
    const allFilmsResource = allFilmsMiddleware[0].resource as AllResourcesResponse;
    const allFilmsResults = allFilmsResource.results as Film[];

    // Creating map of all words occurrences
    const wordsMap: Map<string, number> = new Map();
    allFilmsResults.forEach((film: Film) => {
        // Spliting opening by any characters beside words and numbers
        const words = film.opening_crawl.split(/[^a-zA-Z0-9']/g).filter((word) => word.trim().length > 0);
        // Iterating words to persist occurrences
        words.forEach((word) => {
            const count = wordsMap.get(word) || 0;
            wordsMap.set(word, count + 1);
        });
    });

    // Formating map to array
    const uniqueWords: [string, number][] = Array.from(wordsMap.entries());

    // Soring array by occurrences descending
    uniqueWords.sort((a, b) => b[1] - a[1]);

    fetchDataLog.debug(`UniqueWords: ${uniqueWords}`);
    res.status(200).send(uniqueWords);

    // Forward to persist resource in cache
    req.resources = [{ key: req.originalUrl, resource: uniqueWords }];
    next();
});

export const queryCommonHeros = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const commonHerosResults: MiddlewareResource[] | undefined = req.resources;

    // Double check if there is resources from previous middleware
    if (commonHerosResults === undefined || commonHerosResults.length < 2) {
        return next({
            statusCode: 500,
            message: "Can't find all resources for quering common heros from previous middleware.",
        });
    }
    // Because previous middleware is async pushing to resource array we need to check which element array is which resource
    const allFilmsResource = (
        commonHerosResults[0].key == "/api/films" ? commonHerosResults[0].resource : commonHerosResults[1].resource
    ) as AllResourcesResponse;
    const allPeopleResource = (
        commonHerosResults[0].key == "/api/people" ? commonHerosResults[0].resource : commonHerosResults[1].resource
    ) as AllResourcesResponse;
    const allFilmsResults = allFilmsResource.results as Film[];
    const allPeopleResults = allPeopleResource.results as People[];

    // Creating map of all names occurrences
    const nameCountMap: Map<number, string[]> = new Map();
    let maxCount: number = 0;
    allPeopleResults.forEach((people: People) => {
        let count = 0;
        allFilmsResults.forEach((film: Film) => {
            if (film.opening_crawl.includes(people.name)) {
                count++;
            }
        });
        // After iterating by all films we push name to map value array with key as a count of occurrences
        const nameMapArray: string[] = nameCountMap.get(count) || [];
        nameMapArray.push(people.name);
        nameCountMap.set(count, nameMapArray);

        // Checking if current count is bigger than maxCount to keep tracking max occurrences
        maxCount = count > maxCount ? count : maxCount;
        fetchDataLog.debug(`Name: ${people.name}, count: ${count}`);
    });

    // Formating map to array
    const mainHeros: string[] = nameCountMap.get(maxCount) ?? [];

    fetchDataLog.debug(`Main heros: ${mainHeros}`);
    res.status(200).send(mainHeros);

    // Forward to persist resource in cache
    req.resources = [{ key: req.originalUrl, resource: mainHeros }];
    next();
});

const overrideURLSInObject = (data: object): object => {
    const stringifyData: string = JSON.stringify(data);
    const pattern: string = `${process.env.API_HOST}`;
    const target: string = `http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`;
    fetchDataLog.info(`Replacing ${pattern} to ${target}.`);
    const replacedString: string = stringifyData.replaceAll(pattern, target);
    return JSON.parse(replacedString);
};
