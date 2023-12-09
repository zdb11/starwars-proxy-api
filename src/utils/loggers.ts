import { Logger } from "tslog";

export const serverLog = new Logger({name:"Server"});
export const redisLog = new Logger({name:"Redis"});
const middlewareLog = serverLog.getSubLogger({name:"Middleware"});
export const cacheMechanismLog = middlewareLog.getSubLogger({name: "Cache"})
export const errorHandlerLog = middlewareLog.getSubLogger({name: "Error handler"})
export const fetchDataLog = middlewareLog.getSubLogger({name: "Fetch Data"})