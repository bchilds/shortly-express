var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');

var app = express();

app.use(session ({
  secret: 'teapot',
  resave: true,
  cookie: {},
  isLoggedIn: false
}));

// middleware to check login for session
var restrict = (req, res, next) => {
  if (req.session.isLoggedIn) {
    next();
  } else {
    req.session.error = 'Not logged in!';
    res.redirect('/login');
  }
};

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/users', restrict,
function(req, res) {
  Users.reset().fetch().then(function(users) {
    res.status(200).send(users.models);
  });
});

app.get('/login', 
function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  //take in req data as req.body
  //see if username is in db
  new User({ username: req.body.username }).fetch().then( (found) => {
    //if it is not, redirect to signup
    if (!found) {
      res.redirect('/signup');  
    } else {
    //if it is, check if the password matches stored hash
      var hashedPassword = util.passwordHash(req.body.password);
      //if it matches, 
      if (hashedPassword === found.attributes.passwordHash) {
        //redirect to index and start session
        // console.log('MATCH!');
        req.session.isLoggedIn = true;
        res.redirect('/');
        
        // still do session stuff
        
        
      //if it does not
      } else {
        //send 418 because they are a teapot and sent incorrect pw
        // console.log('NO MATCH :(');
        console.log('They are a teapot for submitting an incorrect password');
        res.sendStatus(418);
        
      }
      
    }
  });
  
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});



app.post('/signup', function(req, res) {
  //take in req data
  //console.log(req.body);
  //we see if username is in db
  //{ username: 'bchilds', password: '12345' }
  new User({ username: req.body.username }).fetch().then( (found) => {
    
    if (found) {
      //if yes, return error
      console.log('They are a teapot for submitting a user who exists');
      res.sendStatus(418);
      
    } else {
      //if not, 
      Users.create({
        username: req.body.username,
        passwordHash: req.body.password,
      }).then((newUser)=>{ res.status(200).send(newUser); });
      //TODO: redirect to login
        //insert username and (hashed) password into db
        //return success
        //login for them
          //TODO: create a new session
          //TODO: redirect back to index
      
    }
    
  } );
  
        
        
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', restrict, function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
