var express = require("express");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");

var index = require("./routes/index");
var users = require("./routes/users");

var app = express();

require('dotenv').config({path: "config.env"});

var port = process.env.PORT || 3000;
var dbHost = process.env.DBHOST || "localhost";
var dbUser = process.env.DBUSERNAME || "cis3750_node";
var dbPass = process.env.DBPASSWORD || "team31";
var dbName = process.env.DBNAME || "cis3750";




// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));


var mysql = require("mysql");
//Database connection
app.use(function(req, res, next){
	res.locals.connection = mysql.createConnection({
		host     : dbHost,
		user     : dbUser,
		password : dbPass,
		database : dbName
	});
	res.locals.connection.connect();
	next();
});




app.use("/", index);
app.use("/v1/users", users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;


app.listen(port);
console.log("Magic happens on port " + port);
