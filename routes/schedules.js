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

/* +--------+
   | Create |
   +--------+ */
router.post("/", validate, function(req,res,next) {
  var data = {
    client: req.uid,
    drug: req.body.drug_name,
    doseUnit: req.body.dose_units,
    dose: req.body.dose_quantity,
    createdByStaff: req.body.created_by_staff || false, // need to verify staff identity, here
    enabled: req.body.enabled || true,
    vacationUntil: req.body.vacationUntil,
    startDate: req.body.start_date,
    endDate: req.body.end_date
  }
  res.locals.connection.query("INSERT into schedule set ?", data, function (error, results, fields) {
    console.log(fields);
    console.log(results);
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
});

/* +--------+
   | Update |
   +--------+ */
router.post("/update", validate, function(req,res,next) {
  console.log("Update Schedule");
});

/* +--------+
   | Delete |
   +--------+ */
router.delete("/", validate, function(req,res,next) {
  console.log("Delete Schedule");
});

module.exports = router;
