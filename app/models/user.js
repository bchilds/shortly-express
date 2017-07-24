var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var crypto = require('crypto');


var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  defaults: {
  },
  
  initialize: function() {
    // this.on('creating', function(model, attrs, options) {
    //   var shasum = crypto.createHash('sha1');
    //   shasum.update(model.get('url'));
    //   model.set('code', shasum.digest('hex').slice(0, 5));
    // });
    
    this.on('creating', function(model, attrs, options) {
      var shasum = crypto.createHash('sha1');
      shasum.update(model.get('passwordHash'));
      model.set('passwordHash', shasum.digest('hex').slice(0, 5));
    });
    
    
  }
});

module.exports = User;