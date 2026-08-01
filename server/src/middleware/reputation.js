function requireReputation(min) {
  return function (req, res, next) {
    const reputation = req.user?.reputation || 0;
    if (reputation < min) {
      return res.status(403).json({
        error: `This action requires ${min} reputation points. You have ${reputation}.`,
        required: min,
        current: reputation,
      });
    }
    next();
  };
}

module.exports = { requireReputation };
