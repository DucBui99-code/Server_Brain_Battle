const otpGenerator = require("otp-generator");
const { ObjectId } = require("mongodb");

const {
  ROOM_MEMBERS,
  MIN_LENGTH_NAME,
  MAX_LENGTH_NAME,
  MIN_TOPIC_SELECT,
  ROOM_STATUS,
} = require("../../config/constant");
const Question = require("../../models/questions");
const User = require("../../models/users");
const emitError = require("../utils/emitError");
const { findRoom, addRoom, updateRoom, removeRoom } = require("../dataRoom");

module.exports = (io, socket) => {
  socket.on("createRoom", async (data) => {
    try {
      const { userId, name } = data;

      if (!userId || !name || name.trim() === "") {
        emitError(socket, "error", "Vui lòng nhập đủ thông tin");
        return;
      }
      if (name.length < MIN_LENGTH_NAME || name.length > MAX_LENGTH_NAME) {
        emitError(socket, "error", "Tên phòng từ 6-20 ký tự");
        return;
      }

      const existingRoom = findRoom(name);
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
          status: ROOM_STATUS.WAITING,
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

      if (!addRoom(newRoom)) {
        emitError(socket, "error", "Error creating room");
        return;
      }

      socket.join(roomId);
      io.to(roomId).emit("roomInfo", JSON.stringify(newRoom));
    } catch (error) {
      socket.emit("error", { message: "sERROR: Tạo phòng thất bại" });
    }
  });

  socket.on("getRoomInfo", (data) => {
    try {
      const { roomName, userId } = data;
      if (
        !roomName ||
        !userId ||
        roomName.trim() === "" ||
        userId.trim() === ""
      ) {
        emitError(socket, "error", "Vui lòng nhập đủ thông tin");
        return;
      }

      const room = findRoom(roomName);
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
      const { roomName, userId } = data;

      if (!roomName || !userId || roomName.trim() === "") {
        emitError(socket, "error", "Vui lòng nhập đủ thông tin");
        return;
      }

      const room = findRoom(roomName);

      if (
        !room ||
        room.roomInfo.status !== ROOM_STATUS.WAITING ||
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

      if (room.users.length === ROOM_MEMBERS)
        room.roomInfo.status = ROOM_STATUS.READY;
      if (!updateRoom(roomName, room)) {
        emitError(socket, "error", "Error joining room");
        return;
      }
      socket.join(room.roomInfo.id);
      io.to(room.roomInfo.id).emit("roomInfo", JSON.stringify(room));
    } catch {
      emitError(socket, "error", "Error joining room");
    }
  });

  socket.on("startGame", async (data) => {
    try {
      const { roomName, userId, topicsIds } = data;

      if (!roomName || !userId || roomName.trim() === "") {
        emitError(socket, "error", "Vui lòng nhập đủ thông tin");
        return;
      }

      if (!topicsIds || topicsIds.length < MIN_TOPIC_SELECT) {
        emitError(socket, "error", `Chọn ít nhất ${MIN_TOPIC_SELECT} chủ đề`);
        return;
      }

      const room = findRoom(roomName);

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
        {
          $lookup: {
            from: "topics", // Tên collection của Topic (viết đúng theo tên collection trong MongoDB)
            localField: "topicId",
            foreignField: "_id",
            as: "topicInfo",
          },
        },
        { $unwind: "$topicInfo" }, // Giải nén mảng topicInfo thành object
        { $project: { answer: 0 } },
      ]);
      room.roomInfo.questions = questions;
      room.roomInfo.currentPlayer = null;
      room.roomInfo.status = ROOM_STATUS.PLAYING;
      room.roomInfo.turnIndex = 0;
      room.roomInfo.currentQuestion = null;
      room.roomInfo.answeredPlayers = [];

      if (!updateRoom(roomName, room)) {
        emitError(socket, "error", "Error save room info");
        return;
      }

      io.to(room.roomInfo.id).emit("gameStarted", JSON.stringify({ room }));
    } catch {
      emitError(socket, "error", "Error starting game");
    }
  });

  socket.on("leaveRoom", (data) => {
    try {
      const { roomName, userId } = data;

      if (!roomName || !userId || roomName.trim() === "") {
        emitError(socket, "error", "Vui lòng nhập đủ thông tin");
        return;
      }

      const room = findRoom(roomName);
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
        if (!removeRoom(roomName)) {
          emitError(socket, "error", "Error deleting room");
        }

        io.to(room.roomInfo.id).emit(
          "roomDeleted",
          JSON.stringify({ roomId: room.roomInfo.id })
        );
        socket.leave(room.roomInfo.id);
        return;
      }

      room.users.splice(userIndex, 1);
      if (
        room.roomInfo.status === ROOM_STATUS.READY &&
        room.users.length < ROOM_MEMBERS
      ) {
        room.roomInfo.status = ROOM_STATUS.WAITING;
      }

      if (!updateRoom(roomName, room)) {
        emitError(socket, "error", "Error leaving room");
        return;
      }
      socket.leave(room.roomInfo.id);

      io.to(room.roomInfo.id).emit("roomInfo", JSON.stringify(room));
    } catch {
      emitError(socket, "error", "Error leaving room");
    }
  });
};
