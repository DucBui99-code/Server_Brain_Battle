const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topics",
      required: true,
    },
    question: String,
    options: [
      {
        text: String,
        key: String,
      },
    ],
    answer: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const quesionModel = mongoose.model("questions", questionSchema);

module.exports = quesionModel;
