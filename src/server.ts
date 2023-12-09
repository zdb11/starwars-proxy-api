import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import { redisClient } from "./redis/redis.js";
import { serverLog } from "./utils/loggers.js";
import { peopleRouter } from "./routes/people.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { filmsRouter } from "./routes/films.js";
import { planetsRouter } from "./routes/planets.js";
import { speciesRouter } from "./routes/species.js";
import { starshipsRouter } from "./routes/starships.js";
import { vehiclesRouter } from "./routes/vehicles.js";

// Loading .env file before initialization of express
dotenv.config();

const app: Express = express();

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

// Mount errorHandler as a last middleware
app.use(errorHandler);

app.listen(process.env.SERVER_PORT, async () => {
    serverLog.info(`Connecting to Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    await redisClient.connect();
    serverLog.info(`Server is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`);
});
