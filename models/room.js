const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  id: String,
  name: String,
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  status: { type: String, enum: ["waiting", "started"], default: "waiting" },
  currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }, // Người đang trả lời
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
});

module.exports = mongoose.model("Room", roomSchema);
