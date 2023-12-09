import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism.js";
import { fetchData } from "../middleware/dataManager.js";

export const planetsRouter: Router = express.Router();

planetsRouter.route("/").get(checkCache, fetchData(true), persistCache);
planetsRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
