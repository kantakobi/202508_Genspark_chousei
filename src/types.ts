// Database types
export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture?: string;
  access_token?: string;
  refresh_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  duration_minutes: number;
  created_by: number;
  status: 'draft' | 'open' | 'confirmed' | 'cancelled';
  deadline?: string;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: number;
  status: 'invited' | 'responded' | 'declined';
  created_at: string;
}

export interface TimeSlot {
  id: number;
  event_id: number;
  start_datetime: string;
  end_datetime: string;
  created_by: number;
  created_at: string;
}

export interface AvailabilityResponse {
  id: number;
  time_slot_id: number;
  user_id: number;
  status: 'available' | 'maybe' | 'unavailable';
  created_at: string;
  updated_at: string;
}

export interface ConfirmedEvent {
  id: number;
  event_id: number;
  time_slot_id: number;
  google_event_id?: string;
  calendar_id?: string;
  created_at: string;
}

// API Request/Response types
export interface CreateEventRequest {
  title: string;
  description?: string;
  duration_minutes?: number;
  participants: string[]; // email addresses
  time_slots: {
    start_datetime: string;
    end_datetime: string;
  }[];
  deadline?: string;
}

export interface AvailabilityRequest {
  responses: {
    time_slot_id: number;
    status: 'available' | 'maybe' | 'unavailable';
  }[];
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: {
    email: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }[];
}

// Cloudflare bindings
export interface Bindings {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
}

// Session data
export interface SessionData {
  user_id: number;
  google_id: string;
  email: string;
  name: string;
}