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
const nodemailer = require('nodemailer');

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

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false,
  },
  password: String,
  googleId: String,
  product: [productSchema]
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
    res.redirect('/');
    // res.redirect(req.session.returnTo || '/');
    // delete req.session.returnTo;
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
    res.redirect('/');
    // res.redirect(req.session.returnTo || '/');
    // delete req.session.returnTo;
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
        res.redirect(req.session.returnTo || '/');
        delete req.session.returnTo;
      });
    }
  });
});

app.get('/sign-out', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/account', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('account');
  } else {
    req.session.returnTo = req.originalUrl;
    res.redirect('/sign-in');
  }
});

app.get('/payment', function(req, res) {
  if (req.isAuthenticated()) {

    User.findById(req.user, function(err, found) {
      if (!err) {
        if (found) {
          const userProduct = found.product;
          const length = userProduct.length;

          res.render('payment', {
            product: userProduct,
            productNumber: length
          });
        }
      }
    });

  } else {
    res.redirect('/sign-in');
  }
});

app.post('/payment', function(req, res) {

  if (req.isAuthenticated()) {

      User.findById(req.user, function(err, found) {
        if (!err) {
          if (found) {

            const userProduct = found.product;

            req.session.length = userProduct.length;
          }
          else {
            res.redirect('/sign-in');
          }
        }
      }
    );

     var number = req.session.length;
     var totalAmount = req.body.grandTotalValue;

     console.log(totalAmount);

// OK NODE MAILER

// async..await is not allowed in global scope, must use a wrapper
async function main() {
  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", //host for gmail
    port: 465,
    secure: true, // true for 465(gmail), false for other ports
    auth: {
      user: process.env.GMAIL_ID, // generated gmail account
      pass: process.env.GMAIL_PASS, // generated gmail password
    },
  });

  // send mail with defined transport object
  let info = await transporter.sendMail({
    from: process.env.GMAIL_ID, // sender address
    to: req.body.emailAddress, // list of receivers
    bcc: 'nwalobright@gmail.com',
    subject: "SWD Payment Notification", // Subject line
    html: "<b>Hello customer</b>", // html body
    html: `</p>You have checked out ${number} item(s) at a cost of ${totalAmount} <p>`, // html body
    envelope: {
              from: process.env.GMAIL_ID,
              to: req.body.emailAddress,
              bcc: 'nwalobright@gmail.com'
            }
  });

  console.log("Message sent: %s", info.response);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

}

main().catch(console.error);

res.send('<h1>Your check out is successful, visit our store for more collections!</h1>');


  // User.findById(req.user, function(err, found) {
  //   if (!err) {
  //     if (found) {
  //
  //       const userProduct = found.product;
  //       const length = userProduct.length;
  //
  //       // var mailOptions = {
  //       //   from: process.env.GMAIL_ID,
  //       //   to: req.body.emailAddress,
  //       //   bcc: process.env.GMAIL_ID,
  //       //   subject: 'SWD payment notification',
  //       //   text: {
  //       //     buyerID: {
  //       //       _id: found._id,
  //       //       firstName: req.body.firstName,
  //       //       lastName: req.body.lastName,
  //       //       username: req.body.username,
  //       //       emailAddress: req.body.emailAddress,
  //       //       address: req.body.address,
  //       //       phone: req.body.phone,
  //       //       state: req.body.state,
  //       //       zipcode: req.body.zip,
  //       //       paymentMethod: req.body.paymentMethod
  //       //     },
  //       //     items: length
  //       //   },
  //       //   envelope: {
  //       //     from: process.env.GMAIL_ID,
  //       //     to: req.body.emailAddress,
  //       //   }
  //       // };
  //
  //       // async..await is not allowed in global scope, must use a wrapper
  //       async function main() {
  //         // Generate test SMTP service account from ethereal.email
  //         // Only needed if you don't have a real mail account for testing
  //         let testAccount = await nodemailer.createTestAccount();
  //
  //         // create reusable transporter object using the default SMTP transport
  //         let transporter = nodemailer.createTransport({
  //           host: "smtp.gmail.com", //host for gmail
  //           port: 465,
  //           secure: true, // true for 465(gmail), false for other ports
  //           auth: {
  //             user: process.env.GMAIL_ID, // generated gmail account
  //             pass: process.env.GMAIL_PASS, // generated gmail password
  //           },
  //         });
  //
  //         // send mail with defined transport object
  //         let info = await transporter.sendMail({
  //           from: process.env.GMAIL_ID, // sender address
  //           to: req.body.emailAddress, // list of receivers
  //           bcc: 'nwalobright@gmail.com',
  //           subject: "SWD Payment Notification", // Subject line
  //           html: "<b>Hello customer</b>", // html body
  //           text: `You have checked out ${length} item(s)`, // plain text body
  //           envelope: {
  //             from: process.env.GMAIL_ID,
  //             to: 'nwalobright@gmail.com',
  //           }
  //         });
  //
  //         console.log("Message sent: %s", info.response);
  //         // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
  //
  //       }
  //
  //       main().catch(console.error);
  //
  //     }
  //   }
  // });

  } else {
    res.redirect('/sign-in');
    console.log(' no user found');
  }

});

// -----------------------------------------------------------------------------------

app.get('/', function(req, res) {
  const item = collections.array();


  Product.find({}, function(err, foundProduct) {

    if (err) {
      console.log(err);
    } else {
      const length = foundProduct.length;
      res.render('index', {
        items: item,
        productNumber: length
      });
    }
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

  Product.find({}, function(err, foundProduct) {

    if (err) {
      console.log(err);
    } else {
      const length = foundProduct.length;
      res.render('store', {
        items: item,
        categoryArray: categoryArray,
        productNumber: length
      });
    }
  });

});

app.post('/store', function(req, res) {

  var searchName = lodash.lowerCase(req.body.search);

  const parameter = new Parameter({
    paramName: searchName
  });

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
      parameter.save(function(err) {
        if (!err) {
          console.log('param saved');
        }
      });
    }
  });

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

          Product.find({}, function(err, foundProduct) {

            if (err) {
              console.log(err);
            } else {
              const length = foundProduct.length;

              res.render('collections', {
                items: tag,
                categoryArray: categoryArray,
                query: lodash.capitalize(queryString),
                productNumber: length
              });
            }
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

          Product.find({}, function(err, foundProduct) {

            if (err) {
              console.log(err);
            } else {
              const length = foundProduct.length;

              res.render('collections', {
                items: tag,
                categoryArray: categoryArray,
                query: lodash.capitalize(queryString),
                productNumber: length
              });
            }
          });
        });
      } else {
        Product.find({}, function(err, foundProduct) {

          if (err) {
            console.log(err);
          } else {
            const length = foundProduct.length;

            res.render('collections', {
              items: item,
              categoryArray: categoryArray,
              query: 'Collections',
              productNumber: length
            });
          }
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

            Product.find({}, function(err, foundProduct) {

              if (err) {
                console.log(err);
              } else {
                const length = foundProduct.length;

                res.render('collections', {
                  items: tag,
                  categoryArray: categoryArray,
                  query: Inflector.pluralize(sRequiredName),
                  productNumber: length
                });
              }
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

      let tag = item.filter(item =>
        item.tag === productTag
      );

      let color = item.find(item =>
        item.name === productName
      );

      Product.find({}, function(err, foundProduct) {

        if (err) {
          console.log(err);
        } else {
          const length = foundProduct.length;

          res.render('product_images', {
            items: tag,
            productItem: productItem,
            product: productName,
            color: color.details.color,
            productNumber: length
          });

        }
      });
    }

  });

});

app.post('/product_images/:product', function(req, res) {

  var productColor = req.body.color;
  var productNumber = req.body.number;
  var productName = req.body.prodName;
  // var productName = req.body.prodImg;

  const item = collections.array();

  let tag = item.find(function(item) {
      return item.name === productName;
    } // This is just the item tag change it later to the item name;
  );

  const product = new Product({
    productName: tag.name,
    productNumber: req.body.number,
    productColor: req.body.color,
    productPrice: tag.price,
    productImage: tag.image
  });

  if (req.isAuthenticated()) {

    User.findById(req.user, function(err, found) {
      if (!err) {
        if (found) {

          const userId = found._id;

          Product.findOne({
            productName: product.productName
          }, function(err, resp) {
            if (!err) {
              if (!resp) {

                product.save(function(err) {
                  if (err) {
                    console.log(err);
                  } else {
                    Product.find({}, function(err, found) {
                      console.log(found);
                      User.updateOne({
                        _id: userId
                      }, {
                        product: found
                      }, function(err) {
                        if (err) {
                          console.log('error');
                        } else {
                          console.log('updated');
                          res.redirect('/cart');
                        }
                      });
                    });
                  }
                });

                // res.redirect('/cart');
              } else {

                Product.deleteOne({
                  productName: product.productName
                }, function(err, delProduct) {
                  if (!err) {
                    if (delProduct) {
                      product.save(function(err) {
                        if (err) {
                          console.log(err);
                        } else {
                          Product.find({}, function(err, found) {
                            console.log(found);
                            User.updateOne({
                              _id: userId
                            }, {
                              product: found
                            }, function(err) {
                              if (err) {
                                console.log('error');
                              } else {
                                console.log('updated');
                                res.redirect('/cart');
                              }
                            })
                          });
                        }
                      });
                    }
                  }
                });
                // res.redirect('/cart');
              }
            }
          });

        }
      }
    });

  } else {

    product.save(function(err) {
      req.session.returnTo = '/cart';
      console.log(req.session.returnTo);
      if (!err) {
        res.redirect('/sign-in');
      }
    });
  }

});

app.get('/cart', function(req, res) {

  User.findById(req.user, function(err, found) {
    if (found) {
      var foundId = found._id;
      Product.find({}, function(err, found) {
        User.updateOne({
          _id: foundId
        }, {
          product: found
        }, function(err) {
          if (err) {
            console.log('error');
          } else {
            const userProduct = found;

            if (err) {
              console.log(err);
              // res.redirect('/sign-in')
            } else {
              const length = userProduct.length;
              res.render('cart', {
                product: userProduct,
                productNumber: length
              });
            }
          }
        });
      });

    } else {
      req.session.returnTo = req.originalUrl;
      res.redirect('/sign-in');
    }

  });

});

app.post('/delete', function(req, res) {

  const checkedId = req.body.checkbox;

  Product.findByIdAndRemove(checkedId, {
    useFindAndModify: false
  }, function(err) {
    if (err) {
      console.log(err);
    }
  });

  User.findOneAndUpdate({
    _id: req.user
  }, {
    $pull: {
      product: {
        _id: checkedId
      }
    }
  }, {
    useFindAndModify: false
  }, function(err, found) {

    if (err) {
      console.log(err);
    } else {
      console.log('item has been deleted');
      res.redirect('/cart');
    }

  });
})

app.listen(8800, function() {
  console.log('server running at port 8800');
});