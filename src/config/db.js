// Import Mongoose, the official MongoDB library helper for Node.js
const mongoose = require("mongoose");

// Determine database target URI (uses the environment variable MONGODB_URI, falling back to local MongoDB)
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/offline-devices-caller";

/**
 * Connect to the MongoDB database using Mongoose.
 */
async function connectDatabase() {
  // Turn on strict query mapping for schema adherence
  mongoose.set("strictQuery", true);
  
  // Disable query buffering so that if MongoDB drops offline,
  // database queries fail immediately (fail-fast) instead of hanging the Node process.
  mongoose.set("bufferCommands", false);

  // Trigger connection
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
}

module.exports = { connectDatabase };
