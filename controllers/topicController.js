const Topic = require("../models/topics");

const getAllTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find();
    res.status(200).json(topics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTopics,
};
