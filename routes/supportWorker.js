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
 * This endpoint is used to  get all of the clients that are managed by a specific
 * support worker. This can only be used by admins, and a support worker asking for
 * their own data
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.get("/:supportWorker/clients", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");
    var supportWorker = req.params.supportWorker;

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
        res.locals.connection.query("SELECT ID,userRole,birthday,createTime,firstname,lastname,displayName,phoneNumber,email from users where ID in (select client from clientMappings where supportWorker = ? ) limit ?, ?", [supportWorker, offset, limit], function (error, results, fields) {
            if (error) {
                var err = new Error(error.sqlMessage);
                err.status = 500;
                err.code = error.error;
                err.error = error;
                next(err);
                return;
            }

            var users = results;

            res.locals.connection.query("SELECT count(*) AS total FROM clientMappings WHERE supportWorker = ?", supportWorker, function (error, results, fields) {
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
        var err = new Error("You do not have permission to perform this action.");
        err.status = 403;
        err.code = "permission-denied";
        next(err);
    }
});

/**
 * This endpoint is used to  create a new mapping between a support worker and a
 * client. This can only be used by an administrator.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.post("/:supportWorker/users/:clientID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");
    var clientID = req.params.clientID;
    var supportWorker = req.params.supportWorker;

    if(req.isAdmin) {
        var q = "INSERT INTO clientMappings (client, supportWorker) VALUES (?,?) ";
        res.locals.connection.query(q, [clientID, supportWorker], function(error, results, fields) {

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

/**
 * This endpoint is used to  remove a mapping between a support worker and a
 * client. This can only be used by an administrator or by the support worker
 * removing one of their own clients.
 *
 * This requires the user to be authenticated.
 *
 * @param   req  the http request object that is being handled
 * @param   res  the responce object that will eventually be sent back the client
 * @param   next callback that will cause the next middlewhere function to be executed.
 * @return       none
 */
router.delete("/:supportWorker/users/:clientID", validate, function(req,res,next) {
    res.setHeader("Content-Type", "application/json");
    var clientID = req.params.clientID;
    var supportWorker = req.params.supportWorker;

    if(req.isAdmin || req.uid === supportWorker) {
        var q = "delete from clientMappings where client=? and supportWorker=?";
        res.locals.connection.query(q, [clientID, supportWorker], function(error, results, fields) {

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
