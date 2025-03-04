const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandeler");
const requestLogger = require("./middleware/requestLogger");
const gameSocket = require("./sockets/index");

dotenv.config({ path: "./config.env" });

connectDB();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.use(cors());
// app.use(requestLogger);

app.use("/v1/quizzApp", require("./routers/index"));

gameSocket(io);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
