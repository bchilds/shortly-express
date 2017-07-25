var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;

var GITHUB_CLIENT_ID = '2c9369c0f60c637d64fb';
var GITHUB_CLIENT_SECRET = '90fc67d652f89f447e1790534bae33bdbf7fc369';

passport.serializeUser( (user, done) => {
  done(null, user);
});

passport.deserializeUser( (user, done) => {
  done(null, user);
});

var userName; 
var userImage;

passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:4568/auth/callback',
  passRequestToCallback: true,
},
  function(req, accessToken, refreshToken, profile, done) {
    // console.log(profile._json.avatar_url);
    process.nextTick( () => {
      return done(null, profile);
    });
  }
));

var app = express();

app.use(session ({
  secret: 'teapot',
  resave: true,
  cookie: {},
  isLoggedIn: false
}));

app.use(passport.initialize());
app.use(passport.session());


// middleware to check login for session
////////////// OLD CHECK USER SOLUTION (CLIENT) ////////////
// var checkUser = (req, res, next) => {
//   if (req.session.isLoggedIn) {
//     next();
//   } else {
//     req.session.error = 'Not logged in!';
//     res.redirect('/login');
//   }
// };

var checkUser = (req, res, next) => {
  if (req.session.isLoggedIn || req.isAuthenticated()) {
    return next();
  }

  res.redirect('/login');

};

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', checkUser, function(req, res) {
  if (req.user) {
    res.render('index', {theimagewewant: req.user._json.avatar_url});
  } else {
    res.render('index', {theimagewewant: undefined});
  }
});

app.get('/create', checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
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

app.get('/users', checkUser, function(req, res) {
  Users.reset().fetch().then(function(users) {
    res.status(200).send(users.models);
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

///////////////////// NEW LOGIN (O AUTH) /////////////////////////
app.get('/auth', 
  passport.authenticate('github', {
    scope: ['user:email'],
    successFlash: true, 
  }),
  (req, res) => {}
);

app.get('/auth/callback', 
  passport.authenticate('github', {failureRedirect: '/login'}),
  (req, res) => {
    // console.log(req.user._json.avatar_url);
    res.redirect('/');
  }
);


////////////////////// NEW LOGOUT (O AUTH) //////////////////////
app.get('/logout', (req, res) => {
  req.session.destroy( () => {
    req.logout();
    res.redirect('/login');
  });
});

/////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////

/////////// OLD SOLUTION (CLIENT AUTH) ///////////////////////
app.post('/login', function(req, res) {
  //take in req data as req.body
  //see if username is in db
  new User({ username: req.body.username }).fetch().then( (found) => {
    //if it is not, redirect to signup
    if (!found) {
      res.redirect('/login');  
    } else {
    //if it is, check if the password matches stored hash
      //if it matches, 
      var passed = util.passwordCheck(req.body.password, found.attributes.password);
      
      if (passed) {
        //redirect to index and start session
        // console.log('MATCH!');
        req.session.isLoggedIn = true;
        res.redirect('/');
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

app.get('/signup', function(req, res) {
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
        password: req.body.password,
      }).then((newUser)=>{ 
        req.session.isLoggedIn = true;
        res.redirect('/');
        //res.sendStatus(200);//.send(newUser); 
      });
      //TODO: redirect to login
        //insert username and (hashed) password into db
        //return success
        //login for them
          //TODO: create a new session
          //TODO: redirect back to index
      
    }
  } );
});
/////////////////////////////////////////////////////////////////


////////////////////// ORIGINAL LOGOUT //////////////////////////
// app.get('/logout', function(req, res) {
//   req.session.destroy( () => {
//     res.redirect('/login');
//   });
// });


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
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
