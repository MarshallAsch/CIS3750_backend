var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
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
