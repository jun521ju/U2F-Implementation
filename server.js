'use strict';

/*
 * nodejs-express-mongoose
 * Copyright(c) 2015 Madhusudhan Srinivasa <madhums8@gmail.com>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

require('dotenv').config();

const fs = require('fs');
const join = require('path').join;
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const config = require('./config');
const engines = require('consolidate');

const u2f = require('u2f');
const app_id = 'https://localhost:6001';

const app = express();

var https = require('https');
var privateKey  = fs.readFileSync('./cert/private_key.pem', 'utf8');
var certificate = fs.readFileSync('./cert/certificate.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);
var httpsPort = 6001;

const models = join(__dirname, 'app/models');

const connection = connect();
app.engine('jade', engines.jade);
app.engine('ejs', engines.ejs);

/**
 * Expose
 */
module.exports = {
  app,
  connection
};

// Bootstrap models
fs.readdirSync(models)
  .filter(file => ~file.indexOf('.js'))
  .forEach(file => require(join(models, file)));

// Bootstrap routes
require('./config/passport')(passport);
require('./config/express')(app, passport);
require('./config/routes')(app, passport);

app.use(express.static('scripts'))

connection
  .on('error', console.log)
  .on('disconnected', connect)


function connect () {
  var options = { server: { socketOptions: { keepAlive: 1 } } };
  var connection = mongoose.connect(config.db, options).connection;
  return connection;
}


httpsServer.listen(httpsPort, function() {
    console.log('HTTPS Server is running on: https://localhost:%s', httpsPort);
});