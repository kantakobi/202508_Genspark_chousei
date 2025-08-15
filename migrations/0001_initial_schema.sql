-- Users table (Google OAuth user information)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  access_token TEXT,
  refresh_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Events table (scheduling events created by users)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_by INTEGER NOT NULL,
  status TEXT CHECK(status IN ('draft', 'open', 'confirmed', 'cancelled')) DEFAULT 'draft',
  deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Event participants table (users invited to events)
CREATE TABLE IF NOT EXISTS event_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('invited', 'responded', 'declined')) DEFAULT 'invited',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(event_id, user_id)
);

-- Time slots table (proposed time slots for events)
CREATE TABLE IF NOT EXISTS time_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Availability responses table (user responses to time slots)
CREATE TABLE IF NOT EXISTS availability_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_slot_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('available', 'maybe', 'unavailable')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(time_slot_id, user_id)
);

-- Confirmed events table (finalized schedule entries)
CREATE TABLE IF NOT EXISTS confirmed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  time_slot_id INTEGER NOT NULL,
  google_event_id TEXT,
  calendar_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id),
  UNIQUE(event_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_event_id ON time_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_availability_responses_time_slot_id ON availability_responses(time_slot_id);
CREATE INDEX IF NOT EXISTS idx_availability_responses_user_id ON availability_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_events_event_id ON confirmed_events(event_id);