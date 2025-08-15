-- Insert test users
INSERT OR IGNORE INTO users (google_id, email, name, picture) VALUES 
  ('google_test_1', 'kohira@example.com', '小平勘太', 'https://via.placeholder.com/150'),
  ('google_test_2', 'tanaka@example.com', '田中太郎', 'https://via.placeholder.com/150'),
  ('google_test_3', 'sato@example.com', '佐藤花子', 'https://via.placeholder.com/150');

-- Insert test events
INSERT OR IGNORE INTO events (title, description, duration_minutes, created_by, status, deadline) VALUES 
  ('プロジェクト会議', '新規プロジェクトのキックオフ会議', 90, 1, 'open', '2025-08-20 23:59:59'),
  ('チーム懇親会', '月次チーム懇親会の開催', 120, 1, 'draft', '2025-08-25 23:59:59'),
  ('システム設計レビュー', 'システム設計の最終レビュー', 60, 2, 'open', '2025-08-22 23:59:59');

-- Insert event participants
INSERT OR IGNORE INTO event_participants (event_id, user_id, status) VALUES 
  (1, 1, 'responded'), (1, 2, 'responded'), (1, 3, 'invited'),
  (2, 1, 'responded'), (2, 2, 'invited'), (2, 3, 'invited'),
  (3, 1, 'responded'), (3, 2, 'responded');

-- Insert time slots for events
INSERT OR IGNORE INTO time_slots (event_id, start_datetime, end_datetime, created_by) VALUES 
  (1, '2025-08-20 10:00:00', '2025-08-20 11:30:00', 1),
  (1, '2025-08-20 14:00:00', '2025-08-20 15:30:00', 1),
  (1, '2025-08-21 09:00:00', '2025-08-21 10:30:00', 1),
  (2, '2025-08-25 18:00:00', '2025-08-25 20:00:00', 1),
  (2, '2025-08-26 18:30:00', '2025-08-26 20:30:00', 1),
  (3, '2025-08-22 13:00:00', '2025-08-22 14:00:00', 2),
  (3, '2025-08-22 15:00:00', '2025-08-22 16:00:00', 2);

-- Insert availability responses
INSERT OR IGNORE INTO availability_responses (time_slot_id, user_id, status) VALUES 
  (1, 1, 'available'), (1, 2, 'available'),
  (2, 1, 'maybe'), (2, 2, 'unavailable'),
  (3, 1, 'available'), (3, 2, 'available'),
  (4, 1, 'available'), (4, 2, 'maybe'),
  (5, 1, 'unavailable'), (5, 2, 'available'),
  (6, 1, 'available'), (6, 2, 'available'),
  (7, 1, 'maybe'), (7, 2, 'available');