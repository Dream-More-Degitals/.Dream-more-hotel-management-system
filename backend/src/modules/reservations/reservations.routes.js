const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const {
  postReservation,
  getReservations,
  getReservation,
  putReservation,
  postCancel,
  postCheckIn,
  postCheckOut,
} = require('./reservations.controller');

router.post('/', requireAuth, postReservation);
router.get('/', requireAuth, getReservations);
router.get('/:id', requireAuth, getReservation);
router.put('/:id', requireAuth, putReservation);
router.post('/:id/cancel', requireAuth, postCancel);
router.post('/:id/check-in', requireAuth, requireRole('admin', 'manager', 'receptionist'), postCheckIn);
router.post('/:id/check-out', requireAuth, requireRole('admin', 'manager', 'receptionist'), postCheckOut);

module.exports = router;
