const express= require("express");
const router = express.Router();
const bcrypt = require('bcrypt');

const { registerParent, loginParent, addStudent, deleteStudent, getStudents, getSchools, updateNotificationPreference, sendTestNotification } = require("../Controller/AuthController");

router.post('/register', registerParent);
router.post('/login', loginParent);
router.get('/students', getStudents);
router.get('/schools', getSchools);
router.post('/add-student', addStudent);
router.delete('/delete-student', deleteStudent);
router.post('/students/:studentId/notifications', updateNotificationPreference);
router.post('/test-notification', sendTestNotification);

module.exports = router;