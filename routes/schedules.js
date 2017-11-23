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

/* +--------+
   | Create |
   +--------+ */
router.post("/", validate, function(req,res,next) {

    var curDate = mysql.raw('CURDATE()');

    var userID = req.uid;


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


    var data = {
        client: userID,
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


module.exports = router;
