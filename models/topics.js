const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema({
  name: String,
  background: String,
});

const topicModel = mongoose.model("Topics", topicSchema);
module.exports = topicModel;
