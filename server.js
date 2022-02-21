// server.js
// where your node app starts

// init project
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
app.set('view engine', 'hbs');

// init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

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
      ("Earl Grey", "Lorem Ipsum", 13, FALSE, FALSE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png"), \
      ("Bishi Bashi", "Lorem Ipsum", 15, TRUE, FALSE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png"), \
      ("CNY Deal!", "Lorem Ipsum", 5, FALSE, TRUE, "https://i.ibb.co/RD2Q8bp/Bubble-Tea.png")'
    );
  });
}

// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(() => {
  if (!exists) {
    createUsers()
    createProducts()
  } else {
    console.log('Database ready to go!');
  }
});

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

// endpoint to get all the dreams in the database
app.get("/getDreams", (request, response) => {
  db.all("SELECT * from Dreams", (err, rows) => {
    response.send(JSON.stringify(rows));
  });
});

app.get("/products", (request, response) => {
  db.each("SELECT * from Products", (err, row) => {
    response.sendFile(`${__dirname}/views/products.html`, )
  })
})

// endpoint to add a dream to the database
app.post("/addDream", (request, response) => {
  console.log(`add to dreams ${request.body.dream}`);

  // DISALLOW_WRITE is an ENV variable that gets reset for new projects
  // so they can write to the database
  if (!process.env.DISALLOW_WRITE) {
    const cleansedDream = cleanseString(request.body.dream);
    db.run(`INSERT INTO Dreams (dream) VALUES (?)`, cleansedDream, error => {
      if (error) {
        response.send({ message: "error!" });
      } else {
        response.send({ message: "success" });
      }
    });
  }
});

// endpoint to clear dreams from the database
app.get("/clearDreams", (request, response) => {
  // DISALLOW_WRITE is an ENV variable that gets reset for new projects so you can write to the database
  if (!process.env.DISALLOW_WRITE) {
    db.each(
      "SELECT * from Dreams",
      (err, row) => {
        console.log("row", row);
        db.run(`DELETE FROM Dreams WHERE ID=?`, row.id, error => {
          if (row) {
            console.log(`deleted row ${row.id}`);
          }
        });
      },
      err => {
        if (err) {
          response.send({ message: "error!" });
        } else {
          response.send({ message: "success" });
        }
      }
    );
  }
});

// helper function that prevents html/css/script malice
const cleanseString = function(string) {
  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// listen for requests :)
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});