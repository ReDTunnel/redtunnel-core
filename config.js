module.exports.DATABASE_HOST = process.env.DATABASE_HOST || 'database';
module.exports.DATABASE_PORT = process.env.DATABASE_PORT || 27017;
module.exports.DNS_HOST = process.env.DNS_HOST || 'dns';
module.exports.DNS_PORT = process.env.DNS_PORT || 53;
module.exports.SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
module.exports.SERVER_PORT = process.env.SERVER_PORT || 3000;
module.exports.UNSAFE_HEADERS = [
    "Host", "Connection", "Content-Length", "Origin",
    "User-Agent", "Referer", "Accept-Encoding", "Cookie", "DNT"
];
module.exports.SECRET = process.env.SECRET || require('crypto').randomBytes(64).toString();
