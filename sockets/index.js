const roomSocket = require("./room/roomSocket");
const questionHandler = require("./room/questionHandeler");
const answerHandler = require("./room/answerHandler");
// const userSocket = require("./user/userSocket");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    roomSocket(io, socket);
    questionHandler(io, socket);
    answerHandler(io, socket);
    // userSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
