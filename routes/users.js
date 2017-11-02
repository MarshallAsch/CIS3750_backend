var express = require("express");
var router = express.Router();


/* GET users listing. */
router.get("/", function(req, res, next) {
    res.locals.connection.query("SELECT * from users", function (error, results, fields) {
        if (error) res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
    });
});


/* GET users listing. */
router.get("/:userID", function(req, res, next) {

var userID = req.params.userID;
    res.locals.connection.query("SELECT * from users where ID = ? ",userID, function (error, results, fields) {
        if (error)
        {
            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        }else {
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });

});

/* GET users listing. */
router.post("/", function(req, res, next) {
//	res.send("POST request" + req.params.id + "--" + req.param('name'));

var date = new Date();
    var data =
    {
    firstname:req.param("fname"),
    lastname:req.param("lname"),
    birthday: req.param("bday"),
    email:req.param("email"),
    enabled: true,
    createTime: date.getFullYear() + "-" + (date.getMonth() + 1 )+ "-" + date.getDate(),
    displayName: req.param("displayName"),
    phoneNumber: req.param("phoneNumber"),
    recoveryQ1:req.param("recoveryQ1"),
    recoveryA1:req.param("recoveryA1"),
    recoveryQ2:req.param("recoveryQ2"),
    recoveryA2:req.param("recoveryA2"),
    };

    res.locals.connection.query("INSERT into users set ?", data, function (error, results, fields) {
        if (error)
        {
            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        } else {
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });
});


router.patch("/:userID", function(req, res, next) {
//	res.send("POST request" + req.params.id + "--" + req.param('name'));

var userID = req.params.userID
    var data =
    {
    firstname:req.body.fname,
    lastname:req.body.lname,
    birthday: req.body.bday,
    //email:req.body.email,
    enabled: true,
    displayName: req.body.displayName,
    phoneNumber: req.body.phoneNumber,
    recoveryQ1:req.body.recoveryQ1,
    recoveryA1:req.body.recoveryA1,
    recoveryQ2:req.body.recoveryQ2,
    recoveryA2:req.body.recoveryA2,
    };

    res.locals.connection.query("UPDATE users set ? where ID = ?",[ data,userID], function (error, results, fields) {
        if (error)
        {
            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        } else {
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });
});



module.exports = router;
