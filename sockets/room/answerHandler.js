module.exports = (io, socket) => {
  socket.on("answer", ({ roomId, userId, answer }) => {
    const room = rooms[roomId];
    if (!room || room.currentPlayer !== userId) return;

    const question = room.questions.shift();
    const isCorrect = answer === "Đáp án đúng"; // Giả định kiểm tra

    room.turnIndex = (room.turnIndex + 1) % room.users.length;
    room.currentPlayer = room.users[room.turnIndex];

    io.to(roomId).emit("updateRoom", { room, isCorrect });
    startTurn(io, room);
  });
};
