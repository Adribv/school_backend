const mongoose = require('mongoose');

const PushNotificationLogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  data: {
    type: Object,
    default: {},
  },
  userIds: {
    type: [String], // If sent to all, this can be empty
    default: [],
  },
  forAll: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('PushNotificationLog', PushNotificationLogSchema);
