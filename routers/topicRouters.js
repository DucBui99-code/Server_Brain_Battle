const router = require("express").Router();
const topicController = require("../controllers/topicController");

router.get("/getAllTopics", topicController.getAllTopics);

module.exports = router;
