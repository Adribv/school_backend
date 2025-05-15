// Create a new file for Firebase Admin initialization
require('dotenv').config();
const admin = require('firebase-admin');
const FB = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FB),
  });
}

module.exports = admin;