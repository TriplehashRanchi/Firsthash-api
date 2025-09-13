// controllers/otpController.js
const fetch = require("node-fetch");
const admin = require("../utils/admin");
const { findUserByPhone } = require("../models/userModel");

const verifyOtp = async (req, res) => {
  const { accessToken } = req.body;

  try {
    // 1. Verify with MSG91
    const msg91Res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        authkey: process.env.MSG91_AUTHKEY,
        "access-token": accessToken, // ✅ quotes required
      }),
    }).then((r) => r.json());

    console.log("MSG91 response:", msg91Res);

    if (msg91Res?.type !== "success") {
      return res.status(401).json({ error: "OTP verification failed", details: msg91Res });
    }

    const phone = msg91Res.message; // MSG91 gives the phone number

    // 2. Lookup existing user
    const user = await findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: "User not registered. Please contact admin." });
    }

    // 3. Mint Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(user.firebase_uid);

    return res.json({ firebaseToken });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
};


module.exports = { verifyOtp };
