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
    process.env.JWT_KEY
  );
}

exports.googleCallback = async (req, res, next) => {
  try {
    const { code, state, code_verifier } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Authorization code not provided" });
    }

    // Redirect back to the app with the authorization code
    let redirectUrl = `hayotush://auth?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state || "")}`;

    // Add code_verifier if available (for PKCE)
    if (code_verifier) {
      redirectUrl += `&code_verifier=${encodeURIComponent(code_verifier)}`;
    }

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("[googleCallback] Error:", error);
    const redirectUrl = `hayotush://auth?error=${encodeURIComponent(
      error.message
    )}`;
    res.redirect(redirectUrl);
  }
};

exports.googleOAuth = async (req, res, next) => {
  try {
    const {
      code,
      redirectUri,
      codeVerifier,
      clientId: clientIdFromBody,
      platform,
      idToken, // For native Google Sign-In
    } = req.body;

    // Handle native Google Sign-In with idToken directly (only if no authorization code)
    if (idToken && !code) {
      if (!idToken) {
        const error = new Error("Missing idToken");
        error.statusCode = 400;
        return next(error);
      }

      // idToken is always created for the Web Client ID (from GoogleSignin.configure)
      // So we need to verify it against the Web Client ID, not the platform-specific one
      const webClientId = process.env.GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) {
        const error = new Error("Web Client ID not configured");
        error.statusCode = 500;
        return next(error);
      }

      // Verify the idToken directly against the Web Client ID
      const oAuthClient = new OAuth2Client();
      let ticket;
      try {
        ticket = await oAuthClient.verifyIdToken({
          idToken: idToken,
          audience: webClientId, // Use Web Client ID, not the platform-specific one
        });
      } catch (verifyError) {
        console.error("[googleOAuth] idToken verification failed:", verifyError);
        const error = new Error("Invalid Google idToken");
        error.statusCode = 401;
        return next(error);
      }

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
        user = new User({
          name,
          email,
          googleId,
          profilePicture: picture,
        });
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
      return res.json({
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
    }

    // Original flow with authorization code
    if (!code || !redirectUri || !clientIdFromBody) {
      const error = new Error("Missing code, redirectUri, or clientId");
      error.statusCode = 400;
      return next(error);
    }

    // For serverAuthCode (redirectUri="postmessage"), we must use Web Client ID
    // because serverAuthCode is created for the Web Client ID in GoogleSignin.configure
    const webClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const effectiveClientId = redirectUri === "postmessage" ? webClientId : clientIdFromBody;

    // Use the effective client ID for token exchange
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: effectiveClientId,
      client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET,
    });

    // Add PKCE parameters if available
    if (codeVerifier) {
      params.append("code_verifier", codeVerifier);
    }

    let tokenRes;
    try {
      tokenRes = await axios.post(GOOGLE_TOKEN_ENDPOINT, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (error) {
      console.error("[googleOAuth] Google token request failed:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });

      // Handle specific Google OAuth errors
      let errorMessage = "Google authentication failed";
      if (error.response?.data?.error === "invalid_grant") {
        errorMessage =
          "Authorization code expired or invalid. Please try logging in again.";
      } else if (error.response?.data?.error === "invalid_client") {
        errorMessage = "Invalid client configuration. Please contact support.";
      } else if (error.response?.data?.error) {
        errorMessage = `Google OAuth error: ${error.response.data.error}`;
      }

      const authError = new Error(errorMessage);
      authError.statusCode = 400;
      return next(authError);
    }

    const { id_token } = tokenRes.data || {};
    if (!id_token) {
      console.error("[googleOAuth] No id_token in response:", tokenRes.data);
      const error = new Error("No id_token from Google");
      error.statusCode = 401;
      return next(error);
    }

    const oAuthClient = new OAuth2Client();
    // For verification, use Web Client ID for serverAuthCode, or original clientId for regular OAuth
    const verificationWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const verificationClientId = redirectUri === "postmessage" ? verificationWebClientId : clientIdFromBody;
    const ticket = await oAuthClient.verifyIdToken({
      idToken: id_token,
      audience: verificationClientId,
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

    // Save calendar tokens if available
    const { access_token, refresh_token, expires_in } = tokenRes.data || {};

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = new User({
        name,
        email,
        googleId,
        profilePicture: picture,
        googleCalendarAccessToken: access_token,
        googleCalendarRefreshToken: refresh_token,
        googleCalendarTokenExpiry: expires_in
          ? new Date(Date.now() + expires_in * 1000)
          : null,
      });
      await user.save();
    } else {
      const set = {};
      if (!user.googleId) set.googleId = googleId;
      if (picture && user.profilePicture !== picture)
        set.profilePicture = picture;
      if (access_token) set.googleCalendarAccessToken = access_token;
      if (refresh_token) set.googleCalendarRefreshToken = refresh_token;
      if (expires_in)
        set.googleCalendarTokenExpiry = new Date(
          Date.now() + expires_in * 1000
        );

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

exports.getGoogleAuthUrl = async (req, res, next) => {
  try {
    // Generate Google OAuth URL for connecting existing account
    const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const redirectUri = `${
      process.env.BASE_URL || "http://localhost:3000"
    }/auth/google/callback`;
    const scope =
      "openid email profile https://www.googleapis.com/auth/calendar";
    const state = "connect_account"; // Different state for connecting vs login

    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    res.json({ authUrl });
  } catch (error) {
    console.error("Error generating Google auth URL:", error);
    const authError = new Error("Failed to generate Google auth URL");
    authError.statusCode = 500;
    return next(authError);
  }
};

exports.connectGoogle = async (req, res, next) => {
  try {
    // This would handle connecting Google to existing account
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Google connection feature coming soon",
    });
  } catch (error) {
    console.error("Error connecting Google:", error);
    const authError = new Error("Failed to connect Google account");
    authError.statusCode = 500;
    return next(authError);
  }
};

exports.disconnectGoogle = async (req, res, next) => {
  try {
    // This would handle disconnecting Google from account
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Google disconnection feature coming soon",
    });
  } catch (error) {
    console.error("Error disconnecting Google:", error);
    const authError = new Error("Failed to disconnect Google account");
    authError.statusCode = 500;
    return next(authError);
  }
};
