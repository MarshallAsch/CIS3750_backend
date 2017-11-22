var express = require("express");
var router = express.Router();
var mysql = require("mysql");
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

    if (req.get('content-type').toUpperCase() !== 'application/json'.toUpperCase()  && req.method !== 'GET') {
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
      console.log(decodedToken);

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

/* +--------+
   | Create |
   +--------+ */
router.post("/", validate, function(req,res,next) {


    var curDate = mysql.raw('CURDATE()');
      var data = {
        client: req.uid,
        drug: req.body.drug_name,
        doseUnit: req.body.dose_units,
        dose: req.body.dose_quantity,
        createdByStaff: req.supportWorker || false,
        enabled:  true,
        startDate: req.body.start_date || curDate,
        endDate: req.body.end_date || '9999-12-31'
    };

    if (req.body.notes !== undefined) {
        data.notes = req.body.notes
    }

    var rawDoses = req.body.doses;
    var dosesToInsert = [];


    for (var i = 0; i < rawDoses.length; i++) {
        var dose = {};
        dose.day = rawDoses[i].day;
        dose.time = rawDoses[i].time;
        dose.notificationTime = rawDoses[i].notification_offset;
        dose.doseWindow = rawDoses[i].dose_window;
        dosesToInsert.push(dose);
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
          return res.locals.connection.rollback(function() {
              var err = new Error(error.sqlMessage);
              err.status = 500;
              err.code = error.error;
              err.error = error;
              console.log('rollback');

              next(err);
            //throw error;
          });
        }

        var scheduleID = results.insertId;
        var insertError = false;


        var calls = [];

        dosesToInsert.forEach(function(dose) {
            calls.push(function(callback){

                dose.scheduleID = scheduleID;

                res.locals.connection.query("INSERT into dose set ?", dose, function (error, results, fields) {
                  if (error) {

                      callback(error, results);

                     // throw error;

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
                return res.locals.connection.rollback(function() {
                    var err = new Error(error.sqlMessage);
                    err.status = 500;
                    err.code = error.error;
                    err.error = error;
                    console.log('rollback');
                    insertError = true;
                    next(err);
                });
            }
            else {
                res.locals.connection.commit(function(err1) {
                  if (err1) {
                    return res.locals.connection.rollback(function() {
                        console.log('rollback');

                        var err = new Error(error.sqlMessage);
                        err.status = 500;
                        err.code = error.error;
                        err.error = error;
                        next(err);
                     // throw err;
                    });
                  }

                  console.log('success!');
                  res.status(201);
                  res.send({"status": 201, "error": null, "response": results});
                });
            }
        })

      });
    });
});


module.exports = router;
