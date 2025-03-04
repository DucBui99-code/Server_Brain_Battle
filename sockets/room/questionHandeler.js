const emitError = require("../utils/emitError");
const { findRoom, updateRoom } = require("../dataRoom");
const { TIME_PER_QUESTION } = require("../../config/constant");

module.exports = (io, socket) => {
  socket.on("getQuestionRoom", async (data) => {
    try {
      const { roomName, userId } = data;

      const room = findRoom(roomName);
      if (!room) {
        emitError(socket, "error", "Phòng không tồn tại");
        return;
      }

      // Kiểm tra xem userId có trong danh sách người chơi không
      const userInRoom = room.users.find(
        (user) => user.id.toString() === userId
      );
      if (!userInRoom) {
        emitError(socket, "error", "Bạn không ở trong phòng này");
        return;
      }

      // Nếu đã có câu hỏi hiện tại, gửi lại nó thay vì lấy mới
      if (room.roomInfo.currentQuestion) {
        socket.emit("newQuestion", room.roomInfo.currentQuestion);
        return;
      }

      // Gọi hàm lấy câu hỏi mới
      getNextQuestionAndPlayer(io, room);
      updateRoom(roomName, room);
    } catch (error) {
      console.error(error);
      emitError(socket, "error", "Lỗi khi lấy câu hỏi");
    }
  });

  // Khi người chơi trả lời xong, dừng timer
  socket.on("answerQuestion", (data) => {
    const { roomName, userId, answer, questionId } = data;
    console.log(roomName, userId, answer, questionId);

    const room = findRoom(roomName);
    if (!room) return;
    console.log(room.roomInfo);

    // Kiểm tra nếu câu hỏi hiện tại do đúng người chơi đó trả lời
    if (room.roomInfo.currentQuestion?.player === userId) {
      clearTimeout(room.roomInfo.timer); // Hủy đếm ngược

      // Kiểm tra câu trả lời đúng hay sai
      const isCorrect = checkAnswer(room, questionId, answer);
      io.to(room.roomInfo.id).emit("resultQuestion", { message: isCorrect });

      room.roomInfo.currentQuestion = null; // Reset câu hỏi
      getNextQuestionAndPlayer(io, room); // Gọi câu hỏi tiếp theo
      return;
    }
    io.to(room.roomInfo.id).emit("resultQuestion", { message: false });
  });

  function checkAnswer(room, questionId, answer) {
    const question = room.roomInfo.questions.find((q) => q._id === questionId);
    if (!question) return false;
    return question.answer === answer;
  }

  socket.on("reJoinRoom", (data) => {
    const { idRoom } = data;
    socket.join(idRoom);
  });
};

function getNextQuestionAndPlayer(io, room) {
  if (
    !room ||
    !room.roomInfo ||
    !room.roomInfo.questions ||
    room.roomInfo.questions.length === 0
  ) {
    io.to(room.roomInfo.id).emit("gameEnded", {
      message: "Game Over! No more questions.",
    });
    return;
  }

  // Lấy danh sách người chơi chưa trả lời
  let availablePlayers = room.users.filter(
    (user) => !room.roomInfo.answeredPlayers?.includes(user.id)
  );

  // Nếu tất cả đã trả lời, reset danh sách và gọi lại chính nó
  if (availablePlayers.length === 0) {
    room.roomInfo.answeredPlayers = [];
    availablePlayers = room.users; // Reset danh sách
  }

  // Chọn ngẫu nhiên 1 câu hỏi
  const questionIndex = Math.floor(
    Math.random() * room.roomInfo.questions.length
  );
  const selectedQuestion = room.roomInfo.questions[questionIndex];

  // Chọn ngẫu nhiên 1 người chơi
  const playerIndex = Math.floor(Math.random() * availablePlayers.length);
  const selectedPlayer = availablePlayers[playerIndex];
  // Tính toán thời gian kết thúc (timestamp tính theo milliseconds)
  const endTime = Date.now() + 1000 * TIME_PER_QUESTION; // 10 giây sau
  // Cập nhật câu hỏi hiện tại trong phòng
  room.roomInfo.currentQuestion = {
    question: selectedQuestion,
    player: selectedPlayer.id,
    endTime, // 10 giây
  };

  // Gửi câu hỏi đến tất cả người trong phòng
  io.to(room.roomInfo.id).emit("newQuestion", room.roomInfo.currentQuestion);

  // Xóa câu hỏi khỏi danh sách
  room.roomInfo.questions.splice(questionIndex, 1);

  // Đánh dấu người chơi đã trả lời
  room.roomInfo.answeredPlayers.push(selectedPlayer.id);

  // Bắt đầu bộ đếm thời gian 10 giây
  room.roomInfo.timer = setTimeout(() => {
    io.to(room.roomInfo.id).emit("timeUp", { player: selectedPlayer.id });

    // Reset trạng thái câu hỏi để gọi câu mới
    room.roomInfo.currentQuestion = null;
    getNextQuestionAndPlayer(io, room);
  }, 1000 * TIME_PER_QUESTION); // 10 giây
}
