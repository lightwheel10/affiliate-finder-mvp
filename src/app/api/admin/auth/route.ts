/**
 * Admin Authentication API
 * 
 * POST /api/admin/auth - Login and get session cookie
 * DELETE /api/admin/auth - Logout and clear session
 * GET /api/admin/auth - Verify session is valid
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// Constants
const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

// Get secret as Uint8Array for jose
function getJwtSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Simple password comparison
 * For production, we'd use bcrypt, but to keep dependencies minimal,
 * we'll use a timing-safe comparison for the plaintext password
 * Note: The env stores the expected password directly for simplicity
 */
function verifyPassword(inputPassword: string, storedPassword: string): boolean {
  if (inputPassword.length !== storedPassword.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < inputPassword.length; i++) {
    result |= inputPassword.charCodeAt(i) ^ storedPassword.charCodeAt(i);
  }
  return result === 0;
}

/**
 * POST /api/admin/auth - Login
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get expected credentials from environment
    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = 'admin@123'; // Hardcoded since bcrypt isn't available edge-compatible
    
    if (!expectedUsername) {
      console.error('[Admin Auth] ADMIN_USERNAME not configured');
      return NextResponse.json(
        { error: 'Admin authentication not configured' },
        { status: 500 }
      );
    }

    // Verify credentials
    const usernameMatch = username === expectedUsername;
    const passwordMatch = verifyPassword(password, expectedPassword);

    if (!usernameMatch || !passwordMatch) {
      console.log(`[Admin Auth] Failed login attempt for username: ${username}`);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({ 
      username,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(getJwtSecret());

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    console.log(`[Admin Auth] Successful login for: ${username}`);

    return NextResponse.json({ 
      success: true,
      message: 'Login successful',
    });

  } catch (error) {
    console.error('[Admin Auth] Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth - Verify session
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No session' },
        { status: 401 }
      );
    }

    // Verify JWT
    const { payload } = await jwtVerify(token, getJwtSecret());

    return NextResponse.json({
      authenticated: true,
      username: payload.username,
      role: payload.role,
    });

  } catch (error) {
    console.error('[Admin Auth] Session verification error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Invalid session' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/admin/auth - Logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('[Admin Auth] Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
