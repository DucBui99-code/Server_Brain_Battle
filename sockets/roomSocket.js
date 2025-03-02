const {
  ROOM_MEMBERS,
  MAX_LENGTH_NAME,
  MIN_LENGTH_NAME,
  MIN_TOPIC_SELECT,
} = require("../config/constant");
const Question = require("../models/questions");
const User = require("../models/users");
const otpGenerator = require("otp-generator");
const { ObjectId } = require("mongodb");

module.exports = (io) => {
  const rooms = [];

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("createRoom", async (data) => {
      try {
        const { userId, name } = JSON.parse(data);

        if (!userId || !name || name.trim() === "") {
          emitError(socket, "error", "Vui lòng nhập đủ thông tin");
          return;
        }
        if (name.length < MIN_LENGTH_NAME || name.length > MAX_LENGTH_NAME) {
          emitError(socket, "error", "Tên phòng từ 6-20 ký tự");
          return;
        }

        const existingRoom = rooms.find((room) => room.roomInfo.name === name);
        if (existingRoom) {
          emitError(socket, "error", "Phòng đã tồn tại");
          return;
        }

        const userExists = await User.findById(userId);

        if (!userExists) {
          return emitError(socket, "error", "Người dùng không tồn tại");
        }

        const roomId = otpGenerator.generate(6, {
          upperCaseAlphabets: false,
          specialChars: false,
          lowerCaseAlphabets: false,
        });

        const newRoom = {
          roomInfo: {
            id: roomId,
            name,
            owner: userId,
            status: "waiting",
            questions: [],
            turnIndex: 0,
            currentPlayer: null,
          },
          users: [
            {
              id: userExists._id,
              name: userExists.name,
              avatar: userExists.avatar,
            },
          ],
        };

        rooms.push(newRoom);

        socket.join(roomId);
        io.to(roomId).emit("roomInfo", JSON.stringify(newRoom));
      } catch {
        socket.emit("error", { message: "Error creating room" });
      }
    });

    socket.on("getRoomInfo", (data) => {
      try {
        const { roomName, userId } = JSON.parse(data);
        if (
          !roomName ||
          !userId ||
          roomName.trim() === "" ||
          userId.trim() === ""
        ) {
          emitError(socket, "error", "Vui lòng nhập đủ thông tin");
          return;
        }

        const room = rooms.find((room) => room.roomInfo.name === roomName);
        if (!room) {
          emitError(socket, "error", "Phòng không tồn tại");
          return;
        }

        const userExists = room.users.some(
          (user) => user.id.toString() === userId
        );
        if (!userExists) {
          emitError(socket, "error", "Người dùng không ở trong phòng");
          return;
        }

        socket.emit("roomInfo", JSON.stringify(room));
      } catch {
        emitError(socket, "error", "Error getting room info");
      }
    });

    socket.on("joinRoom", async (data) => {
      try {
        const { roomName, userId } = JSON.parse(data);

        if (!roomName || !userId || roomName.trim() === "") {
          emitError(socket, "error", "Vui lòng nhập đủ thông tin");
          return;
        }

        const room = rooms.find((room) => room.roomInfo.name === roomName);

        if (
          !room ||
          room.roomInfo.status !== "waiting" ||
          room.users.length >= ROOM_MEMBERS
        ) {
          emitError(socket, "error", "Phòng không tồn tại hoặc đã đầy");
          return;
        }

        const userExists = await User.findById(userId);

        if (!userExists) {
          emitError(socket, "error", "Người dùng không tồn tại");
          return;
        }

        const isUserInRoom = room.users.some(
          (user) => user.id.toString() === userId
        );
        if (isUserInRoom) {
          emitError(socket, "error", "Người dùng đã ở trong phòng");
          return;
        }

        room.users.push({
          id: userExists._id,
          name: userExists.name,
          avatar: userExists.avatar,
        });

        if (room.users.length === ROOM_MEMBERS) room.roomInfo.status = "ready";

        socket.join(room.roomInfo.id);
        io.to(room.roomInfo.id).emit("roomInfo", JSON.stringify(room));
      } catch {
        emitError(socket, "error", "Error joining room");
      }
    });

    socket.on("startGame", async (data) => {
      try {
        const { roomName, userId, topicsIds } = JSON.parse(data);
        console.log(roomName, userId, topicsIds);

        if (!roomName || !userId || roomName.trim() === "") {
          emitError(socket, "error", "Vui lòng nhập đủ thông tin");
          return;
        }

        if (!topicsIds || topicsIds.length < MIN_TOPIC_SELECT) {
          emitError(socket, "error", `Chọn ít nhất ${MIN_TOPIC_SELECT} chủ đề`);
          return;
        }

        const room = rooms.find((room) => room.roomInfo.name === roomName);

        if (!room) {
          emitError(socket, "error", "Phòng không tồn tại");
          return;
        }
        if (room.roomInfo.owner.toString() !== userId) {
          emitError(socket, "error", "Bạn không phải chủ phòng");
          return;
        }
        if (room.users.length < ROOM_MEMBERS) {
          emitError(
            socket,
            "error",
            `Cần ít nhất ${ROOM_MEMBERS} người chơi để bắt đầu`
          );
          return;
        }
        // Chuyển đổi topicsIds từ string sang ObjectId
        const topicsIdsObject = topicsIds.map((id) => new ObjectId(id));
        const questions = await Question.aggregate([
          { $match: { topicId: { $in: topicsIdsObject } } },
          { $sample: { size: 10 } },
          { $project: { answer: 0 } },
        ]);
        room.roomInfo.questions = questions;
        room.roomInfo.currentPlayer = room.users[0].id;
        room.roomInfo.status = "started";
        room.roomInfo.turnIndex = 0;

        io.to(room.roomInfo.id).emit("gameStarted", JSON.stringify(room));

        // startTurn(io, room.roomInfo);
      } catch {
        emitError(socket, "error", "Error starting game");
      }
    });

    socket.on("leaveRoom", (data) => {
      try {
        const { roomName, userId } = JSON.parse(data);
        if (!roomName || !userId || roomName.trim() === "") {
          emitError(socket, "error", "Vui lòng nhập đủ thông tin");
          return;
        }

        const room = rooms.find((room) => room.roomInfo.name === roomName);
        if (!room) {
          emitError(socket, "error", "Phòng không tồn tại");
          return;
        }

        const userIndex = room.users.findIndex(
          (user) => user.id.toString() === userId
        );
        if (userIndex === -1) {
          emitError(socket, "error", "Người dùng không ở trong phòng");
          return;
        }

        // If the user leaving is the owner, delete the room
        if (room.roomInfo.owner.toString() === userId) {
          rooms.splice(rooms.indexOf(room), 1);
          io.to(room.roomInfo.id).emit(
            "roomDeleted",
            JSON.stringify({ roomId: room.roomInfo.id })
          );
          socket.leave(room.roomInfo.id);
          return;
        }

        room.users.splice(userIndex, 1);
        if (
          room.roomInfo.status === "started" &&
          room.users.length < ROOM_MEMBERS
        ) {
          room.roomInfo.status = "waiting";
        }

        socket.leave(room.roomInfo.id);
        io.to(room.roomInfo.id).emit("roomInfo", JSON.stringify(room));
      } catch {
        emitError(socket, "error", "Error leaving room");
      }
    });

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

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

function startTurn(io, room) {
  io.to(room.id).emit("newTurn", {
    player: room.currentPlayer,
    question: room.questions[0],
    timeLeft: 10,
  });

  let time = 10;
  const interval = setInterval(() => {
    time -= 1;
    io.to(room.id).emit("updateTimer", { timeLeft: time });

    if (time === 0) {
      clearInterval(interval);

      room.questions.shift();
      room.turnIndex = (room.turnIndex + 1) % room.users.length;
      room.currentPlayer = room.users[room.turnIndex];

      io.to(room.id).emit("updateRoom", { room });
      startTurn(io, room);
    }
  }, 1000);
}
function emitError(socket, event, message) {
  socket.emit(event, JSON.stringify({ message }));
}
