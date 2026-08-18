const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/offline-devices-caller";

async function connectDatabase() {
  mongoose.set("strictQuery", true);
  // Disable query buffering so that we fail fast if disconnected from database
  mongoose.set("bufferCommands", false);

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
}

module.exports = { connectDatabase };
