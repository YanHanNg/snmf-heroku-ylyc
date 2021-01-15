require('dotenv').config();
//Library
const express = require('express');

const morgan = require('morgan');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const withQuery = require('with-query').default;

//Email
const { sendEmail } = require('./mail.js');

//MySQL
const { makeQuery, makeQueryForBulkInsert, pool } = require('./mysql_db.js');

//Passport 
const { localAuth, passport, TOKEN_SECRET, verifyJwtToken } = require('./authenticate.js')

//Telegram Bot
const { sendRemindersViaTelegram } = require('./telegrambot.js');

//Cron
const cron = require('node-cron');

//Schedule-task
const { } = require('./schedule-task.js');

//S3
const { s3PutObject, s3RemoveObject, upload, readFile, s3, fs } = require('./s3.js');

const app = express();
const PORT = process.env.PORT || 3000;

//Morgan
app.use(morgan('combined'));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(cors());

//passport initialize after json and formurlencoded
app.use(passport.initialize());

//---------------------------------------------------Login Process----------------------------------------------------------------

const SQL_GET_USER_INFO = "SELECT user_id, name, email, rewards_pts, notification, notification_token from user where user_id = ?";
const getUserInfo = makeQuery(SQL_GET_USER_INFO, pool);

app.post('/login', 
    //passport.authenticate('local', { session: false }),
    localAuth,
    (req, res) => {
        //do smth
        console.info('User Information after LocalAuth: ', req.user);

        //generate JWT token
        const token = jwt.sign({
            sub: req.user.user_id,
            iss: 'YLYC',
            iat: (new Date()).getTime() / 1000, 
            exp: ((new Date()).getTime() / 1000) + (3600 * 24),
            data: {
                loginTime: req.user.loginTime
            }
        }, TOKEN_SECRET)

        res.status(200);
        res.type('application/json');
        res.json({ message: `Login at ${new Date()}` , token, user: req.user });
    })


app.post('/getUserInfo', verifyJwtToken, (req, res) => {
    const user_id = req.body.user_id;

    getUserInfo([ user_id ])
        .then(results => {
            return res.status(200).type('application/json').json({ user: results[0] })
        })
        .catch(err => {
            return res.status(500).type('application/json').json({ message: 'Error in fetching user Info >>>' + err.message })
        })
})

//---------------------------User Sign Up---------------------------------------------------------------

const SQL_INSERT_USER = "Insert Into user (user_id, name, password, email) values (?, ? ,sha(?), ?)";
const insertUser = makeQuery(SQL_INSERT_USER, pool);

app.post('/signup', (req, res) => {
    const user = req.body;

    insertUser([ user.user_id, user.name, user.password, user.email])
        .then(results => {
            sendEmail(user.email, 'Register');
            return res.status(201).json({ message: "User Created Successfully"})
            
        })
        .catch(error => {
            return res.status(500).type('application/json').json({ message: 'Error During Signing up.'})
        })
})

//--------------------------------------START USER NOTIFICATIONS SUBSCRIPTION-----------------------------------------------------

//Update the user with the Sub
const SQL_UPDATE_USER_SUB = "Update user set notification = ?, notification_token = ? where user_id = ?";
const updateUserSubSQL = makeQuery(SQL_UPDATE_USER_SUB, pool);

//webPush.setVapidDetails('127.0.0.1:8080', publicVapidKey, privateVapidKey);
app.post('/notificationsSub', verifyJwtToken, (req, res) => {
    const token = req.body.token;
    const user = req.body.user;
    console.info(`Notification Token received >> ${token} for User >> ${user}`);

    //Update the user with the Subscription
    updateUserSubSQL( [ true, token, user ] )
        .then(result => {
            if(result.affectedRows != 0)
                return res.status(200).json({ message: 'Updated Notification Token', notification: true });
            else
                return res.status(404).json({ message: 'Updated Notification Token for the user unsuccessful' });
        })
        .catch(err => {
            return res.status(500).json({ message: err });
        })
});

app.post('/notificationsUnSub', verifyJwtToken, (req, res) => {
    const user = req.body.user;
    console.info(`Unsubscribe to Notification for User >> ${user}`);

    //Update the user with the Subscription
    updateUserSubSQL( [ false, '', user ] )
        .then(result => {
            if(result.affectedRows != 0)
                return res.status(200).json({ message: 'Updated Notification Token', notification: false });
            else
                return res.status(404).json({ message: 'Updated Notification Token for the user unsuccessful' });
        })
        .catch(err => {
            return res.status(500).json({ message: err });
        })
});

//--------------------------------------END USER NOTIFICATIONS SUBSCRIPTION-----------------------------------------------------

//---------------------------------START Reminders Pooling-------------------------------------------------------------------

const REMINDER_TYPE_WATER = 1;
const REMINDER_TYPE_BREAKFAST = 2;
const REMINDER_TYPE_LUNCH = 3;
const REMINDER_TYPE_DINNER = 4;
const REMINDER_TYPE_EXERCISE = 5;
const REMINDER_TYPE_SLEEP = 6;

//Get all the user info
const SQL_GET_ALL_USER = "SELECT user_id, name, email, rewards_pts, notification, notification_token from user";
const getAllUser = makeQuery(SQL_GET_ALL_USER, pool);

const SQL_GET_REMINDER_TYPE = "SELECT * from reminder_type where id = ?";
const getReminderType = makeQuery(SQL_GET_REMINDER_TYPE, pool);

//Insert a Reminder to Drink Water
const SQL_INSERT_REMINDERS = "Insert into reminders (reminder_type_id, title, image, message, reminder_date, user_id, rewards_pts) values ?";
const insertReminders = makeQueryForBulkInsert(SQL_INSERT_REMINDERS, pool);

let taskWaterNotification = cron.schedule('30 7-21 * * *', () => {
    console.info(`Running Task every 30mins between 7am to 10pm ${new Date()}`);
    createReminders(REMINDER_TYPE_WATER);
})
taskWaterNotification.start();

let taskBreakfastNotification = cron.schedule('0 8 * * *', () => {
    console.info(`Running Task every day at 8am ${new Date()}`);
    createReminders(REMINDER_TYPE_BREAKFAST);
})
taskBreakfastNotification.start();

let taskLunchNotification = cron.schedule('0 12 * * *', () => {
    console.info(`Running Task every day at 12pm ${new Date()}`);
    createReminders(REMINDER_TYPE_LUNCH);
})
taskLunchNotification.start();

let taskDinnerNotification = cron.schedule('0 18 * * *', () => {
    console.info(`Running Task every day at 6pm ${new Date()}`);
    createReminders(REMINDER_TYPE_DINNER);
})
taskDinnerNotification.start();

let taskExerciseNotification = cron.schedule('0 20 * * *', () => {
    console.info(`Running Task every day at 8pm ${new Date()}`);
    createReminders(REMINDER_TYPE_EXERCISE);
})
taskExerciseNotification.start();

let taskSleepNotification = cron.schedule('0 22 * * *', () => {
    console.info(`Running Task every day at 10pm ${new Date()}`);
    createReminders(REMINDER_TYPE_SLEEP);
})
taskSleepNotification.start();

// let testNotification = cron.schedule('30 26 * * * *', () => {
//     console.info(`Running Task every day at 10pm ${new Date()}`);
//     createReminders(REMINDER_TYPE_EXERCISE);
// })
// testNotification.start();

const createReminders = (type) => {
    //Create a Reminder for all the users and send notification
    return Promise.all([getAllUser(), getReminderType([type])])
        .then(results => {
            //Get user and ReminderType
            let user = results[0];
            let reminderType = results[1][0];

            //Set Reminder Date
            let reminderDate = new Date();

            switch(type) {
                case REMINDER_TYPE_WATER: 
                    reminderDate.setMinutes('30', '00', '00');
                    console.info('execute 30 mins');
                    break;
                default: 
                    reminderDate.setMinutes('00', '00', '00');
                    console.info('execute 00min');
                    break;
            }

            let values = [];
            for(let u of user)
            {
                let v = [ reminderType.id, reminderType.title, reminderType.image, reminderType.message, reminderDate, u.user_id, reminderType.rewards_pts ];
                values.push(v);
            }
            return Promise.all([insertReminders(values), Promise.resolve(user), Promise.resolve(reminderType)]);
        })
        .then(results => {

            //After Insert Successfully.
            //Send Push Notification to User
            let user = results[1];
            let reminderType = results[2];
            for(let u of user)
            {
                //Check if user is Subscribed for Notification if so do a push
                if(u.notification && u.notification_token != null)
                {
                    let payload = getNotificationPayLoad(reminderType, u);

                    fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'post',
                    body: payload,
                    headers : { 'Authorization': `key=${process.env.FCM_AUTHORIZATION_KEY}`,
                                'Content-Type': 'application/json'
                        },
                     })
                    .then(res => res)
                    .then(json => console.log(json));
                }
            }

            //Send Reminders Via Telegram
            sendRemindersViaTelegram(reminderType);

        })
        .catch(err => {
            console.error("Error Occured During Inserting Reminders>>>>>", err);
        })
}

const getNotificationPayLoad = (reminderType, user) => {
    const payload = JSON.stringify({
        notification: {
        title: reminderType.title,
        body: reminderType.message,
        icon: reminderType.image,
        vibrate: [100, 50, 100],
        },
        to: user.notification_token
    });

    return payload;
}

//--------------------------------------End Reminder Pooling -----------------------------------------------------

//---------------------------------Handle Reminders Request----------------------------------------------------

const REMINDER_STATUS_UNDONE = 0;
const REMINDER_STATUS_COMPLETED = 1;

const SQL_GET_USER_REMINDERS = "SELECT * from reminders where user_id = ? and DATE(reminder_date) > DATE_SUB(CURDATE(), INTERVAL 2 DAY) order by reminder_date desc";
const getUserReminders = makeQuery(SQL_GET_USER_REMINDERS, pool);

//Only Get Up to 2 Days of Record.
app.get('/getReminders', verifyJwtToken, (req, res) => {
    const user_id = req.query.user_id;

    getUserReminders([user_id])
        .then(results => {
            res.status(200).json(results);
        })
        .catch(err => {
            return res.status(500).type('application/json').json({ message: 'Error getting Reminder >>>' + err.message});
        })
})

const SQL_GET_USER_REMINDERS_HISTORY = "SELECT * from reminders where user_id = ? and status = 1 order by completed_date desc";
const getUserRemindersHistory = makeQuery(SQL_GET_USER_REMINDERS_HISTORY, pool);

//Only Get Up to 2 Days of Record.
app.get('/getRemindersHistory', verifyJwtToken, (req, res) => {
    console.info('res query', req.query);
    const user_id = req.query.user_id;

    getUserRemindersHistory([user_id])
        .then(results => {
            res.status(200).json(results);
        })
        .catch(err => {
            return res.status(500).type('application/json').json({ message: 'Error getting Reminder History>>>' + err.message});
        })
})

const SQL_GET_RECOMMENDED_MEAL_BY_REMINDER_ID = "Select m.image, m.message from meals m, reminders r where r.reminder_type_id = m.reminder_type_id and r.id = ?";
const getRecommendedMealByRId = makeQuery(SQL_GET_RECOMMENDED_MEAL_BY_REMINDER_ID, pool);

//GET /recommendMeal/:rId 
app.get('/recommendMeal/:rId', verifyJwtToken, (req, res) => {
    const reminder_id = req.params['rId'];

    //Get Recommended Meals
    getRecommendedMealByRId([ reminder_id ])
        .then(results => {
            if(results.length != 0)
            {
                let recommendedMeal = results[Math.floor(Math.random() * results.length)];
                return res.status(200).json( { recommendedMeal } )
            }
            else{
                return res.status(404).type('application/json').json({ message: 'No Meals to recommend'});
            }
        })
        .catch(err => {
            return res.status(500).type('application/json').json({ message: 'Error during recommending meal'});
        })
})

// 1. image 2. message 3. status 4. s3_image_key 5. completed_date where 6. user_id 7. id
const SQL_UPDATE_USER_REMINDER = "UPDATE reminders set image = ?, message = ?, status = ?, s3_image_key = ?, completed_date = ? where user_id = ? and id = ?"
const updateUserReminder = makeQuery(SQL_UPDATE_USER_REMINDER, pool);

// 1. image 2. message 3. status 4. s3_image_key where 5. user_id 6. id
const SQL_UPDATE_ADD_USER_REWARDS_PTS = "UPDATE user set rewards_pts = rewards_pts + ? where user_id = ?"

app.post('/completeReminder', verifyJwtToken, upload.single('image-file'), async (req, res) => {
    const r = req.body;  
    const f = req.file;
    // console.info(r);
    // console.info(f);  

    const conn = await pool.getConnection();

    try
    {
        await conn.beginTransaction;

        if(!f)
        {
            let rResults = await conn.query(SQL_UPDATE_USER_REMINDER, [r.image, r.message, REMINDER_STATUS_COMPLETED, '', new Date(), r.user_id, r.id]);
            console.info('Reminder Results>>>>', rResults);

            if(rResults.affectedRows == 0)
            {
                console.info('throwing reminder not updated error');
                throw new Error('Reminder not updated');
            }  

            let uResults = await conn.query(SQL_UPDATE_ADD_USER_REWARDS_PTS, [parseInt(r.rewards_pts), r.user_id]);
            console.info('uResults Results>>>>', uResults);

            if(uResults.affectedRows == 0)
                throw new Error('User Rewards Pts not Updated');

            conn.commit();

            return res.status(200).type('application/json').json({ message: 'Reminder Updated'});

            // updateUserReminder([r.image, r.message, REMINDER_STATUS_COMPLETED, '', r.user_id, r.id])
            // .then(results => {
            //     if(results.affectedRows == 0)
            //         return res.status(409).type('application/json').json({ message: 'Reminder not found. 0 Record Updated'})
            //     else
            //         return res.status(200).type('application/json').json({ message: 'Reminder Updated'});
            // })
            // .catch(err => {
            //     return res.status(500).type('application/json').json({ message: err.message })
            // })
        }
        else{

            let buff = await readFile(req.file.path);

            let s3PutObjResults = await s3PutObject(req.file, buff, s3);

            let rResults = await conn.query(SQL_UPDATE_USER_REMINDER, [s3PutObjResults.Location, r.message, REMINDER_STATUS_COMPLETED, s3PutObjResults.key, new Date(), r.user_id, r.id]);

            if(rResults.affectedRows == 0) {
                await s3RemoveObject(s3PutObjResults.key, s3);
                throw new Error('Reminder not updated');
            }

            console.info(console.info(parseInt(r.rewards_pts)));
            let uResults = await conn.query(SQL_UPDATE_ADD_USER_REWARDS_PTS, [parseInt(r.rewards_pts), r.user_id]);

            if(uResults.affectedRows == 0) {
                await s3RemoveObject(s3PutObjResults.key, s3);
                throw new Error('User Rewards Pts not Updated');
            }

            conn.commit();

            res.on('finish', () => {
                //delete the tmp file
                fs.unlink(req.file.path, () => {})
            })

            return res.status(200).type('application/json').json({ message: 'Reminder Updated to S3' })

            //Read File
            // readFile(req.file.path)
            //     .then(buff => s3PutObject(req.file, buff, s3))
            //     .then(result => {
            //         //Update DB with Key and the New URL.
            //         return updateUserReminder([result.Location, r.message, REMINDER_STATUS_COMPLETED, result.key, r.user_id, r.id])
            //             .then(sqlResults => {
            //                 if(sqlResults.affectedRows == 0) {
            //                     //Delete from S3.
            //                     s3RemoveObject(result.key, s3)
            //                     .then(r => {
            //                         return false;
            //                     })
            //                 }
            //                 return true;
            //             })

            //     })
            //     .then(results => {
            //         console.info(results);
            //         if(results)
            //         {
            //             res.on('finish', () => {
            //                 //delete the tmp file
            //                 fs.unlink(req.file.path, () => {})
            //             })
            //             return res.status(200).type('application/json').json({ message: 'Reminder Updated to S3' })
            //         }
            //     })
        }
    }
    catch(err) {
        conn.rollback();
        console.error('Error Completing Reminder>>>', err);
        return res.status(500).type('application/json').json({ message: err.message })
    }
    finally{
        conn.release();
    }
})

//------------------------- GET Weather Forecast-------------------------------------------------------------
app.get('/getWeatherForecast', verifyJwtToken, (req, res) => {

    const dt = new Date();
    const dateFormat = `${dt.getFullYear().toString().padStart(4, '0')}-${(dt.getMonth()+1).toString().padStart(2, '0')}-${dt.getDate().toString().padStart(2, '0')}T${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}:${dt.getSeconds().toString().padStart(2, '0')}`;
    const weather_base_url = "https://api.data.gov.sg/v1/environment/2-hour-weather-forecast";

    //Fetch from https://data.gov.sg/dataset/weather-forecast
    console.info(dateFormat);

    const url = withQuery(weather_base_url, {
        date_time: dateFormat
    })

    fetch(url)
        .then(res => res.json())
        .then(results => {
            const weatherForecast = {
                start_date: results.items[0].valid_period.start,
                end_date: results.items[0].valid_period.end,
                forecast: []
            }

            for(let w of results.items[0].forecasts)
            {
                weatherForecast.forecast.push(w);
            }
            console.info('Weather Forecast>>>>>' ,weatherForecast);
            return res.status(200).type('application/json').json({ weatherForecast })
        })
        .catch(err => {
            console.info(err.message);
        })
})

//------------------- Redeem Rewards ------------------------------------------------------
const SQL_UPDATE_SUBTRACT_USER_REWARDS_PTS = "Update user set rewards_pts = rewards_pts - ? where user_id = ?";
const subtractUserRewardsPts = makeQuery(SQL_UPDATE_SUBTRACT_USER_REWARDS_PTS, pool);

app.post('/redeemRewards', verifyJwtToken, (req, res) => {

    const randomJoke_url = "https://v2.jokeapi.dev/joke/Any?type=single";

    const type = req.body.type;
    const user_id = req.body.user_id;

    return getUserInfo([ user_id ])
        .then(results => {
            if( (parseInt(results[0].rewards_pts) - 1) < 0) {
                res.status(409).type('application/json').json({ message: "Not enough points"});
                throw new Error('Not enough points');
            }
            else 
                return subtractUserRewardsPts([ 1, user_id]);
        })
        .then(results => {
            if(results.affectedRows == 0) {
                res.status(500).type('application/json').json({ message: "Unable to update user"});
                throw new Error('Unable to update user');
            }
            return;
        })
        .then(results => {
            switch (type) {
                case 'jokes' : {
                    fetch(randomJoke_url)
                    .then(res => res.json())
                    .then(results => {
                        console.info(results.joke);
                        return res.status(200).type('application/json').json({ joke: results.joke })
                    })
                    .catch(err => {
                        console.error('Error during sending Redeeming Jokes', err.message)
                        return res.status(500).json({ error: 'Error when Redeeming Jokes >>>>' +  err.message})
                    })
                }
                break;
                default: 
                    return res.status(404).json({ message: 'No Reward Type Found'});
                break;
            }
            return;
        })
        .catch(err => {
            console.info('Error Occurred', err.message);
        })
})

//Angular Frontend [Copy from Angular Side dist/frontend after ng build --prod]
app.use(express.static(__dirname + '/frontend'));

app.use(express.static(__dirname + '/public'));

//Start Express
pool.getConnection()
    .then(conn => {
        let p0 = Promise.resolve(conn);
        let p1 = conn.ping;
        return Promise.all( [ p0, p1 ]);
    })
    .then(results => {
        //Start Express
        app.listen(PORT, ()=> {
            console.info(`Server Started on PORT ${PORT} at ${new Date()}`);
        })

        let conn = results[0];
        conn.release();
    })
    .catch(error => {
        console.error('Error Occurred: ', error);
    })