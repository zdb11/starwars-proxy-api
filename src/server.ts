import { redisClient } from "./redis/redis";
import { serverLog } from "./utils/loggers";
import { app } from "./app";

app.listen(process.env.SERVER_PORT, async () => {
    serverLog.info(`Connecting to Redis ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    await redisClient.connect();
    serverLog.info(`Server is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`);
});
