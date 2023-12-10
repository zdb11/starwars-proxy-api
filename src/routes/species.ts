import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { fetchData } from "../middleware/dataManager";

export const speciesRouter: Router = express.Router();

speciesRouter.route("/").get(checkCache, fetchData(true), persistCache);
speciesRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
