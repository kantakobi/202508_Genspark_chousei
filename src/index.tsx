import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://*.pages.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Use renderer for HTML pages
app.use(renderer)

// === API Routes ===

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes
app.get('/api/auth/google', (c) => {
  // Google OAuth initiation
  const clientId = c.env.GOOGLE_CLIENT_ID || 'demo-client-id'
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`
  const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/calendar')
  const state = Math.random().toString(36).substring(2, 15)
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `state=${state}`
  
  return c.redirect(authUrl)
})

app.get('/api/auth/google/callback', async (c) => {
  // Handle OAuth callback (placeholder)
  const code = c.req.query('code')
  const state = c.req.query('state')
  
  if (!code) {
    return c.json({ error: 'Authorization code not provided' }, 400)
  }
  
  // TODO: Exchange code for tokens and create session
  return c.json({ message: 'OAuth callback received', code, state })
})

app.get('/api/auth/logout', (c) => {
  // TODO: Clear session
  return c.json({ message: 'Logged out successfully' })
})

app.get('/api/auth/me', (c) => {
  // TODO: Return current user info
  return c.json({ 
    user: {
      id: 1,
      name: '小平勘太',
      email: 'kohira@example.com',
      picture: 'https://via.placeholder.com/150'
    }
  })
})

// Events API
app.get('/api/events', async (c) => {
  // TODO: Get user's events from database
  return c.json({ 
    events: [
      {
        id: 1,
        title: 'プロジェクト会議',
        description: '新規プロジェクトのキックオフ会議',
        status: 'open',
        deadline: '2025-08-20T23:59:59Z',
        created_at: '2025-08-15T12:00:00Z'
      }
    ]
  })
})

app.post('/api/events', async (c) => {
  // TODO: Create new event
  const body = await c.req.json()
  return c.json({ message: 'Event created', event: { id: 1, ...body } })
})

app.get('/api/events/:id', async (c) => {
  const eventId = c.req.param('id')
  // TODO: Get specific event with participants and time slots
  return c.json({
    event: {
      id: parseInt(eventId),
      title: 'プロジェクト会議',
      description: '新規プロジェクトのキックオフ会議',
      status: 'open',
      participants: [
        { id: 1, name: '小平勘太', email: 'kohira@example.com', status: 'responded' },
        { id: 2, name: '田中太郎', email: 'tanaka@example.com', status: 'invited' }
      ],
      time_slots: [
        {
          id: 1,
          start_datetime: '2025-08-20T10:00:00Z',
          end_datetime: '2025-08-20T11:30:00Z',
          responses: [
            { user_id: 1, status: 'available' },
            { user_id: 2, status: 'maybe' }
          ]
        }
      ]
    }
  })
})

app.post('/api/events/:id/respond', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  // TODO: Save availability responses
  return c.json({ message: 'Response saved', event_id: eventId, responses: body.responses })
})

app.post('/api/events/:id/confirm', async (c) => {
  const eventId = c.req.param('id')
  const body = await c.req.json()
  // TODO: Confirm event and create Google Calendar event
  return c.json({ 
    message: 'Event confirmed', 
    event_id: eventId, 
    google_event_id: 'mock_google_event_id',
    calendar_url: 'https://calendar.google.com/event?eid=mock_event_id'
  })
})

// Calendar integration
app.get('/api/calendar/events', async (c) => {
  // TODO: Get user's calendar events from Google Calendar
  return c.json({ 
    events: [
      {
        id: 'google_event_1',
        title: '既存の会議',
        start: '2025-08-20T09:00:00Z',
        end: '2025-08-20T10:00:00Z'
      }
    ]
  })
})

// === HTML Pages ===

// Home page
app.get('/', (c) => {
  return c.render(
    <div>
      <h1>スケジュール調整アプリ</h1>
      <div id="app">
        <div class="loading">読み込み中...</div>
      </div>
    </div>
  )
})

// Event detail page
app.get('/events/:id', (c) => {
  const eventId = c.req.param('id')
  return c.render(
    <div>
      <h1>イベント詳細</h1>
      <div id="app" data-event-id={eventId}>
        <div class="loading">読み込み中...</div>
      </div>
    </div>
  )
})

export default app
