function requireAuth(req, res, next) {
    return next();
}

module.exports = { requireAuth };
