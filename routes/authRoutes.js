const express = require("express");
const router = express.Router();
const authSocial = require("../controllers/authSocialController");

router.post("/google", authSocial.googleOAuth);
router.get("/google/callback", authSocial.googleCallback);
router.get("/google/url", authSocial.getGoogleAuthUrl);
router.post("/google/connect", authSocial.connectGoogle);
router.delete("/google/disconnect", authSocial.disconnectGoogle);

module.exports = router;
