CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  room_number VARCHAR(20) UNIQUE NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price > 0),
  guests_capacity INTEGER NOT NULL DEFAULT 2,
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','occupied','reserved','maintenance','cleaning')),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
