import express, { Express } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism.js";
import { fetchData } from "../middleware/dataManager.js";

export const peopleRouter = express.Router();

peopleRouter.route('/').get(checkCache, fetchData(true), persistCache)