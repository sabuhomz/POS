import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from './config/database.js'

const username=process.argv[2]
const password=process.argv[3]
if(!username||!password){console.error('Usage: npm run create-admin -- <username> <password>');process.exit(1)}
if(password.length<8){console.error('Password must be at least 8 characters');process.exit(1)}
try{
 const exists=await pool.query('SELECT id FROM users WHERE username=$1',[username])
 if(exists.rowCount) throw new Error('Username already exists')
 const hash=await bcrypt.hash(password,12)
 const r=await pool.query(`INSERT INTO users(username,password_hash,role,store_id,is_active) VALUES($1,$2,'ADMIN',NULL,true) RETURNING id,username,role`,[username,hash])
 console.log('Initial Admin created:',r.rows[0])
}finally{await pool.end()}
