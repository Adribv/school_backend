require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use("/Auth",require("./Router/AuthRouter"));
app.use("/token",require("./Router/SaveTokenRouter"));
app.use("/notification",require("./Router/SendNotiRouter"));

mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1); // Exit the process if DB connection fails
    });

const PORT = process.env.PORT || 3500;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📱 Mobile devices can connect using: http://192.168.1.41:${PORT}`);
});

module.exports = app;