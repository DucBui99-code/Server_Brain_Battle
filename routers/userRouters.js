const router = require("express").Router();
const userController = require("../controllers/userController");
const { createUploader } = require("../services/uploadImageService");

router.post(
  "/register",
  createUploader("BrainBattle"),
  userController.register
);
// router.post("/createRoom", userController.createRoom);

module.exports = router;
