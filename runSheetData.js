const { google } = require("googleapis");
const { auth } = require("google-auth-library");
const Topic = require("./models/topics");
const Question = require("./models/questions");
const connectDB = require("./config/database");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

async function getTopicsFromSpreadsheet(spreadsheetId, sheetName) {
  const client = auth.fromJSON(require("./credentials.json"));
  client.scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

  const sheets = google.sheets({ version: "v4", auth: client });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `!B2:B`, // Cột B chứa chủ đề
    });

    const topics = [...new Set(response.data.values.flat())]; // Loại bỏ trùng lặp
    console.log("✅ Topics:", topics);
    return topics;
  } catch (err) {
    console.error("❌ Lỗi khi lấy topics:", err);
    return [];
  }
}

async function saveTopicsToDB(topics) {
  for (const topicName of topics) {
    let topic = await Topic.findOne({ name: topicName });
    if (!topic) {
      topic = new Topic({ name: topicName });
      await topic.save();
      console.log(`✔️ Đã thêm chủ đề: ${topicName}`);
    } else {
      console.log(`❌ Đã tồn tại chủ đề ${topicName}`);
    }
  }
}

async function getQuestionsFromSpreadsheet(spreadsheetId, sheetName) {
  const client = auth.fromJSON(require("./credentials.json"));
  client.scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

  const sheets = google.sheets({ version: "v4", auth: client });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A2:F`, // Cột A: Câu hỏi, B-E: Đáp án, F: Đáp án đúng
    });

    const rows = response.data.values;
    if (!rows.length) {
      console.log("❌ Không có dữ liệu câu hỏi.");
      return [];
    }

    return rows.map((row) => ({
      question: row[0],
      options: [
        { key: "A", text: row[1] },
        { key: "B", text: row[2] },
        { key: "C", text: row[3] },
        { key: "D", text: row[4] },
      ],
      answer: row[5]?.trim()?.charAt(0) || "", // Lấy ký tự đầu của đáp án
    }));
  } catch (err) {
    console.error("❌ Lỗi khi lấy câu hỏi:", err);
    return [];
  }
}

async function saveQuestionsToDB(topicName, questions) {
  const topic = await Topic.findOne({ name: topicName });
  if (!topic) {
    console.error(`❌ Chủ đề '${topicName}' không tồn tại trong DB.`);
    return;
  }

  for (const q of questions) {
    const existingQuestion = await Question.findOne({ question: q.question });
    if (!existingQuestion) {
      const newQuestion = new Question({
        topicId: topic._id,
        question: q.question,
        options: q.options,
        answer: q.answer,
      });
      await newQuestion.save();
      console.log(`✔️ Đã lưu câu hỏi: ${q.question}`);
    }
  }
}

connectDB();

async function processSpreadsheet() {
  const spreadsheetId = "1Qq62HmQCYnGsk1gqqTX4Api8_NXD8gYZJ371vk6YBYM";

  // 1. Lấy danh sách chủ đề từ Google Sheets
  const topics = await getTopicsFromSpreadsheet(spreadsheetId, "");

  // 2. Lưu chủ đề vào MongoDB
  await saveTopicsToDB(topics);

  // 3. Lấy câu hỏi theo từng chủ đề
  for (const topic of topics) {
    const questions = await getQuestionsFromSpreadsheet(spreadsheetId, topic);
    await saveQuestionsToDB(topic, questions);
  }
}

processSpreadsheet();
