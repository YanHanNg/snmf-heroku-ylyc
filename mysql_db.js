require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({   
    host: process.env.MYSQL_SERVER || 'localhost',   
    port: parseInt(process.env.MYSQL_SVR_PORT) || 3306,   
    database: process.env.MYSQL_SCHEMA,   
    user: process.env.MYSQL_USERNAME,   
    password: process.env.MYSQL_PASSWORD,   
    connectionLimit: parseInt(process.env.MYSQL_CONN_LIMIT) || 4,   
    connectTimeout: 20000,
    waitForConnections: true,
    // comment out ssl if running locally. this is for connecting to digital ocean
    // ssl: {
    //     ca: fs.readFileSync(__dirname + '/certs/ca-certificate.crt'),
    // },
    timezone: process.env.DB_TIMEZONE || '+08:00'   
})

const makeQuery = (sql, pool) => {  
    return (async (args) => {  
        const conn = await pool.getConnection();  
        try {  
            let results = await conn.query(sql, args || []);  
            //Only need first array as it contains the query results.  
            //index 0 => data, index 1 => metadata  
            return results[0];  
        }  
        catch(err) {  
            console.error('Error Occurred during Query', err);  
            throw new Error(err);
        }  
        finally{  
            conn.release();  
        }  
    })  
} 

const makeQueryForBulkInsert = (sql, pool) => {
    return (async (args) => {  
        const conn = await pool.getConnection();  
        try {  
            let results = await conn.query(sql, [args]);  
            //Only need first array as it contains the query results.  
            //index 0 => data, index 1 => metadata  
            return results[0];  
        }  
        catch(err) {  
            console.error('Error Occurred during Query', err);  
            throw new Error(err);
        }  
        finally{  
            conn.release();  
        }  
    })  
}

module.exports = {makeQuery, makeQueryForBulkInsert, pool};