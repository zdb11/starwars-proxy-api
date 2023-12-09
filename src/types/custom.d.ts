export {};
declare global {
    namespace Express {
        interface Request {
            resource?: object;
        }
    }
}
