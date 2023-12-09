import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism.js";
import { gatherRequiredResources, queryCommonWords } from "../middleware/dataManager.js";

export const queryRouter: Router = express.Router();

queryRouter
    .route("/common-words")
    .get(checkCache, gatherRequiredResources([`${process.env.API_HOST}/api/films`]), persistCache, queryCommonWords);
