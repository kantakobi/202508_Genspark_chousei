import type { GoogleCalendarEvent, User } from '../types'
import { GoogleOAuth, UserService } from './auth'

export class GoogleCalendarAPI {
  private accessToken: string
  private refreshToken?: string
  private googleOAuth?: GoogleOAuth

  constructor(accessToken: string, refreshToken?: string, googleOAuth?: GoogleOAuth) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.googleOAuth = googleOAuth
  }

  // Helper method to refresh access token if needed
  private async ensureValidToken(): Promise<boolean> {
    if (!this.refreshToken || !this.googleOAuth) {
      return true // Assume token is valid if we can't refresh
    }

    // In a real implementation, you'd check token expiry here
    // For now, we'll assume the token is valid
    return true
  }

  // Get user's calendars
  async getCalendars(): Promise<Array<{
    id: string
    summary: string
    description?: string
    primary?: boolean
    timeZone?: string
  }> | null> {
    try {
      await this.ensureValidToken()

      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Failed to get calendars:', response.status, await response.text())
        return null
      }

      const data = await response.json()
      return data.items || []
    } catch (error) {
      console.error('Get calendars error:', error)
      return null
    }
  }

  // Get events from a specific calendar
  async getEvents(calendarId: string = 'primary', options: {
    timeMin?: string
    timeMax?: string
    maxResults?: number
    orderBy?: 'startTime' | 'updated'
  } = {}): Promise<GoogleCalendarEvent[] | null> {
    try {
      await this.ensureValidToken()

      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: options.orderBy || 'startTime',
        ...(options.timeMin && { timeMin: options.timeMin }),
        ...(options.timeMax && { timeMax: options.timeMax }),
        ...(options.maxResults && { maxResults: options.maxResults.toString() }),
      })

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        console.error('Failed to get events:', response.status, await response.text())
        return null
      }

      const data = await response.json()
      return data.items || []
    } catch (error) {
      console.error('Get events error:', error)
      return null
    }
  }

  // Create a new calendar event
  async createEvent(calendarId: string = 'primary', event: {
    summary: string
    description?: string
    start: {
      dateTime: string
      timeZone?: string
    }
    end: {
      dateTime: string
      timeZone?: string
    }
    attendees?: Array<{
      email: string
      displayName?: string
    }>
    location?: string
    reminders?: {
      useDefault?: boolean
      overrides?: Array<{
        method: 'email' | 'popup'
        minutes: number
      }>
    }
  }): Promise<GoogleCalendarEvent | null> {
    try {
      await this.ensureValidToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...event,
            sendUpdates: 'all', // Send email notifications to attendees
          }),
        }
      )

      if (!response.ok) {
        console.error('Failed to create event:', response.status, await response.text())
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Create event error:', error)
      return null
    }
  }

  // Update an existing calendar event
  async updateEvent(calendarId: string = 'primary', eventId: string, event: Partial<{
    summary: string
    description?: string
    start: {
      dateTime: string
      timeZone?: string
    }
    end: {
      dateTime: string
      timeZone?: string
    }
    attendees?: Array<{
      email: string
      displayName?: string
    }>
    location?: string
  }>): Promise<GoogleCalendarEvent | null> {
    try {
      await this.ensureValidToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...event,
            sendUpdates: 'all',
          }),
        }
      )

      if (!response.ok) {
        console.error('Failed to update event:', response.status, await response.text())
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Update event error:', error)
      return null
    }
  }

  // Delete a calendar event
  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<boolean> {
    try {
      await this.ensureValidToken()

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      )

      return response.ok
    } catch (error) {
      console.error('Delete event error:', error)
      return false
    }
  }

  // Check for conflicts in a given time slot
  async checkConflicts(calendarId: string = 'primary', startTime: string, endTime: string): Promise<GoogleCalendarEvent[] | null> {
    const events = await this.getEvents(calendarId, {
      timeMin: startTime,
      timeMax: endTime,
      orderBy: 'startTime',
    })

    if (!events) return null

    // Filter events that actually overlap with the given time slot
    return events.filter(event => {
      if (!event.start?.dateTime || !event.end?.dateTime) return false
      
      const eventStart = new Date(event.start.dateTime)
      const eventEnd = new Date(event.end.dateTime)
      const slotStart = new Date(startTime)
      const slotEnd = new Date(endTime)

      // Check for overlap
      return eventStart < slotEnd && eventEnd > slotStart
    })
  }

  // Get free/busy information for multiple calendars
  async getFreeBusy(
    calendars: string[],
    timeMin: string,
    timeMax: string
  ): Promise<{
    [calendarId: string]: Array<{
      start: string
      end: string
    }>
  } | null> {
    try {
      await this.ensureValidToken()

      const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: calendars.map(id => ({ id })),
        }),
      })

      if (!response.ok) {
        console.error('Failed to get free/busy:', response.status, await response.text())
        return null
      }

      const data = await response.json()
      const result: { [calendarId: string]: Array<{ start: string; end: string }> } = {}

      for (const calendarId of calendars) {
        const busyTimes = data.calendars?.[calendarId]?.busy || []
        result[calendarId] = busyTimes
      }

      return result
    } catch (error) {
      console.error('Get free/busy error:', error)
      return null
    }
  }
}

// Service class for calendar operations with database integration
export class CalendarService {
  private db: D1Database
  private userService: UserService

  constructor(db: D1Database) {
    this.db = db
    this.userService = new UserService(db)
  }

  // Get Google Calendar API client for a user
  async getCalendarAPIForUser(userId: number, googleOAuth?: GoogleOAuth): Promise<GoogleCalendarAPI | null> {
    try {
      const user = await this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(userId)
        .first() as any

      if (!user || !user.access_token) {
        return null
      }

      return new GoogleCalendarAPI(user.access_token, user.refresh_token, googleOAuth)
    } catch (error) {
      console.error('Failed to get calendar API for user:', error)
      return null
    }
  }

  // Create a calendar event from a confirmed schedule
  async createEventFromSchedule(
    userId: number,
    eventData: {
      title: string
      description?: string
      startTime: string
      endTime: string
      attendeeEmails: string[]
      location?: string
    },
    googleOAuth?: GoogleOAuth
  ): Promise<{ success: boolean; eventId?: string; calendarUrl?: string; error?: string }> {
    try {
      const calendarAPI = await this.getCalendarAPIForUser(userId, googleOAuth)
      if (!calendarAPI) {
        return { success: false, error: 'Calendar API not available for user' }
      }

      const calendarEvent = await calendarAPI.createEvent('primary', {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime,
          timeZone: 'Asia/Tokyo',
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: 'Asia/Tokyo',
        },
        attendees: eventData.attendeeEmails.map(email => ({ email })),
        location: eventData.location,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      })

      if (!calendarEvent) {
        return { success: false, error: 'Failed to create calendar event' }
      }

      return {
        success: true,
        eventId: calendarEvent.id,
        calendarUrl: `https://calendar.google.com/calendar/event?eid=${btoa(calendarEvent.id || '')}`,
      }
    } catch (error) {
      console.error('Create event from schedule error:', error)
      return { success: false, error: 'Internal error creating calendar event' }
    }
  }

  // Get user's upcoming events
  async getUserUpcomingEvents(userId: number, daysAhead: number = 30): Promise<GoogleCalendarEvent[] | null> {
    try {
      const calendarAPI = await this.getCalendarAPIForUser(userId)
      if (!calendarAPI) {
        return null
      }

      const now = new Date()
      const future = new Date()
      future.setDate(future.getDate() + daysAhead)

      return await calendarAPI.getEvents('primary', {
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        maxResults: 50,
        orderBy: 'startTime',
      })
    } catch (error) {
      console.error('Get user upcoming events error:', error)
      return null
    }
  }

  // Check for scheduling conflicts
  async checkSchedulingConflicts(
    userIds: number[],
    startTime: string,
    endTime: string
  ): Promise<{
    [userId: number]: {
      hasConflict: boolean
      conflicts: GoogleCalendarEvent[]
    }
  }> {
    const result: { [userId: number]: { hasConflict: boolean; conflicts: GoogleCalendarEvent[] } } = {}

    for (const userId of userIds) {
      try {
        const calendarAPI = await this.getCalendarAPIForUser(userId)
        if (!calendarAPI) {
          result[userId] = { hasConflict: false, conflicts: [] }
          continue
        }

        const conflicts = await calendarAPI.checkConflicts('primary', startTime, endTime)
        result[userId] = {
          hasConflict: conflicts ? conflicts.length > 0 : false,
          conflicts: conflicts || [],
        }
      } catch (error) {
        console.error(`Check conflicts for user ${userId}:`, error)
        result[userId] = { hasConflict: false, conflicts: [] }
      }
    }

    return result
  }
}