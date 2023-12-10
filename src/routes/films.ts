import express, { Router } from "express";
import { checkCache, persistCache } from "../middleware/cacheMechanism";
import { fetchData } from "../middleware/dataManager";

export const filmsRouter: Router = express.Router();

filmsRouter.route("/").get(checkCache, fetchData(true), persistCache);
filmsRouter.route("/:id").get(checkCache, fetchData(false), persistCache);
