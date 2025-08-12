const axios = require("axios");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const _ = require("lodash");
const { User } = require("../models/userModel");

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISS = "https://accounts.google.com";

function signAppToken(user) {
  return jwt.sign(
    {
      _id: user._id,
      isAdmin: user.isAdmin,
      subscriptionPlan: user.subscriptionPlan,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_KEY,
    { expiresIn: "7d" }
  );
}

exports.googleOAuth = async (req, res, next) => {
  try {
    const {
      code,
      redirectUri,
      codeVerifier,
      clientId: clientIdFromBody,
    } = req.body;
    if (!code || !redirectUri) {
      const error = new Error("Missing code or redirectUri");
      error.statusCode = 400;
      return next(error);
    }

    console.log("[googleOAuth] checks:", {
      envClientIdTail: process.env.GOOGLE_WEB_CLIENT_ID?.slice(-20),
      hasEnvSecret: !!process.env.GOOGLE_WEB_CLIENT_SECRET,
      clientIdFromBodyTail: clientIdFromBody?.slice(-20),
      redirectUri,
      hasCodeVerifier: !!codeVerifier,
    });

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.GOOGLE_WEB_CLIENT_ID,
      client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET,
      code_verifier: codeVerifier, // חובה עם PKCE
    });

    const tokenRes = await axios.post(
      GOOGLE_TOKEN_ENDPOINT,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { id_token } = tokenRes.data || {};
    if (!id_token) {
      const error = new Error("No id_token from Google");
      error.statusCode = 401;
      return next(error);
    }

    const oAuthClient = new OAuth2Client();
    const ticket = await oAuthClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || payload.iss !== GOOGLE_ISS) {
      const error = new Error("Invalid Google token");
      error.statusCode = 401;
      return next(error);
    }

    const googleId = payload.sub;
    const email = (payload.email || "").toLowerCase();
    const name = payload.name || email || "Google User";
    const picture = payload.picture;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = new User({ name, email, googleId, profilePicture: picture });
      await user.save();
    } else {
      const set = {};
      if (!user.googleId) set.googleId = googleId;
      if (picture && user.profilePicture !== picture)
        set.profilePicture = picture;
      if (Object.keys(set).length)
        await User.updateOne({ _id: user._id }, { $set: set });
    }

    const token = signAppToken(user);
    res.json({
      message: "Google login OK",
      token,
      user: _.pick(user, [
        "_id",
        "name",
        "email",
        "profilePicture",
        "subscriptionPlan",
      ]),
    });
  } catch (err) {
    console.error("[googleOAuth]", err?.response?.data || err.message);
    const googleError = new Error("Google OAuth failed");
    googleError.statusCode = 500;
    return next(googleError);
  }
};
