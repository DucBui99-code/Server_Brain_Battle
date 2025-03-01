const { ROOM_MEMBERS } = require("../config/constant");
const Question = require("../models/questions");
const Room = require("../models/room");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Tham gia phòng
    socket.on("joinRoom", async ({ roomId, userId }) => {
      try {
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit("roomNotExits", { message: "Không tồn tại phòng" });
          return;
        }
        if (!room || room.users.length >= ROOM_MEMBERS) {
          socket.emit("roomFull", { message: "Phòng đã đầy" });
          return;
        }

        room.users.push(userId);
        if (room.users.length === ROOM_MEMBERS) room.status = "started";
        await room.save({ validateModifiedOnly: true });

        socket.join(roomId);
        io.to(roomId).emit("roomUpdated", room);
      } catch (err) {
        socket.emit("error", { message: "Error joining room" });
      }
    });

    socket.on("startGame", async ({ roomId, userId }) => {
      const room = await Room.findById(roomId).populate("users");

      if (!room) return;
      if (room.owner.toString() !== userId) return;
      if (room.users.length < 5) return;

      // 🔥 Lấy ngẫu nhiên 30 câu hỏi
      const questions = await Question.aggregate([{ $sample: { size: 30 } }]);
      room.questions = questions.map((q) => q._id);
      room.currentPlayer = room.users[0]._id; // Chọn người đầu tiên
      room.status = "started";
      room.turnIndex = 0;

      await room.save({ validateModifiedOnly: true });

      // 🔥 Phát sự kiện "gameStarted" đến toàn bộ phòng
      io.to(roomId).emit("gameStarted", room);

      // 🔥 Bắt đầu lượt chơi đầu tiên
      startTurn(io, room);
    });

    // Rời phòng
    socket.on("leaveRoom", async ({ roomId, userId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return;

        room.users = room.users.filter((user) => user.toString() !== userId);
        if (room.status === "started" && room.users.length < ROOM_MEMBERS)
          room.status = "waiting";
        await room.save({ validateModifiedOnly: true });

        socket.leave(roomId);
        io.to(roomId).emit("roomUpdated", room);
      } catch (err) {
        socket.emit("error", { message: "Error leaving room" });
      }
    });

    // 🟢 Xử lý khi người chơi trả lời
    socket.on("answer", async ({ roomId, userId, answer }) => {
      const room = await Room.findById(roomId)
        .populate("users")
        .populate("questions");

      if (!room || room.currentPlayer.toString() !== userId) return;

      const question = room.questions[0];
      const isCorrect = question.answers.some(
        (a) => a.text === answer && a.isCorrect
      );

      // Xóa câu hỏi đã trả lời
      room.questions.shift();
      room.turnIndex = (room.turnIndex + 1) % room.users.length;
      room.currentPlayer = room.users[room.turnIndex]._id;

      await room.save();
      io.to(roomId).emit("updateRoom", { room, isCorrect });

      // Bắt đầu lượt chơi tiếp theo
      startTurn(io, room);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

// 🕒 Hàm bắt đầu lượt chơi với thời gian 10 giây
async function startTurn(io, room) {
  io.to(room._id.toString()).emit("newTurn", {
    player: room.currentPlayer,
    question: room.questions[0],
    timeLeft: 10,
  });

  let time = 10;
  const interval = setInterval(async () => {
    time -= 1;
    io.to(room._id.toString()).emit("updateTimer", { timeLeft: time });

    if (time === 0) {
      clearInterval(interval);

      room.questions.shift();
      room.turnIndex = (room.turnIndex + 1) % room.users.length;
      room.currentPlayer = room.users[room.turnIndex]._id;

      await room.save();
      io.to(room._id.toString()).emit("updateRoom", { room });
      startTurn(io, room);
    }
  }, 1000);
}
