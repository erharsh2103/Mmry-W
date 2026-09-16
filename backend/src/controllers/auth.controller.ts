import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";
import { input } from "../middleware/validate.js";
import { authService, type ClientContext, type Session } from "../services/auth.service.js";
import { unauthorized } from "../utils/httpError.js";

export const REFRESH_COOKIE = "mmry_rt";
/* Carries no secret (its value is "1"): it only tells the frontend whether a
   session might exist, so signed-out visitors skip a refresh round trip and
   the proxy can route them to sign-in. The API never trusts it. */
export const SESSION_HINT_COOKIE = "mmry_session";

const refreshCookie = (expires: Date): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "strict",
  path: "/api/v1/auth",
  expires,
});

const hintCookie = (expires: Date): CookieOptions => ({
  httpOnly: false,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
  expires,
});

const context = (req: Request): ClientContext => ({ userAgent: req.header("user-agent") ?? null, ip: req.ip ?? null });

function sendSession(res: Response, session: Session, status = 200): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookie(session.refreshTokenExpiresAt));
  res.cookie(SESSION_HINT_COOKIE, "1", hintCookie(session.refreshTokenExpiresAt));
  res.setHeader("cache-control", "no-store");
  res.status(status).json({ user: session.user, accessToken: session.accessToken, expiresIn: session.accessTokenExpiresIn });
}

function clearSession(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookie(new Date(0)), expires: undefined });
  res.clearCookie(SESSION_HINT_COOKIE, { ...hintCookie(new Date(0)), expires: undefined });
}

export const authController = {
  async register(req: Request, res: Response) {
    const body = input<{ email: string; password: string; fullName: string }>(res, "body");
    sendSession(res, await authService.register(body, context(req)), 201);
  },

  async login(req: Request, res: Response) {
    const body = input<{ email: string; password: string }>(res, "body");
    sendSession(res, await authService.login(body, context(req)));
  },

  async refresh(req: Request, res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== "string" || !token) {
      clearSession(res);
      throw unauthorized("Not signed in");
    }
    try {
      sendSession(res, await authService.refresh(token, context(req)));
    } catch (err) {
      clearSession(res);
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    await authService.logout(typeof token === "string" ? token : undefined);
    clearSession(res);
    res.status(204).end();
  },

  async me(req: Request, res: Response) {
    res.json({ user: await authService.me(req.auth!.sub) });
  },
};
