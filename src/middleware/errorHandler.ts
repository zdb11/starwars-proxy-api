import { type Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../interfaces/ErrorResponse";
import { errorHandlerLog } from "../utils/loggers";

export const errorHandler = (err: ErrorResponse, req: Request, res: Response, next: NextFunction) => {
    errorHandlerLog.error(err);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || "Server Error" });
};
