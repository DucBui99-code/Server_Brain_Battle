const multer = require("multer");

// Cấu hình lưu trữ file trong bộ nhớ (hoặc local)
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
