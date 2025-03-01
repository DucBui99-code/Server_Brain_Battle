const router = require("express").Router();

const userRoute = require("./userRouters");

router.use("/user", userRoute);

module.exports = router;
