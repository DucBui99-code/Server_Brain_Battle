const router = require("express").Router();

const userRoute = require("./userRouters");
const topicRoute = require("./topicRouters");

router.use("/user", userRoute);
router.use("/topic", topicRoute);

module.exports = router;
