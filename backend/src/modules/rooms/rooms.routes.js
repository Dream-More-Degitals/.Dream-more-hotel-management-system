const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const {
  getRooms,
  getRoom,
  postRoom,
  putRoom,
  patchRoomStatus,
  deleteRoom,
} = require('./rooms.controller');

// Anyone logged in can view rooms (guests searching, staff managing)
router.get('/', requireAuth, getRooms);
router.get('/:id', requireAuth, getRoom);

// Only admins can create/update/delete rooms
router.post('/', requireAuth, requireRole('admin'), postRoom);
router.put('/:id', requireAuth, requireRole('admin'), putRoom);
router.delete('/:id', requireAuth, requireRole('admin'), deleteRoom);

// Staff (admin, manager, receptionist) can change status (housekeeping/maintenance)
router.patch('/:id/status', requireAuth, requireRole('admin', 'manager', 'receptionist'), patchRoomStatus);

module.exports = router;
