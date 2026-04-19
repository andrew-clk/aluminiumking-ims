-- Authentication Schema
-- Users table with role-based access control

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin', 'purchaser', 'stock_keeper', 'production')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Sessions table for session management
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Insert default super admin user (password: admin123)
INSERT INTO users (username, password_hash, full_name, role, status)
VALUES (
  'admin',
  '$2b$10$N9qo8uL8okPo8xqKjJqI5eO9kKJXzJKJxKZJXzJKJxKZJXzJKJxKZ',
  'System Administrator',
  'super_admin',
  'active'
) ON CONFLICT (username) DO NOTHING;
