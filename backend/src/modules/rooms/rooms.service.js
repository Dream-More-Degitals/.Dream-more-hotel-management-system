const pool = require('../../config/db');

const VALID_STATUSES = ['available', 'occupied', 'reserved', 'maintenance', 'cleaning'];

// Allowed manual/automatic transitions (SRS 4.1.2)
const ALLOWED_TRANSITIONS = {
  available: ['maintenance', 'reserved'],
  reserved: ['occupied', 'available'],
  occupied: ['cleaning'],
  cleaning: ['available'],
  maintenance: ['available'],
};

async function listRooms({ status, type, search } = {}) {
  const conditions = ['is_archived = false'];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (type) {
    values.push(type);
    conditions.push(`room_type = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(room_type) LIKE $${values.length} OR LOWER(room_number) LIKE $${values.length})`);
  }

  const query = `SELECT * FROM rooms WHERE ${conditions.join(' AND ')} ORDER BY room_number`;
  const result = await pool.query(query, values);
  return result.rows;
}

async function getRoomById(id) {
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1 AND is_archived = false', [id]);
  return result.rows[0];
}

async function createRoom({ room_number, room_type, base_price, guests_capacity, status }) {
  const existing = await pool.query('SELECT id FROM rooms WHERE room_number = $1', [room_number]);
  if (existing.rows.length > 0) {
    const err = new Error('Duplicate Room Identifier');
    err.status = 409;
    throw err;
  }
  if (!(base_price > 0)) {
    const err = new Error('Room price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO rooms (room_number, room_type, base_price, guests_capacity, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [room_number, room_type, base_price, guests_capacity || 2, status || 'available']
  );
  return result.rows[0];
}

async function updateRoom(id, updates) {
  const room = await getRoomById(id);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  if (updates.base_price !== undefined && !(updates.base_price > 0)) {
    const err = new Error('Room price must be a positive number greater than zero');
    err.status = 400;
    throw err;
  }

  const fields = ['room_type', 'base_price', 'guests_capacity'];
  const setClauses = [];
  const values = [];

  fields.forEach((field) => {
    if (updates[field] !== undefined) {
      values.push(updates[field]);
      setClauses.push(`${field} = $${values.length}`);
    }
  });

  if (setClauses.length === 0) return room;

  values.push(id);
  const query = `UPDATE rooms SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function changeRoomStatus(id, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    const err = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const room = await getRoomById(id);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }

  const allowed = ALLOWED_TRANSITIONS[room.status] || [];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition room from '${room.status}' to '${newStatus}'`);
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    'UPDATE rooms SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [newStatus, id]
  );
  return result.rows[0];
}

async function archiveRoom(id) {
  const room = await getRoomById(id);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  if (['occupied', 'reserved'].includes(room.status)) {
    const err = new Error('Cannot delete a room that is Occupied or Reserved');
    err.status = 409;
    throw err;
  }

  const result = await pool.query(
    'UPDATE rooms SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

module.exports = { listRooms, getRoomById, createRoom, updateRoom, changeRoomStatus, archiveRoom };
