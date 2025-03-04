const rooms = [];

module.exports = {
  findRoom: (roomName) => rooms.find((room) => room.roomInfo.name === roomName),
  addRoom: (room) => {
    if (!rooms.find((r) => r.roomInfo.name === room.roomInfo.name)) {
      rooms.push(room);
      return true;
    }
    return false;
  },
  removeRoom: (roomName) => {
    const index = rooms.findIndex((room) => room.roomInfo.name === roomName);
    if (index !== -1) {
      rooms.splice(index, 1);
      return true;
    }
    return false;
  },
  updateRoom: (roomName, newRoomInfo) => {
    const index = rooms.findIndex((room) => room.roomInfo.name === roomName);
    if (index !== -1) {
      rooms[index] = newRoomInfo;
      return true;
    }
    return false;
  },
};
