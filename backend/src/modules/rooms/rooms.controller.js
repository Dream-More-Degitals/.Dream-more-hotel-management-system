const {
  listRooms,
  getRoomById,
  createRoom,
  updateRoom,
  changeRoomStatus,
  archiveRoom,
} = require('./rooms.service');

async function getRooms(req, res) {
  try {
    const { status, type, search } = req.query;
    const rooms = await listRooms({ status, type, search });
    res.json(rooms);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function getRoom(req, res) {
  try {
    const room = await getRoomById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function postRoom(req, res) {
  try {
    const { room_number, room_type, base_price, guests_capacity, status } = req.body;
    if (!room_number || !room_type || base_price === undefined) {
      return res.status(400).json({ message: 'room_number, room_type, and base_price are required' });
    }
    const room = await createRoom({ room_number, room_type, base_price, guests_capacity, status });
    res.status(201).json(room);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function putRoom(req, res) {
  try {
    const room = await updateRoom(req.params.id, req.body);
    res.json(room);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function patchRoomStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });
    const room = await changeRoomStatus(req.params.id, status);
    res.json(room);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

async function deleteRoom(req, res) {
  try {
    const room = await archiveRoom(req.params.id);
    res.json({ message: 'Room archived', room });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

module.exports = { getRooms, getRoom, postRoom, putRoom, patchRoomStatus, deleteRoom };
