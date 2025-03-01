const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  avatar: String,
});

module.exports = mongoose.model("Users", userSchema);
