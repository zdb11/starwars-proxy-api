import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./asyncHandler.js";
import { fetchDataLog } from "../utils/loggers.js";
import axios, { AxiosResponse } from "axios";
import { AllResourcesResponse } from "../interfaces/ResourceResponses.js";
import { getRedisKeyValue, setRedisKeyValue } from "./cacheMechanism.js";

export const fetchData = (allResourcesRequest: boolean) => asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const reqQuery: object = { ...req.query };
    fetchDataLog.debug(`Request query parameters ${JSON.stringify(reqQuery)}`);

    const requestOriginalUrl: string = req.originalUrl;
    const apiUrl: string = `${process.env.API_HOST}${requestOriginalUrl}`;
    let data: object;

    if (Object.keys(reqQuery).length === 0 && allResourcesRequest) {
        data = await unpaginateResponse(apiUrl);
    } else {
        fetchDataLog.info(`Fetching data from URL: ${apiUrl}`);
        const response: AxiosResponse = await axios.get(apiUrl);
        if (response.statusText != "OK") {
            return next({statusCode: 500, message:`Can't fetch data from ${apiUrl}`})
        }
        fetchDataLog.debug(`Fetched data from URL: ${apiUrl}, ${response.data}`);
        data = overrideURLSInObject(response.data)
    }
    res.status(200).send(data);

    // Setting resource for next middleware
    req.resource = data
    next();
})

const unpaginateResponse = async (requestOriginalUrl: string): Promise<AllResourcesResponse> => {
    // Setting as page #1 to start process from begginig for all resources queries
    const firstPageURL: string = `${requestOriginalUrl}/?page=1`;
    let next: string | null = firstPageURL;
    let results: object[] = [];
    while(next) {
        // Checking if resource from 'next' url isn't already in cache
        const redisResourceCacheKey: string = next.replace(`${process.env.API_HOST}`, "");
        const cachedData: string | null = await getRedisKeyValue(redisResourceCacheKey);
        if (cachedData) {
            fetchDataLog.info(`Data already in cache for key: ${redisResourceCacheKey}, appending to all resource results.`);
            const parsedCachedData: AllResourcesResponse = JSON.parse(cachedData);
            results.push(...parsedCachedData.results);

            // Checking if next page exist in cached results, then changing to API_HOST URL to fetch next page data
            next = parsedCachedData.next ? parsedCachedData.next.replace(`http://localhost:${process.env.SERVER_PORT}`,`${process.env.API_HOST}`) : null;
            continue
        }

        fetchDataLog.info(`Fetching data from next page URL: ${next}`);
        const response: AxiosResponse = await axios.get(next);
        if (response.statusText != "OK") {
            throw Error(`Can't fetch data from ${next}`);
        }
        fetchDataLog.debug(`Fetched data from URL: ${next}, ${JSON.stringify(response.data)}`);

        const overridedDataToCache = overrideURLSInObject(response.data) as AllResourcesResponse;
        await setRedisKeyValue(redisResourceCacheKey, overridedDataToCache, false);
        
        // Appending fetched data to all resource results
        results.push(...overridedDataToCache.results)
        next = response.data.next
    }
    fetchDataLog.debug(`Final unpaginated responses: ${JSON.stringify(results)}`);

    return {"count": results.length, "results": results} as AllResourcesResponse;
} 

const overrideURLSInObject = (data: object): object => {
    const stringifyData: string = JSON.stringify(data);
    const pattern: string = `${process.env.API_HOST}`
    const target: string = `http://localhost:${process.env.SERVER_PORT}`;
    fetchDataLog.info(`Replacing ${pattern} to ${target}.`)
    const replacedString: string = stringifyData.replaceAll(pattern, target);
    return JSON.parse(replacedString)
}
