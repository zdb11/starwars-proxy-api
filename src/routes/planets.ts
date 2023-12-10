import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { fetchData } from "../middleware/dataManager";

export const planetsRouter: Router = express.Router();

planetsRouter.route("/").get(checkCache, fetchData(true), persistCache);
planetsRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
