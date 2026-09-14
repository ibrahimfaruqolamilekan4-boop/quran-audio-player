// Type declarations for _lib.mjs so the TypeScript endpoint files stay fully
// typed while the runtime module is plain JavaScript.
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
}

export interface QueryResult<T = any> {
  rows: T[];
}

export function getPool(): Promise<{ query: (text: string, params?: unknown[]) => Promise<QueryResult> }>;
export function q<T = any>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
export function qWithFallback<T = any>(queries: Array<{ text: string; params?: unknown[] }>): Promise<QueryResult<T>>;
export function mapUser(row: {
  uid: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  role: 'user' | 'admin';
}): AppUser;

export function hashPassword(password: string): string;
export function verifyPassword(password: string, stored: string | null): boolean;

export function createSessionToken(uid: string): string;
export function readSessionToken(req: IncomingMessage): string | null;
export function getAuthUser(req: IncomingMessage): Promise<AppUser | null>;
export function sessionCookie(token: string, secure: boolean): string;
export function clearedSessionCookie(secure: boolean): string;

export function sendJson(res: ServerResponse, status: number, body: unknown): void;
export function readJson(req: IncomingMessage): Promise<Record<string, unknown>>;
export function apiPath(req: IncomingMessage): string[];
export function isSecureRequest(req: IncomingMessage): boolean;

export function requireAuth(req: IncomingMessage, res: ServerResponse): Promise<AppUser | null>;
export function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<AppUser | null>;
export function validEmail(email: unknown): email is string;
export function adminEmail(): string;
export function cleanImageUrl(value: unknown): string | null;
