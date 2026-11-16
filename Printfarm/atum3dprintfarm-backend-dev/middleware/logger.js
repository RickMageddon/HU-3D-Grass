module.exports = function (req, res, next) {
    const safeUrl = req.url.replace(/(\/smart-module-stream\/)[^/?]+/g, "$1[redacted]");
    console.log(`[${new Date().toISOString()}] ${req.method} ${safeUrl}`);
    next();
};
