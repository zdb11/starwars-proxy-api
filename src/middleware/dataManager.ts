import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "./asyncHandler.js";
import { fetchDataLog } from "../utils/loggers.js";
import axios from "axios";
import { AllResourcesResponse } from "../interfaces/ResourceResponses.js";
import { redisClient } from "../redis/redis.js";
import { setRedisKeyValue } from "./cacheMechanism.js";

export const fetchData = (allResourcesRequest: boolean) => asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const reqQuery = { ...req.query };
    fetchDataLog.debug(`Request query parameters ${JSON.stringify(reqQuery)}`);
    const requestOriginalUrl = req.originalUrl;
    const apiUrl = `${process.env.API_HOST}${requestOriginalUrl}`;
    fetchDataLog.info(`Fetching data from URL: ${apiUrl}`);
    const response = await axios.get(apiUrl);
    if (response.statusText != "OK") {
        return next({statusCode: 500, message:`Can't fetch data from ${apiUrl}`})
    }
    fetchDataLog.debug(`Fetched data from URL: ${apiUrl}, ${response.data}`);
    let data = response.data;

    if (Object.keys(reqQuery).length === 0 && allResourcesRequest) {
        data = await unpaginateResponse(response.data);
    } else {
        data = overrideURLSInObject(data)
    }
    req.resource = data
    res.status(200).send(data);
    next();
})

const unpaginateResponse = async (data: AllResourcesResponse): Promise<AllResourcesResponse> => {
    let results = [...data.results];
    let refData = data;
    while(refData.next) {
        fetchDataLog.info(`Fetching data from URL: ${refData.next}`);
        const response = await axios.get(refData.next);

        if (response.statusText != "OK") {
            throw Error(`Can't fetch data from ${refData.next}`);
        }
        fetchDataLog.debug(`Fetched data from URL: ${refData.next}, ${JSON.stringify(response.data)}`);

        const redisDataToCacheKey = refData.next.replace(`${process.env.API_HOST}`, "");
        const overridedDataToCache = overrideURLSInObject(response.data) as AllResourcesResponse;
        await setRedisKeyValue(redisDataToCacheKey, overridedDataToCache);
        
        results.push(...overridedDataToCache.results)
        refData = response.data
    }
    fetchDataLog.debug(`Final unpaginated responses: ${JSON.stringify(results)}`);

    return {"count": results.length, "results": results} as AllResourcesResponse;
} 

const overrideURLSInObject = (data: object): object => {
    const stringifyData = JSON.stringify(data);
    fetchDataLog.info("Overriding host on localhost.")
    const replacedString = stringifyData.replaceAll(`${process.env.API_HOST}`, `http://localhost:${process.env.SERVER_PORT}`);
    return JSON.parse(replacedString)
}
