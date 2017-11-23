var express = require("express");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var http = require("http");
var admin = require("firebase-admin");
var mysql = require("mysql");

var index = require(__dirname + "/routes/index");
var users = require(__dirname + "/routes/users");
var schedules = require(__dirname + "/routes/schedules");
var supportWorker = require(__dirname + "/routes/supportWorker");

var app = express();

require('dotenv').config({path: "config.env"});

// Load the values from the environment variables
var port = process.env.PORT || 3000;
var dbHost = process.env.DBHOST || "localhost";
var dbUser = process.env.DBUSERNAME || "cis3750_node";
var dbPass = process.env.DBPASSWORD || "team31";
var dbName = process.env.DBNAME || "cis3750";
var serviceAccount = process.env.FIREBASEACC || "cis3750team31-firebase-adminsdk-sm0bf-189b38796f.json";
var dbFire = process.env.FIREBASEDB || "https://cis3750team31.firebaseio.com";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: dbFire
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");
app.set("admin", admin);

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

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


// define the data route handlers
app.use("/", index);
app.use("/v1/users", users);
app.use("/v1/schedules", schedules);
app.use("/v1/supportworker", supportWorker);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error("Not Found");
    err.status = 404;
    next(err);
});

// capture all of the errors and resturn the error payload
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.send({"status": err.status || 500, "error": {message:  err.message || "Unknown Error", code: err.code || "err-unknown", error: err.error || err}, "response": null});

});

module.exports = app;

var server = http.createServer(app);

server.listen(port, 'localhost');
server.on('listening', function() {
    console.log('Express server started on port %s at %s', server.address().port, server.address().address);
});
