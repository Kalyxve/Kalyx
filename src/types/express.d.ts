import { AuthUser } from '../middlewares/auth';

declare global {
  namespace Express {
    export interface Request {
      user?: Partial<AuthUser>;
    }
  }
}
