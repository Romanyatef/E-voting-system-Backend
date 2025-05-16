const mysql = require('mysql');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password : '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});
 
connection.connect((err)=> {
  if (err) {
    console.error('connection error');
    console.log(err)
    return;
  }
 
  console.log('connected ');
});


module.exports=connection;