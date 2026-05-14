import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'clean_admin_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
}

export async function hashPassword(plain) {
    return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}

export function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export function setAuthCookie(res, token) {
    const cookie = `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', cookie);
}

export function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export function getAdminFromRequest(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    return verifyToken(token);
}

export function requireAdmin(req, res) {
    const admin = getAdminFromRequest(req);
    if (!admin) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    return admin;
}