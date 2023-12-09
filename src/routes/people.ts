import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism.js";
import { fetchData } from "../middleware/dataManager.js";

export const peopleRouter: Router = express.Router();

peopleRouter.route('/').get(checkCache, fetchData(true), persistCache)
peopleRouter.route('/:id').get(checkCache, fetchData(false), persistCache)