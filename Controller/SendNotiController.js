require('dotenv').config();
const Notification = require('../Model/Notification');

// Use the shared admin instance instead
const admin = require('../firebase/admin');

const PushToken = require('../Model/PushToken');
const axios = require('axios');
const FormData = require('form-data');

// Add API key for notification security
const NOTIFICATION_API_KEY = process.env.NOTIFICATION_API_KEY || '8d4777c2-da71-408e-974d-daa29b142689';

// Helper function to validate API key
const validateApiKey = (req, res, next) => {
  const providedApiKey = req.headers['x-api-key'] || req.body.api_key;
  
  if (!providedApiKey || providedApiKey !== NOTIFICATION_API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid API key" });
  }
  
  // Continue to the actual route handler
  return next();
};

const fetchSchoolUsers = async (licenseId) => {
    try {
      const form = new FormData();
      form.append('api_key', '8d4777c2-da71-408e-974d-daa29b142689'); // Real API key
  
      const response = await axios.post(
        'https://app.edisha.org/index.php/resource/GetSchools',
        form,
        {
          headers: form.getHeaders()
        }
      );
  
      const schools = response.data?.data || [];
      const matchedSchool = schools.find(school => school.licence_id == licenseId);
      if (!matchedSchool) {
        throw new Error(`School with licence_id ${licenseId} not found`);
      }
  
      const accessKey = matchedSchool.access_key;
  
      const userForm = new FormData();
      userForm.append('api_key', accessKey);
  
      const usersResponse = await axios.post(
        'https://app.edisha.org/index.php/resource/GetUsers',
        userForm,
        { headers: userForm.getHeaders() }
      );
      console.log(usersResponse.data);
      const users = usersResponse.data?.data || [];
      console.log(users);
      console.log(`✅ Fetched ${users.length} users for school ID ${licenseId}`);
      return users;
  
    } catch (error) {
      console.error('❌ Error fetching users:', error.message);
      return [];
    }
  };
  

// async function sendFCMNotificationBatch(studentIds, title, body, data = {}) {
//     try {
//       for (const studentId of studentIds) {
//         // Find the PushToken document that contains this student
//         const tokenDoc = await PushToken.findOne({ 'students.studentId': studentId });
//         console.log("Token:", tokenDoc);
//         if (!tokenDoc || !tokenDoc.pushToken) {
//           console.warn(`⚠️ No FCM push token found for student ID: ${studentId}`);
//           continue;
//         }
  
//         const message = {
//           token: tokenDoc.pushToken,
//           notification: {
//             title,
//             body
//           },
//           data: {
//             ...data,
//             customData: "Crescent Notification"
//           }
//         };
  
//         try {
//             const response = await admin.messaging().send(message);
//             console.log("✅ Sent to student ID", studentId, "→", response);
//           } catch (sendErr) {
//             console.error("❌ Failed to send to student ID", studentId);
//             console.error("Error code:", sendErr.code);
//             console.error("Full error:", sendErr);
//           }
          
//       }
//     } catch (error) {
//       console.error("❌ Error sending FCM push notifications:", error.message);
//     }
//   }
const sendFCMNotificationBatch = async (tokens, title, body, data = {}) => {
  try {
    for (const token of tokens) {
      const message = {
        token: token,
        notification: {
          title,
          body,
        },
        android: {
          priority: "high",
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body,
              },
              sound: "default",
              contentAvailable: true,
            },
          },
        },
        data: {
          ...data,
          customData: "Crescent Notification",
        },
      };

      try {
        const response = await admin.messaging().send(message);
        console.log("✅ Sent to token", token, "→", response);
      } catch (sendErr) {
        console.error("❌ Failed to send to token", token);
        console.error("Error code:", sendErr.code);
        console.error("Full error:", sendErr);
      }
    }
  } catch (error) {
    console.error("❌ Error sending FCM push notifications:", error.message);
  }
};


const sendNotification = async (req, res) => {
  try {
    // Validate API key first
    const apiKeyResult = validateApiKey(req, res, () => true);
    if (apiKeyResult !== true) return apiKeyResult;
    
    const { userIds, title, body, data = {} } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "Invalid or missing userIds" });
    }
    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const matchingTokens = await PushToken.find({
      'students.studentId': { $in: userIds },
      pushToken: { $exists: true },
    });

    const tokensToSend = [];
    const validStudentIds = [];

    for (const tokenDoc of matchingTokens) {
      const matchedStudents = tokenDoc.students.filter(student =>
        userIds.includes(student.studentId)
      );
      if (matchedStudents.length && tokenDoc.pushToken) {
        tokensToSend.push(tokenDoc.pushToken);
        validStudentIds.push(...matchedStudents.map(s => s.studentId));
      }
    }

    const invalidStudentIds = userIds.filter(id => !validStudentIds.includes(id));
    if (invalidStudentIds.length > 0) {
      return res.status(400).json({
        error: "Some studentIds do not have registered push tokens",
        invalidStudentIds
      });
    }

    // Save notifications
    const notifications = validStudentIds.map(studentId => ({
      userId: studentId,
      title,
      body,
      data,
      sent: true
    }));
    await Notification.insertMany(notifications);

    // Send push notifications
    await sendFCMNotificationBatch(tokensToSend, title, body, data);

    res.status(200).json({
      message: "Notifications sent successfully",
      sentTo: validStudentIds
    });

  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
};

const SendNotificationToAll = async (req, res) => {
  try {
    // Validate API key first
    const apiKeyResult = validateApiKey(req, res, () => true);
    if (apiKeyResult !== true) return apiKeyResult;
    
    const { title, body, data = {}, licenseId } = req.body;
    console.log("Received licenseId:", licenseId);

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    const schoolUsers = await fetchSchoolUsers(licenseId);
    console.log("Fetched school users:", schoolUsers);
    if (!schoolUsers || !schoolUsers.length) {
      return res.status(404).json({ error: "No users found in school database" });
    }

    const schoolUserIds = schoolUsers.map(user => user.user_id.toString());

    const matchingTokens = await PushToken.find({
      'students.studentId': { $in: schoolUserIds },
      pushToken: { $exists: true }
    });

    const tokensToSend = [];
    const validStudentIds = [];

    for (const tokenDoc of matchingTokens) {
      const matchedStudents = tokenDoc.students.filter(student =>
        schoolUserIds.includes(student.studentId)
      );
      if (matchedStudents.length && tokenDoc.pushToken) {
        tokensToSend.push(tokenDoc.pushToken);
        validStudentIds.push(...matchedStudents.map(s => s.studentId));
      }
    }

    if (!tokensToSend.length) {
      return res.status(404).json({ error: "No valid tokens found to send notifications" });
    }

    // Save to Notification collection
    const notifications = validStudentIds.map(studentId => ({
      userId: studentId,
      title,
      body,
      data,
      sent: true
    }));
    await Notification.insertMany(notifications);

    // Send notifications
    await sendFCMNotificationBatch(tokensToSend, title, body, data);

    res.status(200).json({
      message: "Notifications sent successfully to school users",
      sentTo: validStudentIds.length,
      totalSchoolUsers: schoolUserIds.length,
    });

  } catch (error) {
    res.status(500).json({
      error: "Failed to send notifications to school users",
      details: error.message
    });
  }
};

  

const sendFCMNotificationToParent = async (req, res) => {
    try {
        // Validate API key first
        const apiKeyResult = validateApiKey(req, res, () => true);
        if (apiKeyResult !== true) return apiKeyResult;
        
        const { studentId, studentName, title, body, data = {} } = req.body;

        // Find all parents who have this student in their students array
        const parentTokens = await PushToken.find({ 
            "students.studentId": studentId 
        });

        if (parentTokens.length === 0) {
            console.warn(`⚠️ No parent FCM push token found for student: ${studentId}`);
            return res.status(404).json({ message: "No parent found for the given student." });
        }

        // Extract push tokens
        const validTokens = parentTokens.map(parent => parent.pushToken);

        if (validTokens.length === 0) {
            return res.status(400).json({ message: "No valid FCM tokens found for parents." });
        }

        // Send notifications using FCM
        try {
            await sendFCMNotificationBatch(validTokens, title, `${studentName}: ${body}`, { studentId, studentName, ...data });
        } catch (fcmError) {
            return res.status(500).json({ 
                error: "Failed to send FCM notifications", 
                details: fcmError.message 
            });
        }

        return res.status(200).json({ message: "Notifications sent successfully." });
    } catch (error) {
        console.error("❌ Error sending FCM push notifications to parents:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const testSendFCMNotification = async (req, res) => {
  try {
    // Validate API key first
    const apiKeyResult = validateApiKey(req, res, () => true);
    if (apiKeyResult !== true) return apiKeyResult;
    
    const { title = "Test Title", body = "Test Body", data = {} } = req.body;
    const testDeviceToken = "f87Xjh53RXSaWpDPWFHkh_:APA91bH1tj_Yy_AvFMmpu4tUwtinEnBdP1qVzuf5poY_maSAsqDkgvJtzZ9k0T4MmawHpDjQM42nINN6PV7IZxpU9klYFYCM2w2ap3_xGfBbV_paWacn1oc";
    const message = {
      token: testDeviceToken,
      notification: {
        title,
        body,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            contentAvailable: true,
          },
        },
      },
      data: {
        ...data,
        customData: "TestMessage",
      },
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Test FCM sent:", response);
    return res.status(200).json({ message: "Test notification sent", response });

  } catch (error) {
    console.error("❌ Error sending test FCM:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports={sendNotification,SendNotificationToAll,sendFCMNotificationToParent,testSendFCMNotification}
