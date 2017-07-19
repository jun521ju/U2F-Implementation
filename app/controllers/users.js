'use strict';

/**
 * Module dependencies.
 */

const mongoose = require('mongoose');
const { wrap: async } = require('co');
const { respond } = require('../utils');
const User = mongoose.model('User');
const u2f = require('u2f');

const app_id = 'https://localhost:6001';

/**
 * Load
 */

exports.load = async(function* (req, res, next, _id) {
  const criteria = { _id };
  try {
    req.profile = yield User.load({ criteria });
    if (!req.profile) return next(new Error('User not found'));
  } catch (err) {
    return next(err);
  }
  next();
});

/**
 * Create user
 */

exports.create = async(function* (req, res) {
  const user = new User(req.body);
  user.provider = 'local';
  try {
    yield user.save();
    req.logIn(user, err => {
      if (err) req.flash('info', 'Sorry! We are not able to log you in!');
      // used to direct to /, we changed it
      return res.redirect('/setupU2F');
    });
  } catch (err) {
    const errors = Object.keys(err.errors)
      .map(field => err.errors[field].message);

    res.render('users/signup', {
      title: 'Sign up',
      errors,
      user
    });
  }
});

/**
 *  Show profile
 */

exports.show = function (req, res) {
  const user = req.profile;
  respond(res, 'users/show', {
    title: user.name,
    user: user
  });
};

exports.signin = function () {};

/**
 * Auth callback
 */

exports.authCallback = login;

exports.api = function (req, res) {
  res.sendFile('u2f-api.js', {root: './scripts'});
};
/**
 * Show login form
 */

exports.login = function (req, res) {
  res.render('users/login', {
    title: 'Login'
  });
};


exports.success = function (req, res) {
  res.render('users/success', {
    title: 'Congrats!'
  });
};

/**
 * Show sign up form
 */

exports.signup = function (req, res) {
  res.render('users/signup', {
    title: 'Sign up',
    user: new User()
  });
};

// show setup/register U2F device page
exports.setupU2F = function (req, res) {
    res.render('users/setupU2F', {
        title: 'Setup 2FA'
  });
};

// process the 'Get' of "registerU2F" in XMLHttpRequest
exports.registerGet = function (req, res) {
  try {
    var registerRequest = u2f.request(); //ARGUMENT LOST HERE.
    req.session.registerRequest = registerRequest;
    res.send(registerRequest);
  } catch (err) {
    console.log(err);
    res.status(400).send();
  }
};

// process the 'Post' of "registerU2F" in XMLHttpRequest
exports.registerPost = function (req, res) {
  var registerResponse = req.body;
  var registerRequest = req.session.registerRequest;
  var id = req.user.id;
  try {
    var registration = u2f.checkRegistration(registerRequest,registerResponse);
    User.findById(id, function(err, user) {
      if (err) throw err;
     
      console.log('before add2FA'); 
      console.log(user);
      user.add2FA(registration, function(err, username) {
        if (err) throw err;
      });
      console.log('after add2FA');
      console.log(user);
      
      user.save({ validateBeforeSave: false }, function(err) {
        if (err) {
          throw err;
        } 
        console.log('success');
      });
    });
    res.send();
  } catch (err) {
    console.log(err);
    res.status(400).send();
  }
};

exports.authentication = function (req, res) {
  res.render('users/authentication', {
    title: 'U2F Authentication'
  });
};

// process the 'Get' of "authenticateU2F" in XMLHttpRequest
exports.authenticateGet = function (req, res) {
  User.findOne({username: req.user.username}, function(err, reg){
    if (err) {
      res.status(400).send(err);
    } else {
      if (reg !== null) {
        var signRequest = u2f.request(app_id, reg.deviceRegistration.keyHandle);
        req.session.signrequest = signRequest;
        req.session.deviceRegistration = reg.deviceRegistration;
        res.send(signRequest);
      }
    }
  });
}; 

// process the 'POST' of "authenticateU2F" in XMLHttpRequest
exports.authenticatePost = function (req, res) {
  var signResponse = req.body;
  var signRequest = req.session.signrequest;
  var deviceRegistration = req.session.deviceRegistration;
  try {
    var result = u2f.checkSignature(signRequest, signResponse, deviceRegistration.publicKey);
    if (result.successful) {
      req.session.secondFactor = 'u2f';
      res.send();
    } else {
      res.status(400).send();
    }
  } catch (err) {
    console.log(err);
    res.status(400).send();
  }
};


/**
 * Logout
 */

exports.logout = function (req, res) {
  req.logout();
  req.session.secondFactor = undefined;
  res.redirect('/login');
};

/**
 * Session
 */
exports.session = login;

/**
 * Login
 */
function login (req, res) {
  res.redirect('/authentication');
}
