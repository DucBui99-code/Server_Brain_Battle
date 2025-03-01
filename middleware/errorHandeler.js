const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const returnCode = err.returnCode || "UNKNOWN_ERROR";
  res.status(statusCode).json({
    status: false,
    message: err.message || "Internal Server Error",
    returnCode,
  });
};

module.exports = errorHandler;
