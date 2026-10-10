import type { RequestHandler } from 'express';
import { loginInputSchema, signupInputSchema } from '@tripforge/shared';
import { toUserDto } from '../lib/dto.js';
import { parse, sendData } from '../lib/http.js';
import { clearSessionCookie, setSessionCookie } from '../lib/session.js';
import { currentUserId } from '../middleware/requireAuth.js';
import * as authService from '../services/auth.service.js';

export const signup: RequestHandler = async (req, res) => {
  const input = parse(signupInputSchema, req.body);
  const user = await authService.signup(input);
  setSessionCookie(res, user.id);
  sendData(res, 201, { user: toUserDto(user) });
};

export const login: RequestHandler = async (req, res) => {
  const input = parse(loginInputSchema, req.body);
  const user = await authService.login(input);
  setSessionCookie(res, user.id);
  sendData(res, 200, { user: toUserDto(user) });
};

export const logout: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const user = await authService.getUser(currentUserId(req));
  sendData(res, 200, { user: toUserDto(user) });
};
