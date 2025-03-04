function emitError(socket, type, errorMessage) {
  socket.emit(type, { message: errorMessage });
}

module.exports = emitError;
