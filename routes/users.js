var express = require("express");
var router = express.Router();

var validate = function (req, res, next){
    var admin = req.app.get("admin");
    var tokenID = req.get("X-API-KEY");

    res.setHeader('Content-Type', 'application/json');

    if (tokenID === undefined) {

        var err = new Error("You need to authenticate yourself with the X-API-KEY header");
        err.status = 401;
        err.code = "auth/argument-missing";
        next(err);
    }

    admin.auth().verifyIdToken(tokenID) .then(function(decodedToken) {
      var uid = decodedToken.uid;
      console.log(decodedToken);

      req.uid = uid;

      res.locals.connection.query("SELECT userRole from users where ID = ? ",uid, function (error, results, fields) {
          if (error) {

              var err = new Error(error.sqlMessage);
              err.status = 500;
              err.code = error.error;
              err.error = error;
              next(err);
          }else if (results.length === 0) {
              var err = new Error("User does not exist, sign up for an account");
              err.status = 401;
              err.code = "auth/user-not-exists";
              next(err);

          } else {
              if ((results[0].role & 0x10)  !== 0) {
                  req.supportWorker  = true;
              }
              else {
                  req.supportWorker = false;
              }


              if ((results[0].role & 0x100)  !== 0) {
                  req.isAdmin  = true;
              }
              else {
                  req.isAdmin = false;
              }

              next();

          }
      });
    }).catch(function(error) {
      //this captures the firebase error
      console.log("error: " + error);

      var err = new Error(error.message);
      err.status = 401;
      err.code = error.code;
      err.error = error;
      next(err);

    });
};

router.get("/", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');

    var uid = req.uid;
    var limit = parseInt(req.query.limit, 10) || 20;
    var offset = parseInt(req.query.offset, 10) || 0;

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
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users limit ?, ?", [offset, limit], function (error, results, fields) {
            if (error) {

                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }

            var users = results;

            res.locals.connection.query("SELECT count(*) AS total from users", function (error, results, fields) {
                if (error) {

                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
            });
        });
    }
    else if (res.isSupportWorker) {

        //can see support workers, admins and clients that they are responcible for
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where admin = true or supportWorker = true or ID in (select client from clientMappings where supportWorker = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?) limit ?, ?", [uid, uid, uid, offset, limit], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }

            var users = results;

            res.locals.connection.query("SELECT count(*) AS total from users where admin = true or supportWorker = true or ID in (select client from clientMappings where supportWorker = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?) limit ?, ?", [uid, uid, uid, offset, limit], function (error, results, fields) {

                if (error) {

                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
            });
        });
    }
    else {

        //can see your support workers, anyone who is observing you and anyone who you are observing
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID = ? or ID in (select supportWorker from clientMappings where client = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?) limit ?, ?", [uid, uid, uid, uid, offset, limit], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }

            var users = results;

            res.locals.connection.query("SELECT count(*) AS total from users where ID = ? or ID in (select supportWorker from clientMappings where client = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?) limit ?, ?", [uid, uid, uid, uid, offset, limit], function (error, results, fields) {

                if (error) {

                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
            });
        });
    }
});


/*+------------------+
  | Account Creation |
  +------------------+*/
router.post("/", function(req, res, next) {

    var admin = req.app.get("admin");


    res.setHeader('Content-Type', 'application/json');
    /* Need to catch and check:
    ** req.headers["content-type"] is set and equals application/json
    ** req.body.email exists
    ** req.body.password exists
    ** req.body.first_name exists
    ** req.body.last_name exists
    */
    admin.auth().createUser({
        email:        req.body.email,
        password:     req.body.password,
        firstName:    req.body.first_name,
        lastName:     req.body.last_name
    })
    .then(function(userRecord) {
        // See the UserRecord reference doc for the contents of userRecord.
        console.log("Successfully created new user:", userRecord.uid);

        var data =
        {
            ID:             userRecord.uid,
            firstname:      req.body.first_name,
            lastname:       req.body.last_name,
            birthday:       req.body.birthday,
            email:          req.body.email,
            enabled:        true,
            displayName:    req.body.display_name || (req.body.first_name + " " + req.body.last_name),
            phoneNumber:    req.body.phone_number,
            recoveryQ1:     req.body.recovery_q1,
            recoveryA1:     req.body.recovery_a1,
            recoveryQ2:     req.body.recovery_q2,
            recoveryA2:     req.body.recovery_a2
        };

        // add the user to the database
        res.locals.connection.query("INSERT into users set ?", data, function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            } else {
                res.status(201);
                res.send({"status": 200, "error": null, "response": results});
            }
        });
    })
    .catch(function(error) {
        console.log("Error creating new user:", error);
        var err = new Error(error.message);
        err.status = 400;
        err.code = error.code;
        err.error = error;
        next(err);
    });
});

router.patch("/", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');

    var uid = req.uid;





    // add input validaton here


    var data = {};
    if (req.body.first_name !== undefined) {
        data.firstname = req.body.first_name;
    }

    if (req.body.last_name !== undefined) {
        data.lastname = req.body.last_name;
    }

    if (req.body.birthday !== undefined) {
        data.birthday = req.body.birthday;
    }

    if (req.body.display_name !== undefined) {
        data.displayName = req.body.display_name;
    }

    if (req.body.phone_number !== undefined) {
        data.phoneNumber = req.body.phone_number;
    }

    if (req.body.recovery_q1 !== undefined) {
        data.recoveryQ1 = req.body.recovery_q1;
    }

    if (req.body.recovery_a1 !== undefined) {
        data.recoveryA1 = req.body.recovery_a1;
    }

    if (req.body.recovery_q2 !== undefined) {
        data.recoveryQ2 = req.body.recovery_q2;
    }

    if (req.body.recovery_a1 !== undefined) {
        data.recoveryA2 = req.body.recovery_a1;
    }

    if (req.body.email !== undefined) {
        data.email = req.body.email;
    }

    //make sure that at least 1 field is being updated
    if (Object.keys(data).length === 0)
    {
        var err = new Error("No values are given to update.");
        err.status = 400;
        err.code = "bad-req";
        err.error = req.body;
        next(err);
    }

    res.locals.connection.query("UPDATE users set ? where ID = ?",[data, uid], function (error, results, fields) {
        if (error) {
            var err = new Error(error.sqlMessage);
            err.status = 500;
            err.code = error.error;
            err.error = error;
            next(err);
        } else {
            res.status(200);
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        }
    });
});

router.get("/:userID", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');
    var userID = req.params.userID;
    var uid = req.uid;

    if (uid === userID) {
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email,recoveryQ1,recoveryA1,recoveryQ2,recoveryA2 from users where ID = ? ",userID, function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }else {
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        });
    }
    else if (res.isAdmin){
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID = ? ",userID, function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }else {
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        });
    }
    else if (res.isSupportWorker) {

        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID = ? and (admin = true or supportWorker = true or ID in (select client from clientMappings where supportWorker = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?))", [userID, uid, uid, uid], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }else {
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        });
    }
    else {

        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID = ? and ID in (select supportWorker from clientMappings where client = ? union select client from userPermissions where observer = ? union select observer from userPermissions where client = ?)", [userID, uid, uid, uid], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }else {
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        });
    }

});

router.delete("/:userID", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');

    var admin = req.app.get("admin");
    var userID = req.params.userID
    var uid = req.uid;

    if (userID === uid) {

        //delete their own account
        //deal with chained deletion
        res.locals.connection.query("delete from users where ID = ?",[userID], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            } else {
                admin.auth().deleteUser(userID)
                .then(function() {
                    console.log("Successfully deleted user");
                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
                })
                .catch(function(error) {
                    console.log("Error deleting user:", error);

                    var err = new Error(error.message);
                    err.status = 401;
                    err.code = error.code;
                    err.error = error;
                    next(err);
                });
            }
        });
    }
    else if (req.isAdmin) {

        //admin can delete any account
        //deal with chained deletion
        res.locals.connection.query("delete from users where ID = ?",[userID], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            } else {
                admin.auth().deleteUser(userID)
                .then(function() {
                    console.log("Successfully deleted user");
                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
                })
                .catch(function(error) {
                    console.log("Error deleting user:", error);

                    var err = new Error(error.message);
                    err.status = 401;
                    err.code = error.code;
                    err.error = error;
                    next(err);
                });
            }
        });
    }
    else {

        var err = new Error("You do not have permission to delete this user");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
    }

});


/*------------------------------------------------------
** GET SCHEDULES ---------------------------------------
**------------------------------------------------------*/
/* +------+
   | Read |
   +------+ */
router.get("/:userID/schedules", validate, function(req,res,next) {
  res.setHeader("Content-Type", "application/json");

  var userID = req.params.userID;
  var uid = req.uid;

  var limit = parseInt(req.query.limit, 10) || 20;
  var offset = parseInt(req.query.offset, 10) || 0;

  if (limit > 50) {
    limit = 50;
  } else if (limit < 1) {
    limit = 1;
  }

  if( offset < 0) {
    offset = 0;
  }

  if (uid == userID) {
    /* Process the request from the perspective of a
    ** client modifying their own schedule */
    q = "SELECT * from schedule where ID = ?";
    res.locals.connection.query(q, userID, function(error, results, fields) {
      if (error) {
        var err = new Error(error.sqlMessage);
        err.status = 500;
        err.code = error.error;
        err.error = error;
        next(err);
      }else {
        res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
      }
    });
  } else if (res.isSupportWorker) {
    /* Process the request only if the support worker
    ** has authority over the clients schedule */
    q1 = "SELECT client FROM clientMappings WHERE supportWorker = ? AND client = ?";
    q2 = "SELECT * FROM schedule WHERE client = (" + q1 + ")";
    res.locals.connection.query(q2, [uid, userID], function(error, results, fields) {
      if (error) {
        var err = new Error(error.sqlMessage);
        err.status = 500;
        err.code = error.error;
        err.error = error;
        next(err);
      } else {
        res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
      }
    });
  } else if (res.isAdmin) {
    /* Process the request immediately without question */
    q = "SELECT * from schedule where ID = ?";
    res.locals.connection.query(q, userID, function(error, results, fields) {
      if (error) {
        var err = new Error(error.sqlMessage);
        err.status = 500;
        err.code = error.error;
        err.error = error;
        next(err);
      } else {
        res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
      }
    });
  }

});


module.exports = router;
