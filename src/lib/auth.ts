import { SignJWT, jwtVerify } from 'jose'
import type { SessionData, Bindings } from '../types'

// JWT utilities
export class JWTAuth {
  private secret: Uint8Array

  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey)
  }

  async createToken(payload: SessionData): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(this.secret)
  }

  async verifyToken(token: string): Promise<SessionData | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      return payload as SessionData
    } catch (error) {
      console.error('JWT verification failed:', error)
      return null
    }
  }
}

// Google OAuth utilities
export class GoogleOAuth {
  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.redirectUri = redirectUri
  }

  getAuthUrl(state: string, scopes: string[] = ['openid', 'email', 'profile']): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent'
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    refresh_token?: string
    id_token?: string
    expires_in: number
  } | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      })

      if (!response.ok) {
        console.error('Token exchange failed:', response.status, await response.text())
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Token exchange error:', error)
      return null
    }
  }

  async getUserInfo(accessToken: string): Promise<{
    id: string
    email: string
    name: string
    picture?: string
  } | null> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        console.error('User info fetch failed:', response.status)
        return null
      }

      const userInfo = await response.json()
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      }
    } catch (error) {
      console.error('User info fetch error:', error)
      return null
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string
    expires_in: number
  } | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        console.error('Token refresh failed:', response.status)
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Token refresh error:', error)
      return null
    }
  }
}

// Database operations for users
export class UserService {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async findByGoogleId(googleId: string) {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .bind(googleId)
      .first()
    return result
  }

  async findByEmail(email: string) {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first()
    return result
  }

  async createUser(userData: {
    google_id: string
    email: string
    name: string
    picture?: string
    access_token?: string
    refresh_token?: string
  }) {
    const result = await this.db
      .prepare(`
        INSERT INTO users (google_id, email, name, picture, access_token, refresh_token, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .bind(
        userData.google_id,
        userData.email,
        userData.name,
        userData.picture || null,
        userData.access_token || null,
        userData.refresh_token || null
      )
      .run()

    if (result.success) {
      return await this.findByGoogleId(userData.google_id)
    }
    return null
  }

  async updateTokens(googleId: string, accessToken: string, refreshToken?: string) {
    const result = await this.db
      .prepare(`
        UPDATE users 
        SET access_token = ?, refresh_token = COALESCE(?, refresh_token), updated_at = datetime('now')
        WHERE google_id = ?
      `)
      .bind(accessToken, refreshToken || null, googleId)
      .run()

    return result.success
  }

  async updateUserInfo(googleId: string, userData: {
    email?: string
    name?: string
    picture?: string
  }) {
    const result = await this.db
      .prepare(`
        UPDATE users 
        SET email = COALESCE(?, email), name = COALESCE(?, name), picture = COALESCE(?, picture), updated_at = datetime('now')
        WHERE google_id = ?
      `)
      .bind(userData.email || null, userData.name || null, userData.picture || null, googleId)
      .run()

    return result.success
  }
}

// Middleware for authentication
export async function requireAuth(c: any): Promise<SessionData | null> {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  
  // Also check for token in cookies
  const cookieToken = c.req.header('Cookie')?.match(/auth_token=([^;]+)/)?.[1]
  const finalToken = token || cookieToken

  if (!finalToken) {
    return null
  }

  const jwtAuth = new JWTAuth(c.env.JWT_SECRET || 'fallback-secret')
  const session = await jwtAuth.verifyToken(finalToken)
  
  return session
}

// Generate random state for OAuth
export function generateOAuthState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}