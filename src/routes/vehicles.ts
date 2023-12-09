import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism.js";
import { fetchData } from "../middleware/dataManager.js";

export const vehiclesRouter: Router = express.Router();

vehiclesRouter.route("/").get(checkCache, fetchData(true), persistCache);
vehiclesRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
