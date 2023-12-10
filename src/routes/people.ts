import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { fetchData } from "../middleware/dataManager";

export const peopleRouter: Router = express.Router();

peopleRouter.route("/").get(checkCache, fetchData(true), persistCache);
peopleRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
