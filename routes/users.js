var express = require("express");
var router = express.Router();


/* GET users listing. */
router.get("/", function(req, res, next) {
 res.setHeader('Content-Type', 'application/json');
    res.locals.connection.query("SELECT * from users", function (error, results, fields) {
        if (error) {
            res.send({"status": 500, "error": error, "response": results});
        }
        res.send({"status": 200, "error": null, "response": results});
    });
});


/* GET users listing. */
router.get("/:userID([0-9]+)", function(req, res, next) {

 res.setHeader('Content-Type', 'application/json');
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


    res.setHeader('Content-Type', 'application/json');
    var date = new Date();

    var id = Math.random().toString(); //so something to get the firebase UID here from the token


    var data =
    {
        ID: id,
        firstname:req.param("first_name"),
        lastname:req.param("last_name"),
        birthday: req.param("birthday"),
        email:req.param("email"),
        enabled: true,
        displayName: req.param("display_name"),
        phoneNumber: req.param("phone_number"),
        recoveryQ1:req.param("recovery_q1"),
        recoveryA1:req.param("recovery_a1"),
        recoveryQ2:req.param("recovery_q2"),
        recoveryA2:req.param("recovery_a2"),
    };

    res.locals.connection.query("INSERT into users set ?", data, function (error, results, fields) {
        if (error)
        {
            res.send({"status": 500, "error": error, "response": results});
        } else {
            res.send({"status": 200, "error": null, "response": results});
        }
    });
});


router.patch("/:userID([0-9]+)", function(req, res, next) {

 res.setHeader('Content-Type', 'application/json');

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



router.delete("/:userID([0-9]+)", function(req, res, next) {

 res.setHeader('Content-Type', 'application/json');
    var userID = req.params.userID

    res.locals.connection.query("delete from users where ID = ?",[userID], function (error, results, fields) {
        if (error)
        {
            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        } else {
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });
});


module.exports = router;
