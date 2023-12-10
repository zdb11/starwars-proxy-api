import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";

import { peopleRouter } from "./routes/people";
import { errorHandler } from "./middleware/errorHandler";
import { filmsRouter } from "./routes/films";
import { planetsRouter } from "./routes/planets";
import { speciesRouter } from "./routes/species";
import { starshipsRouter } from "./routes/starships";
import { vehiclesRouter } from "./routes/vehicles";
import { queryRouter } from "./routes/query";

// Loading .env file before initialization of express
dotenv.config();

export const app: Express = express();

app.use(express.json());

// Additional log prettier in development mode
if (process.env.ENVIRONMENT === "development") {
    app.use(morgan("dev"));
}

// Mounting routes
app.use("/api/films", filmsRouter);
app.use("/api/people", peopleRouter);
app.use("/api/planets", planetsRouter);
app.use("/api/species", speciesRouter);
app.use("/api/starships", starshipsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/query", queryRouter);

// Mount errorHandler as a last middleware
app.use(errorHandler);
