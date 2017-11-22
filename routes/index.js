var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/account', function(req, res, next){
	var data = req.body;
	var admin = req.app.get("admin");

	admin.auth().createUser({
		email: data["email"],
		//phoneNumber: "+11234567890",
		password: data["password"],
		firstName: data["firstName"],
		lastName: data["lastName"]
	})
		.then(function(userRecord) {
		// See the UserRecord reference doc for the contents of userRecord.
			console.log("Successfully created new user:", userRecord.uid);
		})
	.catch(function(error) {
		console.log("Error creating new user:", error);
	});

});

router.post('/register', function(req, res, next) {
  var idToken = req.body["idtoken"];
  var admin = req.app.get("admin");
  admin.auth().verifyIdToken(idToken)
  .then(function(decodedToken) {
    var uid = decodedToken.uid;
    console.log(uid);
    // ...
  }).catch(function(error) {
    // Handle error
    console.log(error);
  });

});
module.exports = router;
