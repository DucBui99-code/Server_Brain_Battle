const { nanoid } = require("nanoid");
const cloudinary = require("cloudinary").v2;

const UserModel = require("../models/users");
const RoomModel = require("../models/room");
const throwError = require("../utils/throwError");
const { MIN_LENGTH_NAME, MAX_LENGTH_NAME } = require("../config/constant");

exports.register = async (req, res, next) => {
  try {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

    const { avatar } = req.files;
    const { name } = req.body;

    if (!avatar || avatar.length === 0) {
      throwError("Avatar không hợp lệ");
    }

    if (!name && !name.trim()) {
      throwError("Tên không hợp lệ");
    }
    if (name.length > MAX_LENGTH_NAME || name.length < MIN_LENGTH_NAME) {
      throwError(
        `Vui lòng nhặp tên trong khoảng ${MIN_LENGTH_NAME} va ${MAX_LENGTH_NAME}`
      );
    }
    const fileImage = avatar[0];

    const UserDb = await UserModel.findOne({ name: name });
    if (UserDb) {
      await cloudinary.uploader.destroy(fileImage.filename);
      throwError("Tên đã được sử dụng");
    }

    if (!allowedTypes.includes(fileImage.mimetype)) {
      await cloudinary.uploader.destroy(fileImage.filename);
      throwError("Only .jpeg, .jpg, .png, and .gif formats are allowed!");
    }
    const newUser = new UserModel({
      name: name,
      avatar: fileImage.path, // Chuyển ảnh thành base64 nếu cần
    });

    await newUser.save();

    return res.status(201).json({
      status: true,
      message: "Tạo tài khoản thành công",
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.createRoom = async (req, res, next) => {
  try {
    const { name, userId } = req.body;
    if (!userId) {
      throwError("Not foud userId");
    }
    if (!name || !name.trim()) {
      throwError("Tên phòng không hợp lệ");
    }
    if (name.length > MAX_LENGTH_NAME || name.length < MIN_LENGTH_NAME) {
      throwError(
        `Vui lòng nhặp tên phòng trong khoảng ${MIN_LENGTH_NAME} va ${MAX_LENGTH_NAME}`
      );
    }
    const RoomDb = await RoomModel.findOne({ name });
    if (RoomDb) {
      throwError("Tên phòng đã tồn tại");
    }
    const roomId = nanoid(6);
    const newRoom = new RoomModel({
      id: roomId,
      name: name,
      owner: userId,
      users: [userId],
    });

    await newRoom.save({ validateModifiedOnly: true });

    return res.status(201).json({
      status: true,
      message: "Tạo phòng thành công",
      data: newRoom,
    });
  } catch (error) {
    next(error);
  }
};
