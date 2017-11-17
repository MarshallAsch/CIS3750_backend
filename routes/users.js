var express = require("express");
var router = express.Router();



var validate = function (req, res, next){


    //var tokenID = req.body["tokenID"];
    var admin = req.app.get("admin");


    var tokenID = req.get("X-API-KEY");


    res.setHeader('Content-Type', 'application/json');


    if (tokenID === undefined) {
        res.status(401);
        res.send({"status": 401, "error": {message: "You need to authenticate yourself with the X-API-KEY header", code:"auth/argument-error"}, "response": null});
    }


    admin.auth().verifyIdToken(tokenID) .then(function(decodedToken) {
      var uid = decodedToken.uid;
      console.log(decodedToken);


      req.uid = uid;

      res.locals.connection.query("SELECT supportWorker, admin from users where ID = ? ",uid, function (error, results, fields) {
          if (error) {
              res.status(500);
              res.send({"status": 500, "error": {message: error.sqlMessage, errorCode: error}, "response": results});
          }else {

              req.isAdmin = results.admin || false;
              req.isSupportWorker = results.supportWorker || false;
              next();

          }
      });
    }).catch(function(error) {
      // Handle error

      //this captures the firebase error
      console.log("error: " + error);

      res.status(401);
      res.send({"status": 401, "error": error, "response": null});

    });
};


router.use(validate);




router.get("/", function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');


    // add something here to check if the authenticated user has permisseions to get that users data

    var uid = res.uid;
    var limit = res.query.limit || 20;
    var offset = res.query.offset || 0;

    if (limit > 50) {
        limit = 50;
    }
    else if (limit < 1) {
        limit = 1;
    }

    if (offset < 0) {
        offset = 0;
    }


    if (res.isAdmin) {
        res.locals.connection.query("SELECT ID,supportWorker,admin,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users limit ?, ?", [offset, limit], function (error, results, fields) {
            if (error) {
                res.status(500);
                res.send({"status": 500, "error": {message: error.sqlMessage, errorCode: error}, "response": results});
            }
            res.send({"status": 200, "error": null, "response": results});
        });
    }
    else if (res.isSupportWorker) {

        //can see support workers, admins and clients that they are responcible for
        res.locals.connection.query("SELECT ID,supportWorker,admin,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where admin=true or supportWorker=true or ID in (select client from clientMappings where supportWorker = ? ) limit ?, ?", [uid, offset, limit], function (error, results, fields) {
            if (error) {
                res.status(500);
                res.send({"status": 500, "error": {message: error.sqlMessage, errorCode: error}, "response": results});
            }
            res.send({"status": 200, "error": null, "response": results});
        });
    }
    else {

        //can see your support workers, anyone who is observing you and anyone who you are observing
        res.locals.connection.query("SELECT ID,supportWorker,admin,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where or ID in (select supportWorker from clientMappings where client = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?) limit ?, ?", [uid, uid, uid, offset, limit], function (error, results, fields) {
            if (error) {
                res.status(500);
                res.send({"status": 500, "error": {message: error.sqlMessage, errorCode: error}, "response": results});
            }
            res.send({"status": 200, "error": null, "response": results});
        });
    }
});


router.get("/:userID", function(req, res, next) {

 res.setHeader('Content-Type', 'application/json');
    var userID = req.params.userID;

// add something here to check if the authenticated user has permisseions to get that users data

    res.locals.connection.query("SELECT * from users where ID = ? ",userID, function (error, results, fields) {
        if (error) {
            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
        }else {
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });

});


router.post("/", function(req, res, next) {

    var uid = req.uid;

    res.setHeader('Content-Type', 'application/json');

    var data =
    {
        ID: uid,
        firstname:      req.body["first_name"],
        lastname:       req.body["last_name"],
        birthday:       req.body["birthday"],
        email:          req.body["email"],
        enabled:        true,
        displayName:    req.body["display_name"],
        phoneNumber:    req.body["phone_number"],
        recoveryQ1:     req.body["recovery_q1"],
        recoveryA1:     req.body["recovery_a1"],
        recoveryQ2:     req.body["recovery_q2"],
        recoveryA2:     req.body["recovery_a2"]
    };

    // add the user to the database
    res.locals.connection.query("INSERT into users set ?", data, function (error, results, fields) {
        if (error) {
            res.status(500);
            res.send({"status": 500, "error": {message: error.sqlMessage, errorCode: error}, "response": results});
        } else {
            res.status(201);
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



router.delete("/:userID", function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');


    var tokenID = req.body["tokenID"];
    var admin = req.app.get("admin");

    var userID = req.params.userID

    res.setHeader('Content-Type', 'application/json');



    admin.auth().verifyIdToken(tokenID).then(function(decodedToken) {
    var uid = decodedToken.uid;


    //make sure that the ID of the user being deleted matched that of the user
    //doing the deleteing or that the deleter is an admin

    if (userID === uid) {

        //delete their own account
        res.locals.connection.query("delete from users where ID = ?",[userID], function (error, results, fields) {
            if (error)
            {
                res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
            } else {
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        });
    }
    else {
        //check if it is an admin

        res.locals.connection.query("select count(*) AS 'count' from users where ID = ? AND admin='true'",[tokenID], function (error, results, fields) {
            if (error)
            {
                res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
            } else {


                if (results.count == 1) {
                    console.log("Admin is doing the deleteing");

                    res.locals.connection.query("delete from users where ID = ?",[userID], function (error, results, fields) {
                        if (error)
                        {
                            res.send(JSON.stringify({"status": 500, "error": error, "response": results}));
                        } else {

                            admin.auth().deleteUser(userID)
                              .then(function() {
                                console.log("Successfully deleted user");
                                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
                              })
                              .catch(function(error) {
                                console.log("Error deleting user:", error);
                              });


                        }
                    });

                }
                else {
                    //does not have permission to delete this user
                    res.status(403)
                    res.send(JSON.stringify({"status": 403, "error": {message: "You do not have permission to delete this user", errorCode: null}}));
                }

            }
        });


    }



 }).catch(function(error) {
   // Handle error

   //this captures the firebase error
   console.log("error: " + error);

   res.status(400);
   res.send({"status": 400, "error": error, "response": null});

 });

});


module.exports = router;
