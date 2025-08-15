import type { 
  Event, 
  TimeSlot, 
  AvailabilityResponse, 
  EventParticipant, 
  User,
  CreateEventRequest 
} from '../types'
import { UserService } from './auth'
import { CalendarService } from './calendar'

export class ScheduleService {
  private db: D1Database
  private userService: UserService
  private calendarService: CalendarService

  constructor(db: D1Database) {
    this.db = db
    this.userService = new UserService(db)
    this.calendarService = new CalendarService(db)
  }

  // Create a new scheduling event
  async createEvent(creatorId: number, eventData: CreateEventRequest): Promise<{
    success: boolean
    event?: any
    error?: string
  }> {
    try {
      // Insert event
      const eventResult = await this.db
        .prepare(`
          INSERT INTO events (title, description, duration_minutes, created_by, status, deadline, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
        `)
        .bind(
          eventData.title,
          eventData.description || null,
          eventData.duration_minutes || 60,
          creatorId,
          eventData.deadline || null
        )
        .run()

      if (!eventResult.success || !eventResult.meta.last_row_id) {
        return { success: false, error: 'Failed to create event' }
      }

      const eventId = eventResult.meta.last_row_id

      // Add participants
      if (eventData.participants && eventData.participants.length > 0) {
        for (const email of eventData.participants) {
          // Find or create participant user
          let user = await this.userService.findByEmail(email)
          if (!user) {
            // Create placeholder user for invited participant
            user = await this.userService.createUser({
              google_id: `placeholder_${email}_${Date.now()}`,
              email,
              name: email.split('@')[0], // Use email prefix as name
            })
          }

          if (user) {
            await this.db
              .prepare(`
                INSERT INTO event_participants (event_id, user_id, status, created_at)
                VALUES (?, ?, 'invited', datetime('now'))
              `)
              .bind(eventId, user.id)
              .run()
          }
        }
      }

      // Add time slots
      if (eventData.time_slots && eventData.time_slots.length > 0) {
        for (const slot of eventData.time_slots) {
          await this.db
            .prepare(`
              INSERT INTO time_slots (event_id, start_datetime, end_datetime, created_by, created_at)
              VALUES (?, ?, ?, ?, datetime('now'))
            `)
            .bind(
              eventId,
              slot.start_datetime,
              slot.end_datetime,
              creatorId
            )
            .run()
        }
      }

      // Fetch the created event
      const event = await this.getEventById(eventId as number, creatorId)
      
      return { success: true, event }
    } catch (error) {
      console.error('Create event error:', error)
      return { success: false, error: 'Internal error creating event' }
    }
  }

  // Get event by ID with participants and time slots
  async getEventById(eventId: number, requesterId: number): Promise<any | null> {
    try {
      // Get event
      const event = await this.db
        .prepare('SELECT * FROM events WHERE id = ?')
        .bind(eventId)
        .first()

      if (!event) {
        return null
      }

      // Check if requester has access (creator or participant)
      const hasAccess = await this.checkEventAccess(eventId, requesterId)
      if (!hasAccess) {
        return null
      }

      // Get participants
      const participants = await this.db
        .prepare(`
          SELECT u.*, ep.status as participation_status
          FROM users u
          JOIN event_participants ep ON u.id = ep.user_id
          WHERE ep.event_id = ?
        `)
        .bind(eventId)
        .all()

      // Get time slots with responses
      const timeSlots = await this.db
        .prepare(`
          SELECT ts.*, 
            GROUP_CONCAT(ar.user_id || ':' || ar.status) as responses
          FROM time_slots ts
          LEFT JOIN availability_responses ar ON ts.id = ar.time_slot_id
          WHERE ts.event_id = ?
          GROUP BY ts.id
          ORDER BY ts.start_datetime
        `)
        .bind(eventId)
        .all()

      // Parse responses
      const timeSlotsWithResponses = timeSlots.results?.map((slot: any) => ({
        ...slot,
        responses: slot.responses 
          ? slot.responses.split(',').map((r: string) => {
              const [user_id, status] = r.split(':')
              return { user_id: parseInt(user_id), status }
            })
          : []
      })) || []

      return {
        ...event,
        participants: participants.results || [],
        time_slots: timeSlotsWithResponses
      }
    } catch (error) {
      console.error('Get event by ID error:', error)
      return null
    }
  }

  // Get events for a user
  async getUserEvents(userId: number, options: {
    status?: string
    limit?: number
    offset?: number
  } = {}): Promise<any[]> {
    try {
      let query = `
        SELECT DISTINCT e.*, u.name as creator_name
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_participants ep ON e.id = ep.event_id
        WHERE e.created_by = ? OR ep.user_id = ?
      `

      const params = [userId, userId]

      if (options.status) {
        query += ' AND e.status = ?'
        params.push(options.status)
      }

      query += ' ORDER BY e.created_at DESC'

      if (options.limit) {
        query += ' LIMIT ?'
        params.push(options.limit.toString())
        
        if (options.offset) {
          query += ' OFFSET ?'
          params.push(options.offset.toString())
        }
      }

      const result = await this.db
        .prepare(query)
        .bind(...params)
        .all()

      return result.results || []
    } catch (error) {
      console.error('Get user events error:', error)
      return []
    }
  }

  // Submit availability responses
  async submitAvailabilityResponses(
    userId: number,
    eventId: number,
    responses: Array<{
      time_slot_id: number
      status: 'available' | 'maybe' | 'unavailable'
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user has access to this event
      const hasAccess = await this.checkEventAccess(eventId, userId)
      if (!hasAccess) {
        return { success: false, error: 'Access denied' }
      }

      // Delete existing responses for this user and event
      await this.db
        .prepare(`
          DELETE FROM availability_responses 
          WHERE user_id = ? AND time_slot_id IN (
            SELECT id FROM time_slots WHERE event_id = ?
          )
        `)
        .bind(userId, eventId)
        .run()

      // Insert new responses
      for (const response of responses) {
        await this.db
          .prepare(`
            INSERT INTO availability_responses (time_slot_id, user_id, status, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `)
          .bind(response.time_slot_id, userId, response.status)
          .run()
      }

      // Update participant status to 'responded'
      await this.db
        .prepare(`
          UPDATE event_participants 
          SET status = 'responded'
          WHERE event_id = ? AND user_id = ?
        `)
        .bind(eventId, userId)
        .run()

      return { success: true }
    } catch (error) {
      console.error('Submit availability responses error:', error)
      return { success: false, error: 'Internal error submitting responses' }
    }
  }

  // Find optimal time slots based on responses
  async findOptimalTimeSlots(eventId: number): Promise<Array<{
    time_slot_id: number
    start_datetime: string
    end_datetime: string
    availability_score: number
    available_count: number
    maybe_count: number
    unavailable_count: number
    total_responses: number
    availability_details: Array<{
      user_id: number
      user_name: string
      status: string
    }>
  }> | null> {
    try {
      const result = await this.db
        .prepare(`
          SELECT 
            ts.id as time_slot_id,
            ts.start_datetime,
            ts.end_datetime,
            COUNT(ar.id) as total_responses,
            SUM(CASE WHEN ar.status = 'available' THEN 1 ELSE 0 END) as available_count,
            SUM(CASE WHEN ar.status = 'maybe' THEN 1 ELSE 0 END) as maybe_count,
            SUM(CASE WHEN ar.status = 'unavailable' THEN 1 ELSE 0 END) as unavailable_count,
            GROUP_CONCAT(u.id || ':' || u.name || ':' || ar.status) as user_responses
          FROM time_slots ts
          LEFT JOIN availability_responses ar ON ts.id = ar.time_slot_id
          LEFT JOIN users u ON ar.user_id = u.id
          WHERE ts.event_id = ?
          GROUP BY ts.id
          ORDER BY available_count DESC, maybe_count DESC
        `)
        .bind(eventId)
        .all()

      if (!result.results) return null

      return result.results.map((slot: any) => {
        const availableCount = slot.available_count || 0
        const maybeCount = slot.maybe_count || 0
        const totalResponses = slot.total_responses || 0
        
        // Calculate availability score (available=1, maybe=0.5, unavailable=0)
        const availabilityScore = totalResponses > 0 
          ? (availableCount + maybeCount * 0.5) / totalResponses 
          : 0

        // Parse user responses
        const availabilityDetails = slot.user_responses
          ? slot.user_responses.split(',').map((r: string) => {
              const [userId, userName, status] = r.split(':')
              return {
                user_id: parseInt(userId),
                user_name: userName,
                status
              }
            })
          : []

        return {
          time_slot_id: slot.time_slot_id,
          start_datetime: slot.start_datetime,
          end_datetime: slot.end_datetime,
          availability_score: Math.round(availabilityScore * 100) / 100,
          available_count: availableCount,
          maybe_count: maybeCount,
          unavailable_count: slot.unavailable_count || 0,
          total_responses: totalResponses,
          availability_details: availabilityDetails
        }
      })
    } catch (error) {
      console.error('Find optimal time slots error:', error)
      return null
    }
  }

  // Confirm event with selected time slot
  async confirmEvent(
    eventId: number,
    timeSlotId: number,
    confirmerId: number,
    options: {
      location?: string
      sendCalendarInvites?: boolean
    } = {}
  ): Promise<{
    success: boolean
    confirmedEvent?: any
    calendarResult?: any
    error?: string
  }> {
    try {
      // Check if user can confirm this event (must be creator)
      const event = await this.db
        .prepare('SELECT * FROM events WHERE id = ? AND created_by = ?')
        .bind(eventId, confirmerId)
        .first()

      if (!event) {
        return { success: false, error: 'Access denied or event not found' }
      }

      // Update event status
      await this.db
        .prepare(`
          UPDATE events 
          SET status = 'confirmed', updated_at = datetime('now')
          WHERE id = ?
        `)
        .bind(eventId)
        .run()

      // Create confirmed event record
      const confirmedResult = await this.db
        .prepare(`
          INSERT INTO confirmed_events (event_id, time_slot_id, created_at)
          VALUES (?, ?, datetime('now'))
        `)
        .bind(eventId, timeSlotId)
        .run()

      if (!confirmedResult.success) {
        return { success: false, error: 'Failed to create confirmed event record' }
      }

      // Get full event details for calendar creation
      const fullEvent = await this.getEventById(eventId, confirmerId)
      if (!fullEvent) {
        return { success: false, error: 'Failed to retrieve event details' }
      }

      const selectedTimeSlot = fullEvent.time_slots.find((ts: any) => ts.id === timeSlotId)
      if (!selectedTimeSlot) {
        return { success: false, error: 'Selected time slot not found' }
      }

      let calendarResult = null

      // Create calendar event if requested
      if (options.sendCalendarInvites) {
        const participantEmails = fullEvent.participants
          .filter((p: any) => p.email && p.participation_status !== 'declined')
          .map((p: any) => p.email)

        calendarResult = await this.calendarService.createEventFromSchedule(
          confirmerId,
          {
            title: fullEvent.title,
            description: fullEvent.description,
            startTime: selectedTimeSlot.start_datetime,
            endTime: selectedTimeSlot.end_datetime,
            attendeeEmails: participantEmails,
            location: options.location
          }
        )

        // Update confirmed event with Google Calendar details
        if (calendarResult.success && calendarResult.eventId) {
          await this.db
            .prepare(`
              UPDATE confirmed_events 
              SET google_event_id = ?, calendar_id = 'primary'
              WHERE event_id = ?
            `)
            .bind(calendarResult.eventId, eventId)
            .run()
        }
      }

      return {
        success: true,
        confirmedEvent: {
          ...fullEvent,
          status: 'confirmed',
          confirmed_time_slot: selectedTimeSlot,
          location: options.location
        },
        calendarResult
      }
    } catch (error) {
      console.error('Confirm event error:', error)
      return { success: false, error: 'Internal error confirming event' }
    }
  }

  // Check if user has access to event
  private async checkEventAccess(eventId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.db
        .prepare(`
          SELECT 1 FROM events e 
          LEFT JOIN event_participants ep ON e.id = ep.event_id
          WHERE e.id = ? AND (e.created_by = ? OR ep.user_id = ?)
          LIMIT 1
        `)
        .bind(eventId, userId, userId)
        .first()

      return !!result
    } catch (error) {
      console.error('Check event access error:', error)
      return false
    }
  }

  // Get event statistics
  async getEventStatistics(eventId: number): Promise<{
    total_participants: number
    responded_participants: number
    response_rate: number
    time_slots_count: number
    most_popular_slot?: any
  } | null> {
    try {
      // Get participant stats
      const participantStats = await this.db
        .prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as responded
          FROM event_participants 
          WHERE event_id = ?
        `)
        .bind(eventId)
        .first()

      // Get time slot count
      const timeSlotCount = await this.db
        .prepare(`
          SELECT COUNT(*) as count FROM time_slots WHERE event_id = ?
        `)
        .bind(eventId)
        .first()

      // Get most popular time slot
      const optimalSlots = await this.findOptimalTimeSlots(eventId)
      const mostPopularSlot = optimalSlots && optimalSlots.length > 0 ? optimalSlots[0] : null

      const total = (participantStats as any)?.total || 0
      const responded = (participantStats as any)?.responded || 0

      return {
        total_participants: total,
        responded_participants: responded,
        response_rate: total > 0 ? Math.round((responded / total) * 100) / 100 : 0,
        time_slots_count: (timeSlotCount as any)?.count || 0,
        most_popular_slot: mostPopularSlot
      }
    } catch (error) {
      console.error('Get event statistics error:', error)
      return null
    }
  }
}