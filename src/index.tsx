import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import { Bindings } from './types'
import { GoogleOAuth, UserService, JWTAuth, requireAuth, generateOAuthState } from './lib/auth'
import { CalendarService, GoogleCalendarAPI } from './lib/calendar'

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
  try {
    const clientId = c.env.GOOGLE_CLIENT_ID || 'demo-google-client-id'
    const appUrl = c.env.APP_URL || new URL(c.req.url).origin
    const redirectUri = `${appUrl}/api/auth/google/callback`
    
    const googleOAuth = new GoogleOAuth(
      clientId,
      c.env.GOOGLE_CLIENT_SECRET || 'demo-secret',
      redirectUri
    )
    
    const state = generateOAuthState()
    const scopes = [
      'openid',
      'email', 
      'profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ]
    
    const authUrl = googleOAuth.getAuthUrl(state, scopes)
    
    // Store state in a cookie for verification (in production, use encrypted storage)
    c.header('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`)
    
    return c.redirect(authUrl)
  } catch (error) {
    console.error('OAuth initiation error:', error)
    return c.json({ error: 'Failed to initiate OAuth' }, 500)
  }
})

app.get('/api/auth/google/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')
    
    if (error) {
      return c.json({ error: `OAuth error: ${error}` }, 400)
    }
    
    if (!code || !state) {
      return c.json({ error: 'Missing authorization code or state' }, 400)
    }
    
    // Verify state (in production, compare with stored encrypted state)
    const storedState = c.req.header('Cookie')?.match(/oauth_state=([^;]+)/)?.[1]
    if (!storedState || storedState !== state) {
      return c.json({ error: 'Invalid state parameter' }, 400)
    }
    
    const clientId = c.env.GOOGLE_CLIENT_ID || 'demo-google-client-id'
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET || 'demo-secret'
    const appUrl = c.env.APP_URL || new URL(c.req.url).origin
    const redirectUri = `${appUrl}/api/auth/google/callback`
    
    const googleOAuth = new GoogleOAuth(clientId, clientSecret, redirectUri)
    
    // Exchange code for tokens
    const tokens = await googleOAuth.exchangeCodeForTokens(code)
    if (!tokens) {
      return c.json({ error: 'Failed to exchange authorization code' }, 500)
    }
    
    // Get user info
    const userInfo = await googleOAuth.getUserInfo(tokens.access_token)
    if (!userInfo) {
      return c.json({ error: 'Failed to get user information' }, 500)
    }
    
    // Store/update user in database
    const userService = new UserService(c.env.DB)
    let user = await userService.findByGoogleId(userInfo.id)
    
    if (!user) {
      // Create new user
      user = await userService.createUser({
        google_id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      })
    } else {
      // Update existing user
      await userService.updateTokens(userInfo.id, tokens.access_token, tokens.refresh_token)
      await userService.updateUserInfo(userInfo.id, {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      })
      // Refresh user data
      user = await userService.findByGoogleId(userInfo.id)
    }
    
    if (!user) {
      return c.json({ error: 'Failed to create/update user' }, 500)
    }
    
    // Create JWT session
    const jwtAuth = new JWTAuth(c.env.JWT_SECRET || 'demo-secret')
    const sessionData = {
      user_id: user.id,
      google_id: user.google_id,
      email: user.email,
      name: user.name
    }
    
    const token = await jwtAuth.createToken(sessionData)
    
    // Set authentication cookie
    c.header('Set-Cookie', `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`)
    
    // Clear oauth state cookie
    c.header('Set-Cookie', `oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`)
    
    // Redirect to main app
    return c.redirect('/')
    
  } catch (error) {
    console.error('OAuth callback error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

app.get('/api/auth/logout', (c) => {
  // Clear authentication cookie
  c.header('Set-Cookie', `auth_token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`)
  return c.json({ message: 'Logged out successfully' })
})

app.get('/api/auth/me', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Not authenticated' }, 401)
    }
    
    // Get fresh user data from database
    const userService = new UserService(c.env.DB)
    const user = await userService.findByGoogleId(session.google_id)
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture
      }
    })
  } catch (error) {
    console.error('Get user info error:', error)
    return c.json({ error: 'Failed to get user information' }, 500)
  }
})

// Events API
app.get('/api/events', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    // TODO: Get user's events from database based on session.user_id
    return c.json({ 
      events: [
        {
          id: 1,
          title: 'プロジェクト会議',
          description: '新規プロジェクトのキックオフ会議',
          status: 'open',
          deadline: '2025-08-20T23:59:59Z',
          created_at: '2025-08-15T12:00:00Z',
          created_by: session.user_id
        }
      ]
    })
  } catch (error) {
    console.error('Get events error:', error)
    return c.json({ error: 'Failed to get events' }, 500)
  }
})

app.post('/api/events', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    const body = await c.req.json()
    
    // TODO: Create new event in database with session.user_id as created_by
    const eventData = {
      id: Math.floor(Math.random() * 10000), // Temporary ID generation
      ...body,
      created_by: session.user_id,
      status: 'draft',
      created_at: new Date().toISOString()
    }
    
    return c.json({ 
      message: 'Event created successfully', 
      event: eventData 
    })
  } catch (error) {
    console.error('Create event error:', error)
    return c.json({ error: 'Failed to create event' }, 500)
  }
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
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = c.req.param('id')
    const body = await c.req.json()
    const { time_slot_id, location } = body

    if (!time_slot_id) {
      return c.json({ error: 'Time slot ID is required' }, 400)
    }

    // TODO: In real implementation, fetch event and time slot from database
    // For now, we'll use mock data with proper calendar integration
    
    const mockEvent = {
      id: parseInt(eventId),
      title: 'プロジェクト会議',
      description: '新規プロジェクトのキックオフ会議',
      created_by: session.user_id
    }

    const mockTimeSlot = {
      id: parseInt(time_slot_id),
      start_datetime: '2025-08-20T10:00:00Z',
      end_datetime: '2025-08-20T11:30:00Z'
    }

    // Get participant emails (mock data for now)
    const participantEmails = ['kohira@example.com', 'tanaka@example.com']

    // Create Google Calendar event
    const calendarService = new CalendarService(c.env.DB)
    const clientId = c.env.GOOGLE_CLIENT_ID || 'demo-google-client-id'
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET || 'demo-secret'
    const appUrl = c.env.APP_URL || new URL(c.req.url).origin
    const redirectUri = `${appUrl}/api/auth/google/callback`
    
    const googleOAuth = new GoogleOAuth(clientId, clientSecret, redirectUri)
    
    const result = await calendarService.createEventFromSchedule(
      session.user_id,
      {
        title: mockEvent.title,
        description: mockEvent.description,
        startTime: mockTimeSlot.start_datetime,
        endTime: mockTimeSlot.end_datetime,
        attendeeEmails: participantEmails,
        location: location || undefined
      },
      googleOAuth
    )

    if (!result.success) {
      return c.json({ 
        error: result.error || 'Failed to create calendar event',
        fallback_message: 'イベントは確定されましたが、カレンダーへの追加に失敗しました'
      }, 500)
    }

    // TODO: Update event status in database to 'confirmed'
    // TODO: Save confirmed_events record with google_event_id

    return c.json({ 
      message: 'Event confirmed and added to calendar successfully', 
      event_id: eventId,
      time_slot_id,
      google_event_id: result.eventId,
      calendar_url: result.calendarUrl,
      location: location || null
    })
  } catch (error) {
    console.error('Confirm event error:', error)
    return c.json({ error: 'Failed to confirm event' }, 500)
  }
})

// Calendar integration
app.get('/api/calendar/events', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const calendarService = new CalendarService(c.env.DB)
    const events = await calendarService.getUserUpcomingEvents(session.user_id, 30)
    
    if (!events) {
      return c.json({ error: 'Failed to retrieve calendar events' }, 500)
    }

    return c.json({ 
      events: events.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        location: event.location,
        attendees: event.attendees?.map(a => a.email) || []
      }))
    })
  } catch (error) {
    console.error('Get calendar events error:', error)
    return c.json({ error: 'Failed to get calendar events' }, 500)
  }
})

app.get('/api/calendar/calendars', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const calendarService = new CalendarService(c.env.DB)
    const calendarAPI = await calendarService.getCalendarAPIForUser(session.user_id)
    
    if (!calendarAPI) {
      return c.json({ error: 'Calendar access not available' }, 400)
    }

    const calendars = await calendarAPI.getCalendars()
    
    if (!calendars) {
      return c.json({ error: 'Failed to retrieve calendars' }, 500)
    }

    return c.json({ calendars })
  } catch (error) {
    console.error('Get calendars error:', error)
    return c.json({ error: 'Failed to get calendars' }, 500)
  }
})

app.post('/api/calendar/check-conflicts', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const body = await c.req.json()
    const { startTime, endTime, participantIds = [] } = body

    if (!startTime || !endTime) {
      return c.json({ error: 'Start time and end time are required' }, 400)
    }

    const calendarService = new CalendarService(c.env.DB)
    const allUserIds = [session.user_id, ...participantIds]
    
    const conflicts = await calendarService.checkSchedulingConflicts(
      allUserIds,
      startTime,
      endTime
    )

    return c.json({ conflicts })
  } catch (error) {
    console.error('Check conflicts error:', error)
    return c.json({ error: 'Failed to check conflicts' }, 500)
  }
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
