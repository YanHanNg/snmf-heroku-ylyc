
require('dotenv').config();
//Passport core
const passport = require('passport');
//Passport Strategy
const LocalStrategy = require('passport-local').Strategy;

//JWT
const jwt = require('jsonwebtoken');
//Token Secret for Login
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'abcd1234';

//MySQL
const { makeQuery, makeQueryForBulkInsert, pool } = require('./mysql_db.js');

//Get User information from DB
const SQL_GET_USER_INFO = "SELECT user_id, name, email, rewards_pts, notification, notification_token from user where user_id = ? and password = sha(?)";
const getUserInfo = makeQuery(SQL_GET_USER_INFO, pool);

// configure passport with a strategy
passport.use(
    new LocalStrategy(
        { usernameField: 'username', passwordField: 'password', passReqToCallback: true },
        ( req, user, password, done ) => {
            //perform the authentication
            console.info(`user_id: ${user} and password: ${password}`);
            
            getUserInfo( [ user, password ] )
                .then(results => {
                    if(results.length > 0)
                    {
                        done(null, 
                            {
                                user: {
                                    user_id: results[0].user_id,
                                    name: results[0].name,
                                    email: results[0].email,
                                    rewards_pts: results[0].rewards_pts,
                                    notification: results[0].notification,
                                },
                                loginTime: (new Date().toString())
                            }
                        )
                        return
                    }
                    else{
                        done('Incorrect username and password', false);
                        return
                    }
                })
                .catch(error => {
                    done('Error Occurred', false);
                })
        }
    )
)

const mkAuth = (passport) => {
    return (req, res, next) => {
        const f = passport.authenticate('local', 
            (err, user, info) => {
                if((null != err) || (!user)) {
                    res.status(401).json({ error: err })
                    return
                }
                req.user = user;
                next();
            }
        )
        // Add this to call yourself
        f(req, res, next)
    }
}

const localAuth = mkAuth(passport);

const verifyJwtToken = (req, res, next) => {
    //Check if the request has Authorization header
    const auth = req.get('Authorization');
    if(null == auth) {
        console.info('Exit 1');
        res.status(403).type('application/json').json({ message: 'Missing Authorization Header' });
        return;
    }
    //Check bearer authorization
    const terms = auth.split(' ');
    if(terms.length != 2 || (terms[0] != 'Bearer')) {
        console.info('Exit 2');
        res.status(403).type('application/json').json({ message: 'Incorrect Authorization' });
        return;
    }

    const token = terms[1];
    console.info('Token Verified', token);
    try {
        const verified = jwt.verify(token, TOKEN_SECRET);
        console.info(`verified token: `, verified);
        req.token = verified;
        next();

    } catch (error) {
        console.info('Exit 3');
        console.info(error.message);
        res.status(403);
        res.json({ message: 'Incorrect token', error});
    }
}

module.exports = {passport, localAuth, TOKEN_SECRET, verifyJwtToken};