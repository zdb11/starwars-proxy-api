import { MiddlewareResource } from "../interfaces/Resources.ts";

declare global {
    namespace Express {
        interface Request {
            resources?: Array<MiddlewareResource>;
        }
    }
}
