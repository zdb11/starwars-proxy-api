import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { fetchData } from "../middleware/dataManager";

export const starshipsRouter: Router = express.Router();

starshipsRouter.route("/").get(checkCache, fetchData(true), persistCache);
starshipsRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
