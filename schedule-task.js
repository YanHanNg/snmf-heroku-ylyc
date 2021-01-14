require('dotenv').config();

//Cron
const cron = require('node-cron');
const fetch = require('node-fetch');
const withQuery = require('with-query').default;
const { pool, makeQueryForBulkInsert } = require('./mysql_db.js');

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY || '';
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com/recipes/complexSearch';

const REMINDER_TYPE_WATER = 1;
const REMINDER_TYPE_BREAKFAST = 2;
const REMINDER_TYPE_LUNCH = 3;
const REMINDER_TYPE_DINNER = 4;
const REMINDER_TYPE_EXERCISE = 5;
const REMINDER_TYPE_SLEEP = 6;

//TESTING PURPOSE
// let testNotification = cron.schedule('59 23 * * * 7', async () => {
//     console.info(`Running Update Meals Database Every Sunday at 23:59 ${new Date()}`);
//     try {
//         await updateDBonMeals();
//     }
//     catch(err) {
//         console.error('Error when updating Meals', err.message);
//     }
// })
// testNotification.start();

const SQL_INSERT_BULK_INTO_MEALS = "INSERT into meals (reminder_type_id, image, message) values ?";
const insertIntoMeals = makeQueryForBulkInsert(SQL_INSERT_BULK_INTO_MEALS, pool);

const getMeals = (reminderType) => {
    let url = '';

    switch (reminderType) {
        case REMINDER_TYPE_BREAKFAST: {
            url = withQuery(SPOONACULAR_BASE_URL, {
                apiKey: SPOONACULAR_API_KEY,
                type: 'breakfast, bread, salad',
                maxCalories: 400,
                maxFat: 15,
                maxProtein: 20,
                maxCarbs: 30,
                number: 100
            })
        }
        break;
        case REMINDER_TYPE_LUNCH: {
            url = withQuery(SPOONACULAR_BASE_URL, {
                apiKey: SPOONACULAR_API_KEY,
                type: 'main course',
                maxCalories: 600,
                maxFat: 25,
                maxProtein: 30,
                maxCarbs: 60,
                offset: 0,
                number: 100
            })
        }
        break;
        case REMINDER_TYPE_DINNER: {
            url = withQuery(SPOONACULAR_BASE_URL, {
                apiKey: SPOONACULAR_API_KEY,
                type: 'breakfast, bread, salad',
                maxCalories: 600,
                maxFat: 25,
                maxProtein: 30,
                maxCarbs: 60,
                offset: 1,
                number: 100
            })
        }
        break;
        default:
            break;
    }
    
    return fetch(url)
        .then(results => results.json())
        .then(jsonResults => jsonResults.results)
        .catch(err => {
            console.error('Error Occured: ', err.message);
        })
}

const updateDBonMeals = async () => {
    const conn = await pool.getConnection();
    let values = [];

    try {
        await conn.beginTransaction();

        await conn.query("DELETE from meals where id > 0");

        let [rB, rL, rD] = await Promise.all([getMeals(REMINDER_TYPE_BREAKFAST), getMeals(REMINDER_TYPE_LUNCH), getMeals(REMINDER_TYPE_DINNER)])

        //Breakfast
        values = [];
        if(rB.length > 0)
        {
            for(let b of rB) {
                let v = [REMINDER_TYPE_BREAKFAST, b.image, b.title];
                values.push(v);
            }
            if(values)
                await conn.query(SQL_INSERT_BULK_INTO_MEALS, [values]);
        }
        
        //Lunch
        values = [];
        if(rL.length > 0) {
            for(let l of rL) {
                let v = [REMINDER_TYPE_LUNCH, l.image, l.title];
                values.push(v);
            }
            if(values)
                await conn.query(SQL_INSERT_BULK_INTO_MEALS, [values]);
        }
            

        //Dinner
        values = [];
        if(rD.length > 0) {
            for(let d of rD) {
                let v = [REMINDER_TYPE_DINNER, d.image, d.title];
                values.push(v);
            }
            if(values)
                await conn.query(SQL_INSERT_BULK_INTO_MEALS, [values]);
        }
        
        await conn.commit();
        console.info('Meals DB Updated');
    }
    catch(err) {
        console.info(err);
        conn.rollback();
    }
    finally {
        conn.release();
    }
}

module.exports = {};