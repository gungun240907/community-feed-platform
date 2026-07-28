const express = require("express");
const router = express.Router();
const { search } = require("../controllers/searchController");
const { optionalAuth } = require("../middleware/auth");
const { checkSearchAccess } = require("../middleware/subscription");

router.get("/", optionalAuth, checkSearchAccess, search);

module.exports = router;