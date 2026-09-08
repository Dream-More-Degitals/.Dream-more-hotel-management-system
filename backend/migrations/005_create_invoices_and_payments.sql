CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(30) UNIQUE NOT NULL,
  reservation_id INTEGER REFERENCES reservations(id),
  customer_id INTEGER NOT NULL REFERENCES users(id),
  room_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  food_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','partially_paid','paid')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(40) UNIQUE NOT NULL,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(20) NOT NULL CHECK (method IN ('cash','card','mobile_money','bank_transfer')),
  chapa_tx_ref VARCHAR(100) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'success'
    CHECK (status IN ('pending','success','failed')),
  staff_id INTEGER REFERENCES users(id),
  paid_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
