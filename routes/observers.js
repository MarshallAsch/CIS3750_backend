var express = require("express");
var router = express.Router();


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
 * This endpoint is used to  get all of the users who are observing the authenticated
 * user.
 * This is a convience endpoint for /users/{userID}/observers
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.get("/", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");

    var userID = req.uid;

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
});

/**
 * This endpoint is used to set a new observer on the authenticated user
 * This is a convience endpoint for /users/{userID}/observers
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.post("/", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");
    var userID = req.uid;

    var userToGrantEmail = req.body.user_email;


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
});

/**
 * This endpoint is used to  remove a mapping between a client and an observer.
 * This is a convience end point to remove a user from observing you
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.delete("/:observerID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");

    var userID = req.uid;
    var observerID = req.params.observerID;

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
});



module.exports = router;
