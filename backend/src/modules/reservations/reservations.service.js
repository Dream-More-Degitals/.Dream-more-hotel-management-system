const pool = require('../../config/db');

function formatDateCode(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function randomSuffix() {
  return String(Math.floor(10000 + Math.random() * 90000)); // 5 digits
}

function nightsBetween(checkIn, checkOut) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(checkOut) - new Date(checkIn)) / msPerDay);
}

function validateDates(check_in_date, check_out_date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);

  if (checkIn < today) {
    const err = new Error('Check-in date must be today or later');
    err.status = 400;
    throw err;
  }
  if (checkOut <= checkIn) {
    const err = new Error('Check-out date must be at least 1 day after check-in date');
    err.status = 400;
    throw err;
  }
}

// FR-4.1.4.1 / 4.1.4.2 / 4.1.4.3 — locking + overlap check inside a transaction
async function assertRoomAvailable(client, room_id, check_in_date, check_out_date, excludeReservationId = null) {
  const roomResult = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [room_id]);
  const room = roomResult.rows[0];
  if (!room || room.is_archived) {
    const err = new Error('Room not found');
    err.status = 404;
    throw err;
  }
  if (room.status === 'maintenance') {
    const err = new Error('Room unavailable for the selected dates');
    err.status = 409;
    throw err;
  }

  const params = [room_id, check_out_date, check_in_date];
  let query = `
    SELECT id FROM reservations
    WHERE room_id = $1
      AND status IN ('confirmed', 'checked_in')
      AND check_in_date < $2
      AND check_out_date > $3
  `;
  if (excludeReservationId) {
    params.push(excludeReservationId);
    query += ` AND id != $${params.length}`;
  }

  const overlap = await client.query(query, params);
  if (overlap.rows.length > 0) {
    const err = new Error('Room unavailable for the selected dates');
    err.status = 409;
    throw err;
  }

  return room;
}

async function createReservation({ customer_id, room_id, check_in_date, check_out_date, created_by }) {
  validateDates(check_in_date, check_out_date);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const room = await assertRoomAvailable(client, room_id, check_in_date, check_out_date);

    const nights = nightsBetween(check_in_date, check_out_date);
    const total_cost = Number(room.base_price) * nights;

    let reservation_code;
    let inserted;
    for (let attempt = 0; attempt < 5; attempt++) {
      reservation_code = `RES-${formatDateCode()}-${randomSuffix()}`;
      try {
        const result = await client.query(
          `INSERT INTO reservations
             (reservation_code, customer_id, room_id, check_in_date, check_out_date, status, total_cost, created_by)
           VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7)
           RETURNING *`,
          [reservation_code, customer_id, room_id, check_in_date, check_out_date, total_cost, created_by]
        );
        inserted = result.rows[0];
        break;
      } catch (e) {
        if (e.code === '23505') continue; // unique violation on reservation_code, retry
        throw e;
      }
    }
    if (!inserted) throw new Error('Could not generate a unique reservation code, please retry');

    // Only flip the room to 'reserved' if it's currently 'available' (allowed transition)
    if (room.status === 'available') {
      await client.query(
        `UPDATE rooms SET status = 'reserved', updated_at = NOW() WHERE id = $1`,
        [room_id]
      );
    }

    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getReservationById(id) {
  const result = await pool.query('SELECT * FROM reservations WHERE id = $1', [id]);
  return result.rows[0];
}

async function listReservations({ user, status } = {}) {
  const conditions = [];
  const values = [];

  if (user.role === 'customer') {
    values.push(user.id);
    conditions.push(`customer_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM reservations ${where} ORDER BY check_in_date DESC`,
    values
  );
  return result.rows;
}

function assertModifiableWindow(check_in_date) {
  const hoursUntilCheckIn = (new Date(check_in_date) - new Date()) / (1000 * 60 * 60);
  if (hoursUntilCheckIn < 24) {
    const err = new Error('Reservations can only be modified or cancelled at least 24 hours before check-in');
    err.status = 409;
    throw err;
  }
}

async function modifyReservation(id, { check_in_date, check_out_date, room_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = (await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (current.status !== 'confirmed') {
      const err = new Error(`Cannot modify a reservation with status '${current.status}'`);
      err.status = 409;
      throw err;
    }

    assertModifiableWindow(current.check_in_date);

    const newCheckIn = check_in_date || current.check_in_date;
    const newCheckOut = check_out_date || current.check_out_date;
    const newRoomId = room_id || current.room_id;
    validateDates(newCheckIn, newCheckOut);

    const room = await assertRoomAvailable(client, newRoomId, newCheckIn, newCheckOut, id);
    const nights = nightsBetween(newCheckIn, newCheckOut);
    const total_cost = Number(room.base_price) * nights;

    const updated = await client.query(
      `UPDATE reservations
       SET check_in_date = $1, check_out_date = $2, room_id = $3, total_cost = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newCheckIn, newCheckOut, newRoomId, total_cost, id]
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelReservation(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = (await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (['cancelled', 'checked_out'].includes(current.status)) {
      const err = new Error(`Reservation is already '${current.status}'`);
      err.status = 409;
      throw err;
    }

    const updated = await client.query(
      `UPDATE reservations SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    // Free the room only if it was reserved for this booking (not if already occupied by someone checked in)
    const room = (await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [current.room_id])).rows[0];
    if (room && room.status === 'reserved') {
      await client.query(`UPDATE rooms SET status = 'available', updated_at = NOW() WHERE id = $1`, [room.id]);
    }

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkInReservation(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = (await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (current.status !== 'confirmed') {
      const err = new Error(`Cannot check in a reservation with status '${current.status}'`);
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE reservations SET status = 'checked_in', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    // FR-4.1.2.2 — Reserved -> Occupied automatically on check-in
    await client.query(
      `UPDATE rooms SET status = 'occupied', updated_at = NOW() WHERE id = $1`,
      [current.room_id]
    );

    const updated = await client.query('SELECT * FROM reservations WHERE id = $1', [id]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function checkOutReservation(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = (await client.query('SELECT * FROM reservations WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!current) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }
    if (current.status !== 'checked_in') {
      const err = new Error(`Cannot check out a reservation with status '${current.status}'`);
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE reservations SET status = 'checked_out', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    // FR-4.1.2.3 — Occupied -> Dirty/Cleaning automatically on check-out
    await client.query(
      `UPDATE rooms SET status = 'cleaning', updated_at = NOW() WHERE id = $1`,
      [current.room_id]
    );

    const updated = await client.query('SELECT * FROM reservations WHERE id = $1', [id]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createReservation,
  getReservationById,
  listReservations,
  modifyReservation,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
};
