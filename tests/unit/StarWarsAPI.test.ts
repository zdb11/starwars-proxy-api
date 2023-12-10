const mockedExValue = "60";
const mockedAPIHost = "targetAPI";
const mockedServerHost = "serverAPI";
const mockedServerPort = "3000";
process.env.EXPIRE_CACHE_TIME = mockedExValue;
process.env.API_HOST = mockedAPIHost;
process.env.SERVER_HOST = mockedServerHost;
process.env.SERVER_PORT = mockedServerPort;
process.env.LOGGER_LEVEL = "1";

import request from "supertest";
import { app } from "../../src/app";
import { redisClient } from "../../src/redis/redis";
import axios from "axios";

import * as cacheMechanism from "../../src/middleware/cacheMechanism";
import * as dataManager from "../../src/middleware/dataManager";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
jest.mock("redis", () => ({
    createClient: jest.fn(() => ({
        set: jest.fn(),
        get: jest.fn(),
        on: jest.fn(),
        connect: jest.fn(),
        exists: jest.fn(),
    })),
}));
jest.mock("axios");
describe("Star Wars API Tests", () => {
    let getRedisKeyValueSpy: jest.SpyInstance;
    let setRedisKeyValueSpy: jest.SpyInstance;
    let unpaginateResponseSpy: jest.SpyInstance;
    beforeEach(() => {
        unpaginateResponseSpy = jest.spyOn(dataManager, "unpaginateResponse");
        getRedisKeyValueSpy = jest.spyOn(cacheMechanism, "getRedisKeyValue");
        setRedisKeyValueSpy = jest.spyOn(cacheMechanism, "setRedisKeyValue");
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });
    describe("Get resources", () => {
        it("should get all resource from cache", async () => {
            const mockCachedResource = {
                count: 2,
                results: [{ name: "Mock1" }, { name: "Mock2" }],
            };
            redisClient.exists = jest.fn().mockReturnValue(1);
            getRedisKeyValueSpy.mockResolvedValue(JSON.stringify(mockCachedResource));

            const response = await request(app).get("/api/vehicles");

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCachedResource);
            expect(getRedisKeyValueSpy).toHaveBeenCalledWith("/api/vehicles");
            expect(getRedisKeyValueSpy).toHaveBeenCalledTimes(1);
            expect(redisClient.exists).toHaveBeenCalledTimes(1);
        });
        it("should fetch all resource as unpaginate response and persist in cache", async () => {
            const mockCachedResource = {
                count: 2,
                results: [{ name: "Mock1" }, { name: "Mock2" }],
            };
            redisClient.exists = jest.fn().mockReturnValue(0);

            unpaginateResponseSpy.mockResolvedValue(mockCachedResource);
            const response = await request(app).get("/api/species");

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockCachedResource);
            expect(setRedisKeyValueSpy).toHaveBeenCalledTimes(1);
            expect(unpaginateResponseSpy).toHaveBeenCalledTimes(1);
            expect(unpaginateResponseSpy).toHaveBeenCalledWith(`${mockedAPIHost}/api/species`);
            expect(setRedisKeyValueSpy).toHaveBeenCalledWith("/api/species", mockCachedResource, false);
        });
    });
    describe("Validate unpaginate result", () => {
        const mockOrginalURL = "api/star";
        const mockFirstPage = {
            statusText: "OK",
            data: {
                count: 2,
                next: `${mockedAPIHost}/?page=2`,
                results: [{ name: "Mock1" }, { name: "Mock2" }],
            },
        };
        const mockSecondPage = {
            statusText: "OK",
            data: {
                count: 2,
                next: `${mockedAPIHost}/?page=3`,
                results: [{ name: "Mock3" }, { name: "Mock4" }],
            },
        };
        const mockThirdPage = {
            statusText: "OK",
            data: {
                count: 2,
                next: null,
                results: [{ name: "Mock5" }, { name: "Mock6" }],
            },
        };
        const exceptedResult = {
            count: 6,
            results: [
                { name: "Mock1" },
                { name: "Mock2" },
                { name: "Mock3" },
                { name: "Mock4" },
                { name: "Mock5" },
                { name: "Mock6" },
            ],
        };
        it("should fetch all resource page by page and persist in cache", async () => {
            getRedisKeyValueSpy.mockResolvedValue(null);
            axios.get = jest
                .fn()
                .mockResolvedValueOnce(mockFirstPage)
                .mockResolvedValueOnce(mockSecondPage)
                .mockResolvedValueOnce(mockThirdPage);

            const result = await dataManager.unpaginateResponse(mockOrginalURL);

            expect(result).toEqual(exceptedResult);
            expect(getRedisKeyValueSpy).toHaveBeenCalledTimes(3);
            expect(setRedisKeyValueSpy).toHaveBeenCalledTimes(3);
        });
        it("should fetch all resource only from not cached page and persist in cache", async () => {
            getRedisKeyValueSpy
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(JSON.stringify(mockSecondPage.data))
                .mockResolvedValueOnce(null);
            axios.get = jest.fn().mockResolvedValueOnce(mockFirstPage).mockResolvedValueOnce(mockThirdPage);

            const result = await dataManager.unpaginateResponse(mockOrginalURL);

            expect(result).toEqual(exceptedResult);
            expect(getRedisKeyValueSpy).toHaveBeenCalledTimes(3);
            expect(setRedisKeyValueSpy).toHaveBeenCalledTimes(2);
        });
        it("should throw Error when response not 'OK'", async () => {
            const noOkResponseMock = { statusText: "NotOK" };
            getRedisKeyValueSpy.mockResolvedValueOnce(null);
            axios.get = jest.fn().mockResolvedValueOnce(noOkResponseMock);
            await expect(dataManager.unpaginateResponse(mockOrginalURL)).rejects.toThrow(
                new Error("Can't fetch data from api/star/?page=1"),
            );
        });
    });
    describe("Query commons", () => {
        const mockFilmsEndpointResponse = {
            count: 4,
            results: [
                { name: "Mock1", opening_crawl: " word wor\\rd wor\\nd Luke" },
                { name: "Mock2", opening_crawl: "1 word's Leia common's 2" },
                { name: "Mock3", opening_crawl: "1word Obi-wan wor,d Leia" },
                { name: "Mock4", opening_crawl: "word2 Luke word d" },
            ],
        };
        it("should gather data from films endpoint, query and persist in cache", async () => {
            redisClient.exists = jest.fn().mockReturnValue(0);
            unpaginateResponseSpy.mockResolvedValue(mockFilmsEndpointResponse);
            const expectedResult = [
                ["wor", 3],
                ["word", 2],
                ["Luke", 2],
                ["Leia", 2],
                ["d", 2],
                ["rd", 1],
                ["nd", 1],
                ["1", 1],
                ["word's", 1],
                ["common's", 1],
                ["2", 1],
                ["1word", 1],
                ["Obi", 1],
                ["wan", 1],
                ["word2", 1],
            ];

            const response = await request(app).get("/api/query/common-words");
            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResult);
            expect(getRedisKeyValueSpy).toHaveBeenCalledTimes(0);
            expect(unpaginateResponseSpy).toHaveBeenCalledTimes(1);
            expect(setRedisKeyValueSpy).toHaveBeenCalledTimes(1);
        });
        it("should gather data from films and people endpoint, query and persist in cache", async () => {
            const mockPeopleEndpointResponse = {
                count: 4,
                results: [{ name: "Luke" }, { name: "Leia" }, { name: "Obi-wan" }, { name: "Dooku" }],
            };
            redisClient.exists = jest.fn().mockReturnValue(0);
            unpaginateResponseSpy
                .mockResolvedValueOnce(mockFilmsEndpointResponse)
                .mockResolvedValueOnce(mockPeopleEndpointResponse);
            const expectedResult = ["Luke", "Leia"];

            const response = await request(app).get("/api/query/common-heros");

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expectedResult);
            expect(getRedisKeyValueSpy).toHaveBeenCalledTimes(0);
            expect(unpaginateResponseSpy).toHaveBeenCalledTimes(2);
            expect(setRedisKeyValueSpy).toHaveBeenCalledTimes(1);
        });
    });
});
