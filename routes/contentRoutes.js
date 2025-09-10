const express = require("express");
const router = express.Router();
const { authMW } = require("../middleware/authMW");
const {
  getCategories,
  listArticles,
  getArticleBySlug,
  trackRead,
  getHighlights,
} = require("../controllers/contentController");

router.get("/categories", getCategories);
router.get("/articles", listArticles);
router.get("/articles/:slug", getArticleBySlug);
router.get("/highlights", getHighlights);

router.post("/track/read", authMW, trackRead);

module.exports = router;
