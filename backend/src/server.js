require('dotenv').config();
const express = require('express');
const pool = require('./config/db');

const authRoutes = require('./modules/auth/auth.routes');
const roomsRoutes = require('./modules/rooms/rooms.routes');
const reservationsRoutes = require('./modules/reservations/reservations.routes');
const menuRoutes = require('./modules/menu/menu.routes');
const foodOrdersRoutes = require('./modules/foodOrders/foodOrders.routes');
const invoicesRoutes = require('./modules/invoices/invoices.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/food-orders', foodOrdersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
