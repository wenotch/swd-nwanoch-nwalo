require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const https = require('https');
const passport = require('passport');
const mongoose = require('mongoose');
const session = require('express-session');
const lodash = require('lodash');
const Inflector = require('inflected');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require('mongoose-findorcreate');
const collections = require(__dirname + '/public/js/collections.js');
const test = require(__dirname + '/public/js/test.js');

mongoose.connect('mongodb://localhost:27017/swdDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const app = express();

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// SCHEMA DEFINITIONS

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false,
  },
  password: String,
  googleId: String
});

const querySchema = new mongoose.Schema({
  queryName: String
});

const parameterSchema = new mongoose.Schema({
  paramName: String
});

const productSchema = new mongoose.Schema({
  productName: String,
  productNumber: String,
  productColor: String,
  productPrice: String,
  productImage: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// MODEL DEFINITIONS

const User = mongoose.model('User', userSchema);
const Query = mongoose.model('Query', querySchema);
const Parameter = mongoose.model('Parameter', parameterSchema);
const Product = mongoose.model('Product', productSchema);

passport.use(User.createStrategy());

// LOCAL SERIALIZATION

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//GLOBAL SERIALIZATION

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//--------------------------------------------------------------------------------------------------------------------

// GOOGLE OAUTH 20

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/account',
  userProfileUrl: 'https://www.googleapis.com/oauth2/v3/userinfo'
}, function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({
    googleId: profile.id
  }, function(err, user) {
    return cb(err, user);
  });
}));

//--------------------------------------------------------------------------------------------------------------------

// FACEBOOK OAUTH2

passport.use(new FacebookStrategy({
    clientID: process.env.FB_APP_ID,
    clientSecret: process.env.FB_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/account",
    enableProof: true,
    profileFields: ['id', 'displayName', 'email'] // photos can also be added!
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({
      facebookId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));


//--------------------------------------------------------------------------------------------------------------------

// ROUTES


app.get('/auth/facebook',
  passport.authenticate('facebook', {
    authType: 'reauthenticate',
    scope: ['user_friends']
  })
);

app.get('/auth/facebook/account',
  passport.authenticate('facebook', {
    failureRedirect: '/sign-in'
  }),
  function(req, res) {
    res.redirect('/payment');
  });

app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile']
  })
);

app.get('/auth/google/account',
  passport.authenticate('google', {
    failureRedirect: '/sign-in'
  }),
  function(req, res) {
    res.redirect('/payment');
  });

app.get('/sign-up', function(req, res) {
  res.render('sign-up');
});

app.post('/sign-up', function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err) {
    if (err) {
      console.log(err);
      res.redirect('/sign-up')
    } else {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/sign-in');
      });
    }
  });
});

app.get('/account', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('payment');
  } else {
    res.redirect('/sign-in');
  }
});

app.get('/sign-in', function(req, res) {
  res.render('sign-in');
});

app.post('/sign-in', function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) { //This creates a log in session
    if (err) {
      console.log(err);
      res.redirect('/sign-in');
    } else {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/account');
      });
    }
  });
});

app.get('/sign-out', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/payment', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('payment');
  } else {
    res.redirect('/sign-in');
  }
});


// -----------------------------------------------------------------------------------

app.get('/', function(req, res) {
  const item = collections.array();
  res.render('index', {
    items: item
  });
});

app.post('/', function(req, res) {
  const firstName = req.body.firstName;
  const email = req.body.email;

  const data = {
    members: [{
      email_address: email,
      status: 'subscribed',
      merge_fields: {
        FNAME: firstName
      }
    }]
  };

  const jsonData = JSON.stringify(data);

  var url = 'https://us10.api.mailchimp.com/3.0/lists/eaa3903e59'
  var options = {
    method: 'POST',
    auth: 'nob:46969607b2e3dfc293dfd5ca618f8d85-us10'
  }

  const request = https.request(url, options, function(response) {

    if (response.statusCode === 200) {
      console.log("success");
    } else {
      console.log("error");
    }

    console.log(response.statusCode);
    // response.on('data', function (data) {
    //   console.log(JSON.parse(data));
    // })
  });

  request.write(jsonData);
  request.end();

  res.redirect('/')
});

app.get('/blog', function(req, res) {
  res.render('blog');
});

app.get('/contacts', function(req, res) {
  res.render('contacts');
});

app.get('/store', function(req, res) {
  const item = collections.array();

  let accessory = item.filter(item =>
    item.tag === 'accessory'
  );

  let shoe = item.filter(item =>
    item.tag === 'shoe'
  );

  let bag = item.filter(item =>
    item.tag === 'bag'
  );

  let shirt = item.filter(item =>
    item.tag === 'shirt'
  );

  let jean = item.filter(item =>
    item.tag === 'jean'
  );

  let jacket = item.filter(item =>
    item.tag === 'jacket'
  );

  let sweatPant = item.filter(item =>
    item.tag === 'sweat pant'
  );

  const categoryArray = {
    accessory: accessory.length,
    bag: bag.length,
    jean: jean.length,
    jacket: jacket.length,
    shirt: shirt.length,
    shoe: shoe.length,
    sweatPant: sweatPant.length
  }

  // categoryArray: categoryArray,
  res.render('store', {
    items: item,
    categoryArray: categoryArray
  });
});

app.post('/store', function(req, res) {

  var searchName = lodash.lowerCase(req.body.search);

  const parameter = new Parameter({
    paramName: searchName
  });

  // if (searchName === 'canvas' || searchName === 'broques' || searchName === 'shoes' || searchName === 'can' || searchName === 'footware' || searchName === 'boot' || searchName === 'sneaker') {
  //   const input = 'shoe';
  //
  //   const query = new Query({
  //     queryName: input
  //   })
  //
  //   query.save(function(err) {
  //     if (!err) {
  //       console.log('Search query has been saved');
  //     }
  //   });
  // } else if (searchName === 'hand bag' || searchName === 'back pack' || searchName === 'bags') {
  //   const input = 'bag';
  //
  //   const query = new Query({
  //     queryName: input
  //   });
  //
  //   query.save(function(err) {
  //     if (!err) {
  //       console.log('Search query has been saved');
  //     }
  //   });
  // } else {
  //   const query = new Query({
  //     queryName: searchName
  //   });
  //
  //   query.save(function(err) {
  //     if (!err) {
  //       console.log('Search query has been saved');
  //     }
  //   });
  // }

  Parameter.find({}, {
    '_id': 0,
    'paramName': 1
  }, function(err, found) {
    let mon = found.map(function(item) {
      return item.paramName;
    });

    if (mon.includes(searchName)) {
      console.log('yes');
    } else {
      console.log('no');
      parameter.save(function(err) {
        if (!err) {
          console.log('param saved');
        }
      });
    }
  });

  // console.log(searchName);

  res.redirect('/search/' + searchName);
});

app.get('/search/:key', function(req, res) {

  const item = collections.array();

  var key = req.params.key

  Parameter.find({
    'paramName': key
  }, function(err, foundParam) {
    if (foundParam) {
      foundParam.forEach((search) => {
        const queryString = search.paramName;

        let tag = item.filter(item =>
          item.tag === queryString
        );

        let accessory = item.filter(item =>
          item.tag === 'accessory'
        );

        let shoe = item.filter(item =>
          item.tag === 'shoe'
        );

        let bag = item.filter(item =>
          item.tag === 'bag'
        );

        let shirt = item.filter(item =>
          item.tag === 'shirt'
        );

        let jean = item.filter(item =>
          item.tag === 'jean'
        );

        let jacket = item.filter(item =>
          item.tag === 'jacket'
        );

        let sweatPant = item.filter(item =>
          item.tag === 'sweat pant'
        );

        const categoryArray = {
          accessory: accessory.length,
          bag: bag.length,
          jean: jean.length,
          jacket: jacket.length,
          shirt: shirt.length,
          shoe: shoe.length,
          sweatPant: sweatPant.length
        }

        if (queryString === key) {
          console.log(key);
          res.render('collections', {
            items: tag,
            categoryArray: categoryArray,
            query: lodash.capitalize(queryString)
          });
        }
      });

    }
  });

});

app.get('/collections', function(req, res) {
  const item = collections.array();

  Query.find({}, function(err, foundQuery) {
    if (err) {
      console.log(err);
    } else {

      let accessory = item.filter(item =>
        item.tag === 'accessory'
      );

      let shoe = item.filter(item =>
        item.tag === 'shoe'
      );

      let bag = item.filter(item =>
        item.tag === 'bag'
      );

      let shirt = item.filter(item =>
        item.tag === 'shirt'
      );

      let jean = item.filter(item =>
        item.tag === 'jean'
      );

      let jacket = item.filter(item =>
        item.tag === 'jacket'
      );

      let sweatPant = item.filter(item =>
        item.tag === 'sweat pant'
      );

      const categoryArray = {
        accessory: accessory.length,
        bag: bag.length,
        jean: jean.length,
        jacket: jacket.length,
        shirt: shirt.length,
        shoe: shoe.length,
        sweatPant: sweatPant.length
      }

      if (foundQuery.length > 0) {
        foundQuery.forEach((search) => {
          const queryString = search.queryName;

          let tag = item.filter(item =>
            item.tag === queryString
          );

          res.render('collections', {
            items: tag,
            categoryArray: categoryArray,
            query: lodash.capitalize(queryString)
          });
        });
      } else {
        res.render('collections', {
          items: item,
          categoryArray: categoryArray,
          query: 'Collections'
        });
      }

    }

    Query.deleteMany({}, function(err) {
      if (!err) {
        console.log('Search query deleted!');
      }
    });
  });

});

app.get('/store/:categories', function(req, res) {
  const categoryName = req.params.categories;
  const item = collections.array();

  let newCollection = item.map(function(item) {
    return item.tag;
  });

  let unique = [...new Set(newCollection)]; // GETS UNIQUE VALUES FROM AN ARRAY WITH SEVERAL INPUTS

  Query.find({}, function(err, foundQuery) {

    if (err) {
      console.log(err);
    } else {
      if (foundQuery) {

        foundQuery.forEach((search) => {
          const queryString = search.queryName;

          let tag = item.filter(item =>
            item.tag === queryString
          );

          res.render('collections', {
            items: tag,
            query: lodash.capitalize(queryString)
          });
        });

        Query.deleteMany({}, function(err) {
          if (!err) {
            console.log('Search query deleted!');
          }
        });
      }

      if (categoryName) {
        const testName = test.test();

        testName.forEach((test, i) => {
          var requiredName = test.name;

          // console.log(categoryName);
          if (requiredName === categoryName) {
            var sRequiredName = Inflector.singularize(requiredName);
            // console.log(item);
            // console.log(sRequiredName);
            let tag = item.filter(item =>
              item.tag === sRequiredName
            );

            let accessory = item.filter(item =>
              item.tag === 'accessory'
            );

            let shoe = item.filter(item =>
              item.tag === 'shoe'
            );

            let bag = item.filter(item =>
              item.tag === 'bag'
            );

            let shirt = item.filter(item =>
              item.tag === 'shirt'
            );

            let jean = item.filter(item =>
              item.tag === 'jean'
            );

            let jacket = item.filter(item =>
              item.tag === 'jacket'
            );

            let sweatPant = item.filter(item =>
              item.tag === 'sweat pant'
            );

            const categoryArray = {
              accessory: accessory.length,
              bag: bag.length,
              jean: jean.length,
              jacket: jacket.length,
              shirt: shirt.length,
              shoe: shoe.length,
              sweatPant: sweatPant.length
            }

            // categoryArray: categoryArray,

            res.render('collections', {
              items: tag,
              categoryArray: categoryArray,
              query: Inflector.pluralize(sRequiredName)
            });
          }
        });
      }

    }

  });

});

app.get('/product_images/:product', function(req, res) {

  const productName = req.params.product;
  var item = collections.array();

    item.forEach((item, i) => {
      var requiredName = item.name;
      if (requiredName === productName) {
        var productItem = item;
        var productTag = item.tag;
        //' set the original array'
        item = collections.array();
        // console.log(item);

        let tag = item.filter(item =>
          item.tag === productTag
        );

        res.render('product_images', {
          items: tag,
          productItem: productItem,
          product: productName
        });
      }

    });

});

// app.get('/product_images/:product', function(req, res) {
//
//   const productName = req.params.product;
//   const item = collections.array();
//
//   console.log(productName);
//
//   const testName = test.test();
//
//   testName.forEach((test, i) => {
//     var requiredName = test.name;
//
//     if (requiredName === productName) {
//       var sRequiredName = Inflector.singularize(requiredName);
//
//       let tag = item.filter(item =>
//         item.tag === sRequiredName
//       );
//
//       // console.log(tag);
//
//       res.render('product_images', {
//         items: tag,
//         query: sRequiredName,
//         product: productName
//       });
//     }
//   });
//
// });

app.post('/product_images/:product', function(req, res) {
  var productColor = req.body.color;
  var productNumber = req.body.number;
  var productName = req.body.prodName;
  // var productName = req.body.prodImg;


  const item = collections.array();

  let tag = item.find(function (item) {
    return item.name === productName;
  }   // This is just the item tag change it later to the item name;
  );

  const product = new Product({
    productName: tag.name,
    productNumber: req.body.number,
    productColor: req.body.color,
    productPrice: tag.price,
    productImage: tag.image
  });

  Product.findOne({productName: product.productName}, function (err, resp) {
    if(!err){
      if (!resp) {

        product.save(function(err) {
          if (err) {
            console.log(err);
          }
        });

          res.redirect('/store');
      } else {

        Product.deleteOne({productName: product.productName}, function (err, delProduct) {
          if (!err) {
            if (delProduct) {
              product.save(function(err) {
                if (err) {
                  console.log(err);
                }
              });
            }
          }
        });
        res.redirect('/store');
      }
    }
  });
});

app.get('/cart', function (req, res) {
  Product.find({}, function (err, foundProduct) {

    if (err) {
      console.log(err);
    }else {
      const length = foundProduct.length;
        res.render('cart', {product: foundProduct, productNumber: length});
    }
  });

});

// app.post('/cart', function (req, res) {
//   var newNumber = req.body.number;
//   var itemName = req.body.itemName;
//
//   itemName.forEach((item, i) => {
//     console.log(item);
//     Product.find({productName: item}, function (err, foundProduct) {
//       if (err) {
//         console.log(err);
//       }else {
//         if (foundProduct) {
//           // console.log(foundProduct);
//           Product.updateOne({productName: foundProduct}, {productNumber: newNumber}, function (err) {
//               if (err) {
//                 console.log(err);
//               } else {
//                 console.log(" updated!");
//               }
//             }
//           );
//
//         }
//
//       }
//   });
//   });
//
//
// });

app.post('/delete', function (req, res) {
  const checkedId = req.body.checkbox;

  Product.findByIdAndRemove(checkedId, function (err) {
    if (!err) {
      console.log(' item has been deleted');
    }
    res.redirect('/cart');
  })
})

app.listen(3000, function() {
  console.log('server running at port 3000');
});
