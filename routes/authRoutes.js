const express = require("express");
const router = express.Router();
const authSocial = require("../controllers/authSocialController");

router.post("/google", authSocial.googleOAuth);

module.exports = router;
