var express = require("express");
var router = express.Router();
var async = require("async");


/**
 * This middleware functon will validate the users tokenID that was sent in the
 * request header X-API-KEY field. It will validate with google that the user is
 * valid. It will also check the users role and will set a supportWorker and
 * isAdmin flag accordingly.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
var validate = function (req, res, next){
    var admin = req.app.get("admin");
    var tokenID = req.get("X-API-KEY");

    res.setHeader('Content-Type', 'application/json');

    if ((req.get('content-type') === undefined || req.get('content-type').toUpperCase() !== 'application/json'.toUpperCase()) && req.method !== 'GET') {
        var err = new Error("Invalid content type. found \"" + req.get('content-type') + "\" excpected application/json.");
        err.status = 400;
        err.code = "invalid-content-type";
        next(err);
        return;
    }

    if (tokenID === undefined) {

        var err = new Error("You need to authenticate yourself with the X-API-KEY header");
        err.status = 401;
        err.code = "auth/argument-missing";
        next(err);
        return;
    }

    // verify the users token with firebase authentication
    admin.auth().verifyIdToken(tokenID) .then(function(decodedToken) {
      var uid = decodedToken.uid;
      req.uid = uid;

      //check the database to get the users role
      res.locals.connection.query("SELECT userRole from users where ID = ? ",uid, function (error, results, fields) {
          if (error) {

              var err = new Error(error.sqlMessage);
              err.status = 500;
              err.code = error.error;
              err.error = error;
              next(err);
          }else if (results.length === 0) {

              //if it gets here then the user has a firebase account but does not have
              // an account in our database, this is bad
              var err = new Error("User does not exist, sign up for an account");
              err.status = 401;
              err.code = "auth/user-not-exists";
              next(err);

          } else {
              var userRole = results[0].userRole;
              if ((userRole & 0b10) === 2) {
                  req.supportWorker = true;
              }
              else {
                  req.supportWorker = false;
              }

              if ((userRole & 0b100) === 4) {
                  req.isAdmin = true;
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

/**
 * This endpoint is used when the client wants to get a list of multiple users.
 * Different users will get a different set of results when they make this call.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
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
                return;
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
                else {
                    res.status(200);
                    res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
                }
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
                return;
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
                else {
                    res.status(200);
                    res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
                }
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
                return;
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
                else {
                    res.status(200);
                    res.send({"status": 200, "error": null, "response": {"users": users, "limit": limit, "offset": offset, "total": results[0].total}});
                }
            });
        });
    }
});

/**
 * This endpoint is used to create a new user account. This will create the user
 * in our database as well as in firebase.
 * The firebase user account gets created first.
 *
 * The user does not need to be authenticated to use this endpoint.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.post("/", function(req, res, next) {

    var admin = req.app.get("admin");

    res.setHeader('Content-Type', 'application/json');


    var invalidFields = {};

    if (req.body.first_name === undefined || req.body.first_name.length >= 60) {
        invalidFields.first_name = "first_name is invalid \"" + req.body.first_name + "\"";
    }

    if (req.body.last_name === undefined || req.body.last_name.length >= 60) {
        invalidFields.last_name = "last_name is invalid \"" + req.body.last_name + "\"";
    }

    if (req.body.gender !== undefined && (req.body.gender > 3 || req.body.gender < 0)) {
        invalidFields.gender = "gender is invalid \"" + req.body.gender + "\"";
    }

    if (req.body.email === undefined || req.body.email.length >= 60) {
        invalidFields.email = "email is invalid \"" + req.body.email + "\"";
    }


    if (req.body.with_CLC === undefined || req.body.with_CLC.toUpperCase() === "FALSE") {
        req.body.with_CLC = false;
    }
    else if (req.body.with_CLC.toUpperCase() === "TRUE") {
        req.body.with_CLC = true;
    }
    else {
        invalidFields.with_CLC = "with_CLC is invalid \"" + req.body.with_CLC + "\"";
    }

    if (req.body.display_name === undefined) {
        req.body.display_name = req.body.first_name + " " + req.body.last_name;
    }

    if (req.body.display_name.length >= 120) {
        invalidFields.display_name = "display_name is invalid \"" + req.body.display_name + "\"";
    }

    var phoneFormat = /^\([0-9]{3}\)[0-9]{3}-[0-9]{4}$/;

    if (req.body.phone_number === undefined || phoneFormat.test(req.body.phone_number) === false) {
        invalidFields.phone_number = "phone_number is invalid \"" + req.body.phone_number + "\"";
    }

    if (req.body.recovery_q1 === undefined || req.body.recovery_q1.length === 0 || req.body.recovery_q1.length >= 250) {
        invalidFields.recovery_q1 = "recovery_q1 is invalid \"" + req.body.recovery_q1 + "\"";
    }

    if (req.body.recovery_a1 === undefined || req.body.recovery_a1.length === 0 || req.body.recovery_a1.length >= 250) {
        invalidFields.recovery_a1 = "recovery_a1 is invalid \"" + req.body.recovery_a1 + "\"";
    }

    if (req.body.recovery_q2 === undefined || req.body.recovery_q2.length === 0 || req.body.recovery_q2.length >= 250) {
        invalidFields.recovery_q2 = "recovery_q2 is invalid \"" + req.body.recovery_q2 + "\"";
    }

    if (req.body.recovery_a2 === undefined || req.body.recovery_a2.length === 0 || req.body.recovery_a2.length >= 250) {
        invalidFields.recovery_a2 = "recovery_a2 is invalid \"" + req.body.recovery_a2 + "\"";
    }

    //make sure that at least 1 field is being updated
    if (Object.keys(invalidFields).length !== 0)
    {
        var err = new Error("Invalid fields given");
        err.status = 400;
        err.code = "bad-req";
        err.error = invalidFields;
        next(err);
        return;
    }


    // load the sent data into the struct to put into the database
    var data =
    {
        firstname:      req.body.first_name,
        lastname:       req.body.last_name,
        birthday:       req.body.birthday,
        email:          req.body.email,
        gender:         req.body.gender || 0,
        partOfCLC:      req.body.with_CLC,
        enabled:        true,
        displayName:    req.body.display_name || (req.body.first_name + " " + req.body.last_name),
        phoneNumber:    req.body.phone_number,
        recoveryQ1:     req.body.recovery_q1,
        recoveryA1:     req.body.recovery_a1,
        recoveryQ2:     req.body.recovery_q2,
        recoveryA2:     req.body.recovery_a2
    };


    admin.auth().createUser({
        email:        req.body.email,
        password:     req.body.password,
        displayName:  req.body.first_name + " " + req.body.last_name
    })
    .then(function(userRecord) {
        // See the UserRecord reference doc for the contents of userRecord.
        console.log("Successfully created new user:", userRecord.uid);


        //add the users ID to the sql payload
        data.ID = userRecord.uid;


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
                res.send({"status": 201, "error": null, "response": results});
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

/**
 * This endpoint is used to create a new user account. This will update the users
 * information in the database, if the users name or email is changed then the firebase
 * user will also be updated.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.patch("/", validate, function(req, res, next) {

    var admin = req.app.get("admin");
    res.setHeader('Content-Type', 'application/json');

    var uid = req.uid;


    var invalidFields = {};
    var firebaseData = {};
    var sqlData = {};

    if (req.body.first_name !== undefined && req.body.first_name.length >= 60) {
        invalidFields.first_name = "first_name is invalid \"" + req.body.first_name + "\"";
    }
    else {
        sqlData.firstname = req.body.first_name;
    }

    if (req.body.last_name !== undefined && req.body.last_name.length >= 60) {
        invalidFields.last_name = "last_name is invalid \"" + req.body.last_name + "\"";
    } else {
        sqlData.lastname = req.body.last_name;
    }

    if (req.body.gender !== undefined && (req.body.gender > 3 || req.body.gender < 0)) {
        invalidFields.gender = "gender is invalid \"" + req.body.gender + "\"";
    } else if  (req.body.gender !== undefined) {
        sqlData.gender = req.body.gender;
    }

    if (req.body.email !== undefined && req.body.email.length >= 60) {
        invalidFields.email = "email is invalid \"" + req.body.email + "\"";
    } else {
        sqlData.email = req.body.email;
        firebaseData.email = req.body.email;
    }

    if (req.body.with_CLC === undefined || req.body.with_CLC.toUpperCase() === "FALSE") {
        sqlData.partOfCLC = false;
    }
    else if (req.body.with_CLC.toUpperCase() === "TRUE") {
        sqlData.partOfCLC = true;
    }
    else {
        invalidFields.with_CLC = "with_CLC is invalid \"" + req.body.with_CLC + "\"";
    }

    if (req.body.display_name !== undefined && req.body.display_name.length >= 120) {
        invalidFields.display_name = "display_name is invalid \"" + req.body.display_name + "\"";
    } else if (req.body.display_name !== undefined) {
        sqlData.displayName = req.body.display_name;
    }


    var phoneFormat = /^\([0-9]{3}\)[0-9]{3}-[0-9]{4}$/;

    if (req.body.phone_number !== undefined && phoneFormat.test(req.body.phone_number) === false) {
        invalidFields.phone_number = "phone_number is invalid \"" + req.body.phone_number + "\"";
    }
    else if (req.body.phone_number !== undefined) {
        sqlData.phoneNumber = req.body.phone_number;
    }

    if (req.body.recovery_q1 !== undefined && (req.body.recovery_q1.length === 0 || req.body.recovery_q1.length >= 250)) {
        invalidFields.recovery_q1 = "recovery_q1 is invalid \"" + req.body.recovery_q1 + "\"";
    } else if (req.body.recovery_q1 !== undefined) {
        sqlData.recoveryQ1 = req.body.recovery_q1;
    }

    if (req.body.recovery_a1 !== undefined && (req.body.recovery_a1.length === 0 || req.body.recovery_a1.length >= 250)) {
        invalidFields.recovery_a1 = "recovery_a1 is invalid \"" + req.body.recovery_a1 + "\"";
    } else if (req.body.recovery_a1 !== undefined) {
        sqlData.recoveryQ1 = req.body.recovery_a1;
    }

    if (req.body.recovery_q2 !== undefined && (req.body.recovery_q2.length === 0 || req.body.recovery_q2.length >= 250)) {
        invalidFields.recovery_q2 = "recovery_q2 is invalid \"" + req.body.recovery_q2 + "\"";
    } else if (req.body.recovery_q2 !== undefined) {
        sqlData.recoveryQ1 = req.body.recovery_q2;
    }

    if (req.body.recovery_a2 !== undefined && (req.body.recovery_a2.length === 0 || req.body.recovery_a2.length >= 250)) {
        invalidFields.recovery_a2 = "recovery_a2 is invalid \"" + req.body.recovery_a2 + "\"";
    } else if (req.body.recovery_a2 !== undefined) {
        sqlData.recoveryQ1 = req.body.recovery_a2;
    }

    //make sure that at least 1 field is being updated
    if (Object.keys(invalidFields).length !== 0)
    {
        var err = new Error("Invalid fields given");
        err.status = 400;
        err.code = "bad-req";
        err.error = invalidFields;
        next(err);
        return;
    }


    if (req.body.birthday !== undefined) {
        sqlData.birthday = req.body.birthday;
    }


    //make sure that at least 1 field is being updated
    if (Object.keys(sqlData).length === 0)
    {
        var err = new Error("No values are given to update.");
        err.status = 400;
        err.code = "bad-req";
        err.error = req.body;
        next(err);
        return;
    }

    res.locals.connection.query("UPDATE users set ? where ID = ?",[sqlData, uid], function (error, results, fields) {
        if (error) {
            var err = new Error(error.sqlMessage);
            err.status = 500;
            err.code = error.error;
            err.error = error;
            next(err);
        } else {

            if (Object.keys(firebaseData).length !== 0) {
                admin.auth().updateUser(uid, firebaseData)
                .then(function(userRecord) {
                    // See the UserRecord reference doc for the contents of userRecord.
                    console.log("Successfully updated user", userRecord.toJSON());

                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
                })
                .catch(function(error) {
                    console.log("Error updating user:", error);
                    var err = new Error(error.message);
                    err.status = 500;
                    err.code = error.code;
                    err.error = error;
                    next(err);
                });
            }
            else {
                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
            }
        }
    });
});

/**
 * This endpoint is used to get a single users data.
 * Depending on the user permissions a different set of results will be shown.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.get("/:userID", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');
    var userID = req.params.userID;
    var uid = req.uid;

    if (uid === userID) {
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email,partOfCLC AS with_CLC,gender,recoveryQ1,recoveryA1,recoveryQ2,recoveryA2 from users where ID = ? ",userID, function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            }else {
                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": results[0] || {}}));
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
                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": results[0] || {}}));
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
                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": results[0] || {}}));
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
                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": results[0] || {}}));
            }
        });
    }

});

/**
 * This endpoint is used to delete a single users account.
 * An account can only be deleted by themselves or by an administrator.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.delete("/:userID", validate, function(req, res, next) {

    res.setHeader('Content-Type', 'application/json');

    var admin = req.app.get("admin");
    var userID = req.params.userID
    var uid = req.uid;

    if (req.isAdmin || userID === uid) {

        //admin can delete any account, and a user is able to delete their own account
        //deal with chained deletion
        res.locals.connection.query("delete from users where ID = ?", userID, function (error, results, fields) {
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
                    err.status = 500;
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

/**
 * This endpoint is used to get all of the schedules for a specific user.
 * Depending on the user permissions a different set of results will be shown.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
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

    if(offset < 0) {
        offset = 0;
    }

    var output = [];

    var hitError = false;
    var query;


    if (uid === userID || req.isAdmin) {
        query = res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where client=? limit ?, ?', [userID, offset, limit]);
    }
    else if (req.supportWorker) {
        query = res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where client in (SELECT client FROM clientMappings WHERE supportWorker = ? AND client = ?) OR (client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true))) limit ?, ?', [uid, userID, userID, userID, uid, offset, limit]);

    }
    else {
        query = res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true)) limit ?, ?', [userID, userID, uid, offset, limit]);
    }


    query.on('error', function(err) {
        // Handle error, an 'end' event will be emitted after this as well
        hitError = true;
        var err1 = new Error(err.sqlMessage);
        err1.status = 500;
        err1.code = err.error;
        err1.error = err;
        next(err1);
        //set error flag
    })
    .on('fields', function(fields) {
        // the field packets for the rows to follow
        // ignore this
    })
    .on('result', function(row) {
        output.push(row);
    })
    .on('end', function() {
        // all rows have been received

        if (hitError) {
            console.log("There was an error");
            return;
        }

        var calls = [];

        output.forEach(function(schedule) {
            calls.push(function(callback){

                res.locals.connection.query('SELECT doseID,day,time,notificationTime,doseWindow FROM dose where scheduleID=?', schedule.ID, function (error, results, fields) {

                  if (error) {
                    //handle error
                    console.log(error);
                    callback(error, results);
                    return;
                  }
                  else {
                      schedule.doses = results;
                      callback(error, results);
                  }
                });
            })
        });

        async.parallel(calls, function(error, result) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;

                return res.locals.connection.rollback(function() {
                    console.log('rollback');
                    next(err);
                });
            }
            else {
                res.locals.connection.commit(function(err) {
                    if (err) {
                        return res.locals.connection.rollback(function() {
                            console.log('rollback');

                            var err1 = new Error(err.sqlMessage);
                            err1.status = 500;
                            err1.code = err.error;
                            err1.error = err;
                            next(err1);
                        });
                    }

                    if (uid === userID || req.isAdmin) {
                        res.locals.connection.query('SELECT count(*) as total FROM schedule where client=? limit ?, ?', [userID, offset, limit], function (error, results, fields) {

                            if (error) {

                                var err = new Error(error.sqlMessage);
                                err.status = 500;
                                err.code = error.error;
                                err.error = error;
                                next(err);
                            }
                            res.status(200);
                            res.send(JSON.stringify({"status": 200, "error": null, "response": {"schedules": output, "limit": limit, "offset": offset, "total": results[0].total}}));
                        });
                    }
                    else if (req.supportWorker) {
                        res.locals.connection.query('SELECT count(*) as total FROM schedule where client in (SELECT client FROM clientMappings WHERE supportWorker = ? AND client = ?) OR (client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true))) limit ?, ?', [uid, userID, userID, userID, uid, offset, limit], function (error, results, fields) {

                            if (error) {

                                var err = new Error(error.sqlMessage);
                                err.status = 500;
                                err.code = error.error;
                                err.error = error;
                                next(err);
                            }
                            res.status(200);
                            res.send(JSON.stringify({"status": 200, "error": null, "response": {"schedules": output, "limit": limit, "offset": offset, "total": results[0].total}}));
                        });
                    }
                    else {
                        res.locals.connection.query('SELECT count(*) as total FROM schedule where client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true)) limit ?, ?', [userID, userID, uid, offset, limit] , function (error, results, fields) {

                            if (error) {

                                var err = new Error(error.sqlMessage);
                                err.status = 500;
                                err.code = error.error;
                                err.error = error;
                                next(err);
                            }
                            res.status(200);
                            res.send(JSON.stringify({"status": 200, "error": null, "response": {"schedules": output, "limit": limit, "offset": offset, "total": results[0].total}}));
                        });
                    }
                });
            }
        });
    });
});

/**
 * This endpoint is used to  create a new schedule for a the currently authenticated user.
 * Depending on who you are logged in as you may not be able to create a schedule
 * for a different user
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.post("/:userID/schedules", validate, function(req,res,next) {

    var curDate = mysql.raw('CURDATE()');

    var userID = req.params.userID;
    var uid = req.uid;

    var dateFormat = /^[1-9][0-9]{3}\-(0[1-9]|1[12])\-(0[1-9]|[12][0-9]|3[01])$/;
    var timeFormat = /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    var notificationFormat = /^-0[0123]:[0-5][0-9]:[0-5][0-9]$/;
    var windowFormat = /^0[01234]:[0-5][0-9]:[0-5][0-9]$/;


    var invalidFields = {};

    if (req.body.drug_name === undefined || req.body.drug_name.length >= 256) {
        invalidFields.drug_name = "drug_name is invalid \"" + req.body.drug_name + "\"";
    }

    if (req.body.dose_units === undefined || req.body.dose_units.length >= 60) {
        invalidFields.dose_units = "dose_units is invalid \"" + req.body.dose_units + "\"";
    }

    if (req.body.dose_quantity === undefined || req.body.dose_quantity <= 0) {
        invalidFields.dose_quantity = "dose_quantity is invalid \"" + req.body.dose_quantity + "\"";
    }

    if (req.body.start_date !== undefined && dateFormat.test(req.body.start_date) === false) {
        invalidFields.start_date = "start_date is invalid \"" + req.body.start_date + "\"";
    }

    if (req.body.end_date !== undefined && dateFormat.test(req.body.end_date) === false) {
        invalidFields.end_date = "end_date is invalid \"" + req.body.end_date + "\"";
    }


    var createdBySupportWorker = false;

    if (req.supportWorker && userID !== uid){
        createdBySupportWorker = true;
    }

    var data = {
        client: userID,
        drug: req.body.drug_name,
        doseUnit: req.body.dose_units,
        dose: req.body.dose_quantity,
        createdByStaff: createdBySupportWorker,
        enabled:  true,
        startDate: req.body.start_date || curDate,
        endDate: req.body.end_date || '9999-12-31'
    };

    if (req.body.notes !== undefined) {
        data.notes = req.body.notes
    }

    var rawDoses = req.body.doses || [];
    var dosesToInsert = [];



    if (Object.keys(invalidFields).length !== 0)
    {
        invalidFields.dose_quantity = [];
        invalidFields.time = [];
        invalidFields.notification_offset = [];
        invalidFields.dose_window = [];
    }

    for (var i = 0; i < rawDoses.length; i++) {
        var dose = {};

        if (rawDoses[i].day === undefined || rawDoses[i].day < 0 || rawDoses[i].day > 6) {
            invalidFields.dose_quantity.push("dose.day is invalid \"" + rawDoses[i].day + "\"");
        }
        if (rawDoses[i].time === undefined || timeFormat.test(rawDoses[i].time) === false) {
            invalidFields.time.push("dose.time is invalid \"" + rawDoses[i].time + "\"");
        }
        if (rawDoses[i].notification_offset !== undefined && (notificationFormat.test(rawDoses[i].notification_offset) === false)) {
            invalidFields.notification_offset.push("dose.notification_offset is invalid \"" + rawDoses[i].notification_offset + "\"");
        }
        if (rawDoses[i].dose_window !== undefined && (windowFormat.test(rawDoses[i].dose_window) === false)) {
            invalidFields.dose_window.push("dose.dose_window is invalid \"" + rawDoses[i].dose_window + "\"");
        }

        dose.day = rawDoses[i].day;
        dose.time = rawDoses[i].time;
        dose.notificationTime = rawDoses[i].notification_offset || "-00:15:00";
        dose.doseWindow = rawDoses[i].dose_window || "01:00:00";
        dosesToInsert.push(dose);
    }

    //make sure that at least 1 field is being updated
    if (Object.keys(invalidFields).length !== 0)
    {
        var err = new Error("Invalid fields given");
        err.status = 400;
        err.code = "bad-req";
        err.error = invalidFields;
        next(err);
        return;
    }


    if (userID === uid || req.isAdmin) {
        res.locals.connection.beginTransaction(function(err) {
          if (err) {
              var err = new Error(error.sqlMessage);
              err.status = 500;
              err.code = error.error;
              err.error = error;
              console.log('error');

              next(err);
              return;
          }
          res.locals.connection.query("INSERT into schedule set ?", data, function (error, results, fields) {
            if (error) {
              res.locals.connection.rollback(function() {
                  var err = new Error(error.sqlMessage);
                  err.status = 500;
                  err.code = error.error;
                  err.error = error;
                  console.log('rollback');

                  next(err);
              });
              return;
            }

            var scheduleID = results.insertId;
            var calls = [];

            dosesToInsert.forEach(function(dose) {
                calls.push(function(callback){

                    dose.scheduleID = scheduleID;

                    res.locals.connection.query("INSERT into dose set ?", dose, function (error, results, fields) {
                      if (error) {
                          callback(error, results);
                      }
                      else {
                          console.log("success drug " + results.insertId);
                          callback(error, results);
                      }
                    });
                })
            });

            async.parallel(calls, function(error, result) {

                if (error) {
                    res.locals.connection.rollback(function() {
                        console.log('rollback');
                        next(error);
                    });
                    return;
                }
                else {
                    res.locals.connection.commit(function(err1) {
                      if (err1) {
                        res.locals.connection.rollback(function() {
                            console.log('rollback');

                            var err = new Error(err1.sqlMessage);
                            err.status = 500;
                            err.code = err1.error;
                            err.error = err1;
                            next(err);
                        });
                        return;
                      }
                      else {
                          console.log('success!');
                          res.status(201);
                          res.send({"status": 201, "error": null, "response": results});
                      }
                    });
                }
            });

          });
        });
    }
    else if (req.isSupportWorker) {

        //can see your support workers, anyone who is observing you and anyone who you are observing
        res.locals.connection.query("select count(*) as total from clientMappings where client = ? and supportWorker = ?", [userID, uid], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            if (results.length === 0) {
                var err = new Error("You do not have permission to perform this action.");
                err.status = 403;
                err.code = "permission-denied";
                next(err);
                return;
            }

            res.locals.connection.beginTransaction(function(err) {
              if (err) {
                  var err = new Error(error.sqlMessage);
                  err.status = 500;
                  err.code = error.error;
                  err.error = error;
                  console.log('error');

                  next(err);
                  return;
              }
              res.locals.connection.query("INSERT into schedule set ?", data, function (error, results, fields) {
                if (error) {
                  res.locals.connection.rollback(function() {
                      var err = new Error(error.sqlMessage);
                      err.status = 500;
                      err.code = error.error;
                      err.error = error;
                      console.log('rollback');

                      next(err);
                  });
                  return;
                }

                var scheduleID = results.insertId;
                var calls = [];

                dosesToInsert.forEach(function(dose) {
                    calls.push(function(callback){

                        dose.scheduleID = scheduleID;

                        res.locals.connection.query("INSERT into dose set ?", dose, function (error, results, fields) {
                          if (error) {
                              callback(error, results);
                          }
                          else {
                              console.log("success drug " + results.insertId);
                              callback(error, results);
                          }
                        });
                    })
                });

                async.parallel(calls, function(error, result) {

                    if (error) {
                        res.locals.connection.rollback(function() {
                            console.log('rollback');
                            next(error);
                        });
                        return;
                    }
                    else {
                        res.locals.connection.commit(function(err1) {
                          if (err1) {
                            res.locals.connection.rollback(function() {
                                console.log('rollback');

                                var err = new Error(err1.sqlMessage);
                                err.status = 500;
                                err.code = err1.error;
                                err.error = err1;
                                next(err);
                            });
                            return;
                          }
                          else {
                              console.log('success!');
                              res.status(201);
                              res.send({"status": 201, "error": null, "response": results});
                          }
                        });
                    }
                });

              });
            });
        });
    }
    else {
        var err = new Error("You do not have permission to perform this action.");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
        return;
    }
});

/**
 * This endpoint is used to get a specific schedule for a specific user.
 * Depending on the user permissions a different set of results will be shown.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.get("/:userID/schedules/:scheduleID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");

    var userID = req.params.userID;
    var scheduleID = req.params.scheduleID;

    var uid = req.uid;

    if (uid === userID || req.isAdmin) {
        res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where ID = ? AND client=?', [scheduleID, userID], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            //if the schedule could not be found then return empty result
            if (results.length === 0) {

                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": {}}));
                return;
            }

            var schedule = results[0];


            res.locals.connection.query('SELECT doseID,day,time,notificationTime,doseWindow FROM dose where scheduleID=?', schedule.ID, function (error, results, fields) {

                if (error) {
                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                else {
                    schedule.doses = results;

                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": schedule}));
                }
            });

        });
    }
    else if (req.supportWorker) {
        res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where ID = ? AND client in (SELECT client FROM clientMappings WHERE supportWorker = ? AND client = ?) OR (client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true)))', [scheduleID, uid, userID, userID, userID, uid], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            //if the schedule could not be found then return empty result
            if (results.length === 0) {

                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": {}}));
                return;
            }

            var schedule = results[0];


            res.locals.connection.query('SELECT doseID,day,time,notificationTime,doseWindow FROM dose where scheduleID=?', schedule.ID, function (error, results, fields) {

                if (error) {
                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                else {
                    schedule.doses = results;

                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": schedule}));
                }
            });

        });

    }
    else {
        res.locals.connection.query('SELECT ID,drug,doseUnit,dose,createdByStaff,enabled,vacationUntil,createDate,startDate,endDate,notes FROM schedule where scheduleID = ? AND client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true))', [scheduleID, userID, userID, uid], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            //if the schedule could not be found then return empty result
            if (results.length === 0) {

                res.status(200);
                res.send(JSON.stringify({"status": 200, "error": null, "response": {}}));
                return;
            }

            var schedule = results[0];


            res.locals.connection.query('SELECT doseID,day,time,notificationTime,doseWindow FROM dose where scheduleID=?', schedule.ID, function (error, results, fields) {

                if (error) {
                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                else {
                    schedule.doses = results;

                    res.status(200);
                    res.send(JSON.stringify({"status": 200, "error": null, "response": schedule}));
                }
            });
        });
    }
});

/**
 * This endpoint is used to  delete a  schedule for a specific user.
 * The schedule is not actually deleted rather it is only marked as disabled so that
 * when you want to get the doses taken later you can still see the the past doses.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.delete("/:userID/schedules/:scheduleID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");

    var userID = req.params.userID;
    var scheduleID = req.params.scheduleID;

    var uid = req.uid;

    if (uid === userID || req.isAdmin) {
        res.locals.connection.query('SELECT UPDATE schedule set enabled = false, endDate = CURDATE() where ID = ? AND client=?', [scheduleID, userID], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            res.status(200);
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));

        });
    }
    else if (req.supportWorker) {
        res.locals.connection.query('UPDATE schedule set enabled = false, endDate = CURDATE() where ID = ? AND client in (SELECT client FROM clientMappings WHERE supportWorker = ? AND client = ?) OR (client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true)))', [scheduleID, uid, userID, userID, userID, uid], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            res.status(200);
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        });
    }
    else {
        res.locals.connection.query('UPDATE schedule set enabled = false, endDate = CURDATE() where scheduleID = ? AND client = ? and ID in (select scheduleID from schedulePermissions where clientID = ? and observerID = ? and (userAccepted = true or mandatory = true))', [scheduleID, userID, userID, uid], function (error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            res.status(200);
            res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
        });
    }

});

/**
 * This endpoint is used to  get all of the users who are observing the given user.
 * You are only able to call this observe yourself, or if you are an admin then on
 * any user.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.get("/:userID/observers", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");


    var userID = req.params.userID;

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

    if (req.isAdmin || req.uid === supportWorker) {

        //can see your support workers, anyone who is observing you and anyone who you are observing
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID in (select observer from userPermissions where client = ?) limit ?, ?", [userID, offset, limit], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            var observers = results;

            res.locals.connection.query("SELECT count(*) AS total from userPermissions where client = ? ", userID, function (error, results, fields) {
                if (error) {

                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    next(err);
                }
                else {
                    res.status(200);
                    res.send({"status": 200, "error": null, "response": {"observers": observers, "limit": limit, "offset": offset, "total": results[0].total}});
                }
            });
        });
    }
    else {
        var err = new Error("You do not have permission to perform this action.");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
    }
});

/**
 * This endpoint is used to set a new observer on the given user
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.post("/:userID/observers", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");
    var userID = req.params.userID;

    var userToGrantEmail = req.body.user_email;

    var toInsert = {
        client: userID,
        observer:userToGrant
    };

    if(req.isAdmin || req.uid === userID) {

        res.locals.connection.query("select ID from users where email = ?", [userToGrantEmail], function(error, results, fields) {

            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
            } else {

                if (results.length === 0) {
                    var err = new Error("User not found with email address \"" + userToGrantEmail + "\"");
                    err.status = 500;
                    err.code = "not-found";
                    next(err);
                    return;
                }

                var toInsert = {
                    client: userID,
                    observer: results[0].ID
                };

                res.locals.connection.query("insert into userPermissions set ?", toInsert, function(error, results, fields) {

                    if (error) {
                        var err = new Error(error.sqlMessage);
                        err.status = 500;
                        err.code = error.error;
                        err.error = error;
                        next(err);
                    } else {
                        res.status(201);
                        res.send(JSON.stringify({"status": 201, "error": null, "response": results}));
                    }
                });
            }
        });

    } else {
        var err = new Error("You do not have permission to delete this user");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
    }
});

/**
 * This endpoint is used to  remove a mapping between a client and an observer.
 * This can only be used by an administrator or by ether of the users in the
 * relationship.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.delete("/:userID/observers/:observerID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");

    var userID = req.params.userID;
    var observerID = req.params.observerID;

    if(req.isAdmin || req.uid === userID || req.uid === observerID) {
        var q = "delete from userPermissions where client=? and observer=?";
        res.locals.connection.query(q, [userID, observerID], function(error, results, fields) {

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

    } else {
        var err = new Error("You do not have permission to delete this user");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
    }
});


module.exports = router;
