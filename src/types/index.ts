import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  isVerified: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

export interface SocketData {
  userId: string;
  user: any;
}