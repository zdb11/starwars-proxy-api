import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { gatherRequiredResources, queryCommonWords, queryCommonHeros } from "../middleware/dataManager";

export const queryRouter: Router = express.Router();

queryRouter
    .route("/common-words")
    .get(checkCache, gatherRequiredResources([`${process.env.API_HOST}/api/films`]), queryCommonWords, persistCache);
queryRouter
    .route("/common-heros")
    .get(
        checkCache,
        gatherRequiredResources([`${process.env.API_HOST}/api/films`, `${process.env.API_HOST}/api/people`]),
        queryCommonHeros,
        persistCache,
    );
