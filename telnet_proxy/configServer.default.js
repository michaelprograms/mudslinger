var config = {};


config.serverHost = "0.0.0.0";
config.serverPort = 80;
config.mudHost = "127.0.0.1";
config.mudPort = 4000;

// Self-hosted default allows any origin. To restrict, set your domain,
// e.g. "https://mud.example.com".
config.corsOrigin = "*";

module.exports = config;
