const express = require("express");
const router = express.Router();
const authSocial = require("../controllers/authSocialController");

router.post("/google", authSocial.googleOAuth);
router.get("/google/callback", authSocial.googleCallback);

module.exports = router;
