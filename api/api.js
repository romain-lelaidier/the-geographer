import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { rateLimit } from 'express-rate-limit';
import jsonwebtoken from "jsonwebtoken";

import * as schema from "./db/schema.js";
import UM from "./um.js";
import * as fs from "fs";

// ip getter
const getip = (req) => req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

// ----- database connection -----
const pool = await mysql.createPool({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.DB_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD,
  idleTimeout: 10000,
  enableKeepAlive: true
})

const db = drizzle(pool, { schema, mode: "default" });

// ----- users manager -----
var um = new UM(db);

// ----- logger -----
// async function log(origin, req, { vid='', name='', subname='' }) {
//   try {
//     await db.insert(schema.logs)
//       .values({
//         ip: getip(req).substring(0, 32),
//         date: new Date(),
//         type: origin.substring(0, 8),
//         vid, name, subname
//       })
//   } catch(err) {
//     console.error(err);
//   }
// }

// ----- web server -----
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// throttling
const limiter = rateLimit({
  windowMs: 1 * 1000, // 1 second
  limit: 4,
  keyGenerator: getip
})

// app.use(limiter);

// ----- um -----
app.post('/api/um/signup', (req, res) => um.createUser(req, res));
app.post('/api/um/verify', (req, res, next) => um.verifyUser(req, res, next), (req, res) => um.logUser(req, res))
app.post('/api/um/login', (req, res) => um.logUser(req, res));

const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jsonwebtoken.verify(token, um.SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

app.post('/api/um/relog', authenticateJWT, (req, res) => um.reLogUser(req, res));
app.post('/api/um/changeparams', authenticateJWT, (req, res) => um.changeParams(req, res));
app.post('/api/um/savegame', authenticateJWT, (req, res) => um.saveGame(req, res));
app.get('/api/um/gethighest/:type', (req, res) => um.getHighest(req, res));
app.get('/api/um/leaderboards/:type', (req, res) => um.getLeaderboards(req, res));
app.get('/api/um/stats/:uname', (req, res) => um.getStats(req, res));

// data files
const availableFiles = fs.readdirSync('./data').map(file => file.split('.bin')[0])

app.get('/api/data/:file', (req, res) => {
  if (availableFiles.includes(req.params.file)) {
    res.status(200);
    fs.createReadStream(`./data/${req.params.file}.bin`).pipe(res);
  } else {
    res.sendStatus(404);
  }
})

const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});