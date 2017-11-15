
var assert = require('assert');
var request = require('supertest');
var app = require('../app.js');

var chai = require('chai');

var supertest = require('supertest');


/*
    When running these tests it must be on the testing database and it must be
    empty before the testing starts
 */

assert = chai.assert;

/*

 describe('Array', function() {
   // Further code for tests goes here

   it('should start empty', function() {
    // Test implementation goes here

    var array=[];

    assert.lengthOf(array, 2, 'len of 4');
  });




 });
*/


describe('Users', function() {
  describe('# GET users/', function() {
    it('results should be an empty list of users', function() {
     // assert.equal(-1, [1,2,3].indexOf(4));

        request(app).get('/v1/users')
       .expect(function (res) {
           if (res.body.response.length != 2) throw new Error("length is not right");
       })
       .end(function(err, res) {

           if (err)
           {
               console.log(err);

               done(err);

           }
           else {
               console.log(res.body.response.length);

               done();
           }


     });
    });
  });
});
