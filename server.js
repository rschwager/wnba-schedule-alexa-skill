var AlexaAppServer = require("alexa-app-server");

AlexaAppServer.start({
  server_root: './',
  public_html: "public_html",
  port: process.env.PORT || 3000,
  verify: true,
  debug: true
}); 

