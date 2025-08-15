import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import { Bindings } from './types'
import { GoogleOAuth, UserService, JWTAuth, requireAuth, generateOAuthState } from './lib/auth'
import { CalendarService, GoogleCalendarAPI } from './lib/calendar'
import { ScheduleService } from './lib/schedule'

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

    const scheduleService = new ScheduleService(c.env.DB)
    const events = await scheduleService.getUserEvents(session.user_id, {
      limit: 50
    })

    return c.json({ events })
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
    
    // Validate required fields
    if (!body.title) {
      return c.json({ error: 'Event title is required' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const result = await scheduleService.createEvent(session.user_id, body)

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to create event' }, 500)
    }
    
    return c.json({ 
      message: 'Event created successfully', 
      event: result.event 
    })
  } catch (error) {
    console.error('Create event error:', error)
    return c.json({ error: 'Failed to create event' }, 500)
  }
})

app.get('/api/events/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = parseInt(c.req.param('id'))
    if (isNaN(eventId)) {
      return c.json({ error: 'Invalid event ID' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const event = await scheduleService.getEventById(eventId, session.user_id)

    if (!event) {
      return c.json({ error: 'Event not found or access denied' }, 404)
    }

    return c.json({ event })
  } catch (error) {
    console.error('Get event error:', error)
    return c.json({ error: 'Failed to get event' }, 500)
  }
})

app.post('/api/events/:id/respond', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = parseInt(c.req.param('id'))
    if (isNaN(eventId)) {
      return c.json({ error: 'Invalid event ID' }, 400)
    }

    const body = await c.req.json()
    
    if (!body.responses || !Array.isArray(body.responses)) {
      return c.json({ error: 'Responses array is required' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const result = await scheduleService.submitAvailabilityResponses(
      session.user_id,
      eventId,
      body.responses
    )

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to save responses' }, 500)
    }

    return c.json({ 
      message: 'Responses saved successfully', 
      event_id: eventId 
    })
  } catch (error) {
    console.error('Submit responses error:', error)
    return c.json({ error: 'Failed to save responses' }, 500)
  }
})

app.get('/api/events/:id/optimal-slots', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = parseInt(c.req.param('id'))
    if (isNaN(eventId)) {
      return c.json({ error: 'Invalid event ID' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const optimalSlots = await scheduleService.findOptimalTimeSlots(eventId)

    if (!optimalSlots) {
      return c.json({ error: 'Failed to analyze time slots' }, 500)
    }

    return c.json({ optimal_slots: optimalSlots })
  } catch (error) {
    console.error('Get optimal slots error:', error)
    return c.json({ error: 'Failed to get optimal slots' }, 500)
  }
})

app.get('/api/events/:id/statistics', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = parseInt(c.req.param('id'))
    if (isNaN(eventId)) {
      return c.json({ error: 'Invalid event ID' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const statistics = await scheduleService.getEventStatistics(eventId)

    if (!statistics) {
      return c.json({ error: 'Failed to get event statistics' }, 500)
    }

    return c.json({ statistics })
  } catch (error) {
    console.error('Get event statistics error:', error)
    return c.json({ error: 'Failed to get event statistics' }, 500)
  }
})

app.post('/api/events/:id/confirm', async (c) => {
  try {
    const session = await requireAuth(c)
    
    if (!session) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const eventId = parseInt(c.req.param('id'))
    if (isNaN(eventId)) {
      return c.json({ error: 'Invalid event ID' }, 400)
    }

    const body = await c.req.json()
    const { time_slot_id, location, send_calendar_invites = true } = body

    if (!time_slot_id) {
      return c.json({ error: 'Time slot ID is required' }, 400)
    }

    const scheduleService = new ScheduleService(c.env.DB)
    const result = await scheduleService.confirmEvent(
      eventId,
      parseInt(time_slot_id),
      session.user_id,
      {
        location,
        sendCalendarInvites: send_calendar_invites
      }
    )

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to confirm event' }, 500)
    }

    return c.json({ 
      message: 'Event confirmed successfully', 
      event: result.confirmedEvent,
      calendar_result: result.calendarResult
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
