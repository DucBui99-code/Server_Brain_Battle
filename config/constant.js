const ROOM_MEMBERS = 2;
const MIN_TOPIC_SELECT = 3;
const MAX_LENGTH_NAME = 25;
const MIN_LENGTH_NAME = 3;
const ROOM_STATUS = {
  WAITING: "waiting",
  READY: "ready",
  PLAYING: "playing",
  FINISHED: "finished",
};
const TIME_PER_QUESTION = 20; //Đơn vị giây

module.exports = {
  ROOM_MEMBERS,
  MAX_LENGTH_NAME,
  MIN_LENGTH_NAME,
  MIN_TOPIC_SELECT,
  ROOM_STATUS,
  TIME_PER_QUESTION,
};
