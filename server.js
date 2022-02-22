// server.js
// where your node app starts

// init project
const express = require("express");
const bodyParser = require("body-parser");
const expressLayouts = require('express-ejs-layouts');
const url = require("url")
const _ = require("lodash");

const app = express();
const fs = require("fs");
const req = require("express/lib/request");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.locals._ = _;

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

app.set('view engine', 'ejs');

app.locals.title = function(str){
  return _.startCase(_.camelCase(str))
};

app.use(expressLayouts);
app.set('layout', './layouts/main')

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(":memory:");

function bobaMess(str) {
  return str.replace(/[a-zA-Z]/g,function(c){return String.fromCharCode((c<="Z"?90:122)>=(c=c.charCodeAt(0)+13)?c:c-26);});
}

function createUsers() {
  db.run(
      "CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, password TEXT, name text)"
    );
  console.log("New table Users created!");

  // insert default users
  db.serialize(() => {
    db.run(
      'INSERT INTO Users (email, password, name) VALUES ("bobby@bbb.com", "OrfgOhooyrf", "Bobby Botten"), ("augustus_gloop@gmail.com", "VJnagVgAbj", "Augustus Gloop")'
    );
  });
}

function createProducts() {
  db.run(
      "CREATE TABLE Products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, description TEXT, price INTEGER, is_hidden INTEGER, is_special INTEGER, img_url TEXT)"
    );
  console.log("New table Products created!");

  // insert default users
  db.serialize(() => {
    db.run(
      'INSERT INTO Products (name, description, price, is_hidden, is_special, img_url) VALUES \
      ("earl_gray", "Lorem Ipsum", 13, FALSE, FALSE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png"), \
      ("bishi_bashi", "Lorem Ipsum", 15, TRUE, FALSE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png"), \
      ("cny_deal", "Lorem Ipsum", 5, FALSE, TRUE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png")'
    );
  });
}

function createReviews() {
  db.run(
    "CREATE TABLE Reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product TEXT, rating INTEGER, text TEXT, date INTEGER)"
  )

  db.serialize(() => {
    db.run(
      "INSERT INTO Reviews (user_id, product, rating, text, date) VALUES (1, 'earl_gray', 4, 'Not grey enough...', 1645470854)"
    )
  })

  console.log("New table Reviews created!");
}

function createOrders() {
  db.run(
    "CREATE TABLE Orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product TEXT, amount INTEGER, date INTEGER, finalized INTEGER)"
  )
}

function createPromos() {
  db.run(
    "CREATE TABLE Promos (code TEXT PRIMARY KEY UNIQUE, discount INTEGER)"
  )

  db.serialize(() => {
    db.run(
      "INSERT INTO Promos VALUES ('CNY', 20)"
    )
  })
}

// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(() => {
  if (!exists) {
    createUsers()
    createProducts()
    createReviews()
    createOrders()
    createPromos()
  } else {
    console.log('Database ready to go!');
  }
});

app.use(function(req, res, next) {
  res.locals.user_id = req.query.user_id
  res.locals.auth = req.query.auth
  res.locals.message = ""

  next();
})

const requireAuth = (req, res, next) => {
  if (req.query.user_id && req.query.auth == 1) {
    next()
  } else {
    res.render("/login", { message: "Please log in to continue." })
  }
}

function redirectAuthenticated(req, res, path, params) {
  const authParams = {
    "user_id": req.query.user_id,
    "auth": req.query.auth
  }

  return res.redirect(url.format({
    pathname: path,
    query: {
      ...authParams,
      ...params
    }
  }))
}

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  db.all("SELECT * from Products WHERE NOT is_hidden", (err, rows) => {
    response.render("index", { products: rows })
  })
});

app.get("/tea", (request, response) => {
  var teaName = request.query.name
  db.get(`SELECT * from Products WHERE name='${teaName}'`, (err, row) => {
    if (err) {
      return response.sendStatus(404)
    } else {
      db.all(`SELECT Reviews.*, Users.id, Users.name from Reviews INNER JOIN Users ON Users.id = Reviews.user_id WHERE product='${teaName}'`, (err, rows) => {
        return response.render("tea", { product: row, reviews: rows })
      })
    }
  })
})

app.get("/login", (request, response) => {
  if (request.query.email && request.query.password) {
    var hashedPassword = bobaMess(request.query.password)

    db.get(
      `SELECT * from Users WHERE email='${request.query.email}' AND password='${hashedPassword}'`,
      (err, row) => {
        if (!err && row) {
          return response.redirect(url.format({
            pathname: "/",
            query: {
              "user_id": row.id,
              "auth": 1
            }
          }))
        } else {
          return response.render("login", { message: "Login failed." })
        }
      }
    )
  } else {
    response.render("login", { message: "" })
  }
})

app.get("/forgot", (request, response) => {
  var email = request.query.email
  if (email) {
    db.get(`SELECT * from Users WHERE email='${email}'`, (err, row) => {
      if (!err && row) {
        return response.render("forgot", { message: "Password reset email sent!" })
      } else {
        return response.render("forgot", { message: `Could not find an accout with the email ${email}` })
      }
    })
  } else {
    return response.render("forgot", { message: "" })
  }
})

app.get("/register", (request, response) => {
  var email = request.query.email
  if (email && request.query.password && request.query.name) {
    db.get(`SELECT * from Users WHERE email='${email}'`, (err, row) => {
      if (!err && row) {
        return response.render("register", { message: "Email already registered!" })
      } else {
        var hashedPassword = bobaMess(request.query.password)
        db.run(
          `INSERT INTO Users (email, password, name) VALUES ('${email}', '${hashedPassword}', '${request.query.name}')`,
          function(err) {
            if (!err) {
              return response.redirect(url.format({
                pathname: "/",
                query: {
                  "user_id": this.lastID,
                  "auth": 1
                }
              }))
            } else {
              return response.render("register", { message: err.message })
            }
          }
        )
      }
    })
  } else {
    return response.render("register", { message: "Please fill in all form fields" })
  }
})

app.get("/review", requireAuth, (req, res) => {
  var action = req.query.action
  var user_id = req.query.user_id
  var product = req.query.product

  if (action === "add") {
    var rating = req.query.rating
    var text = req.query.text

    if (!product || !rating || !text) {
      return res.redirect("/")
    }

    db.run(
      `INSERT INTO Reviews (user_id, product, rating, text, date) \
      VALUES (${user_id}, '${product}', ${rating}, '${text}', ${Date.now()})`,
      function(err) {
        return redirectAuthenticated(req, res, "/tea", { "name": product })
      }
    )
  } else if (action === "del") {
    var review_id = req.query.review_id
    if (review_id) {
      db.run(
        `DELETE FROM Reviews WHERE id=${review_id}`, 
        function(err) {
          return redirectAuthenticated(req, res, "/tea", { "name": product })
        }
      )
    }
  } else {
    return res.sendStatus(400)
  }
})

app.get("/checkout", requireAuth, (req, res) => {
  return res.render("checkout", { name: req.query.name })
})

function getPromo(code) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * from Promos WHERE code='${code}'`, (err, row) => {
      if (err) {
        reject(err.message)
      } else {
        resolve(row)
      }
    })
  })
}

function getProduct(product_name) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * from Products WHERE name='${product_name}'`, (err, row) => {
      resolve(row)
    })
  })
}

function createOrder(user_id, product_name, price) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO Orders (user_id, product, amount, date, finalized) VALUES (${user_id}, '${product_name}', ${price}, ${Date.now()}, FALSE)`, function(err) {
      resolve(this.lastID)
    })
  })
}

app.get("/buy", requireAuth, async (req, res) => {
  var user_id = req.query.user_id
  var name = req.query.name
  var promo = req.query.promo

  var product = await getProduct(name)
  var price = product.price
  if (promo) {
    var promoDiscount = await getPromo(promo)
    price = Math.floor(((100 - promoDiscount.discount)/100) * price)
  }

  var orderId = await createOrder(user_id, name, price)
  
  return res.redirect(`/pay?order_id=${orderId}`)
})

app.get("/pay", (req, res) => {
  var order_id = req.query.order_id
  
  if (!order_id) {
    return res.redirect("/")
  }

  db.get(`SELECT * FROM Orders WHERE id=${order_id}`, function(err, row) {
    var message = ""
    if (req.query.card) {
      message = "Payment failed 😢"
    }
    return res.render("pay", { order: row, message: message })
  })
})

app.get("/finalize", (req, res) => {
  var order_id = req.query.order_id
  
  if (!order_id) {
    return res.redirect("/")
  }

  db.get(`SELECT * FROM Orders WHERE id=${order_id}`, function(err, row) {
    db.run(`UPDATE Orders SET finalized=TRUE WHERE id=${order_id}`, function(err_) {
      return res.render("finalize", { order: row })
    })
  })
})

if (!process.env.PORT) {
  process.env.PORT = 4000
}

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});