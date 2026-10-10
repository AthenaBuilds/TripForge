declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: { id: string };
    }
  }
}

export {};
