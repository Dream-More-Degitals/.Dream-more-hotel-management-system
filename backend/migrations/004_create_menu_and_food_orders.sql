CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  description TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(30) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  reservation_id INTEGER REFERENCES reservations(id),
  room_number VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','preparing','delivered','cancelled')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_order_items (
  id SERIAL PRIMARY KEY,
  food_order_id INTEGER NOT NULL REFERENCES food_orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL
);
