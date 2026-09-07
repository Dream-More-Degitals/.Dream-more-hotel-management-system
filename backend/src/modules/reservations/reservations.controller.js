const {
  createReservation,
  getReservationById,
  listReservations,
  modifyReservation,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
} = require('./reservations.service');

async function postReservation(req, res) {
  try {
    const { room_id, check_in_date, check_out_date, customer_id } = req.body;
    if (!room_id || !check_in_date || !check_out_date) {
      return res.status(400).json({ message: 'room_id, check_in_date, and check_out_date are required' });
    }
    // Customers book for themselves; staff can book on behalf of a customer_id
    const finalCustomerId = req.user.role === 'customer' ? req.user.id : (customer_id || req.user.id);

    const reservation = await createReservation({
      customer_id: finalCustomerId,
      room_id,
      check_in_date,
      check_out_date,
      created_by: req.user.id,
    });
    res.status(201).json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getReservations(req, res) {
  try {
    const { status } = req.query;
    const reservations = await listReservations({ user: req.user, status });
    res.json(reservations);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getReservation(req, res) {
  try {
    const reservation = await getReservationById(req.params.id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    if (req.user.role === 'customer' && reservation.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function putReservation(req, res) {
  try {
    const { check_in_date, check_out_date, room_id } = req.body;
    const reservation = await modifyReservation(req.params.id, { check_in_date, check_out_date, room_id });
    res.json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postCancel(req, res) {
  try {
    const reservation = await cancelReservation(req.params.id);
    res.json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postCheckIn(req, res) {
  try {
    const reservation = await checkInReservation(req.params.id);
    res.json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postCheckOut(req, res) {
  try {
    const reservation = await checkOutReservation(req.params.id);
    res.json(reservation);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = {
  postReservation,
  getReservations,
  getReservation,
  putReservation,
  postCancel,
  postCheckIn,
  postCheckOut,
};
