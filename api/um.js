import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import { users, games } from "./db/schema.js";
import { transporter } from "./mail.js";

export default class UM {
  constructor(db) {
    this.db = db;
    this.SECRET_KEY = process.env.SECRET_KEY;
  }

  generateId() {
    let uid = '';
    let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 32; i++) {
      uid += chars[Math.floor(Math.random() * chars.length)];
    }
    return uid;
  }

  async generateTableId(table, column) {
    var uid;
    // generate a random unused uid
    while (true) {
      uid = this.generateId();
      var rows = await this.db
        .select()
        .from(table)
        .where(eq(table[column], uid));
      if (rows.length == 0) return uid;
    }
  }

  getCleanParamsString(params, defaultParams = {}) {
    let cleanedParams = defaultParams;
    for (const param of [ 'iso', 'lng' ]) {
      try {
        cleanedParams[param] = params[param];
      } catch(err) {}
    }
    if (!cleanedParams.iso) cleanedParams.iso = 'wor'
    if (!cleanedParams.lng) cleanedParams.lng = 'en'
    return JSON.stringify(cleanedParams)
  }

  async sendVerificationEmail(email, name, vkey) {
    const token = Buffer.from(vkey + name).toString('base64');
    const url = process.env.LOCATION_WEB + 'verify/' + token;

    if (process.env.DEBUG) {
      console.log(name, email, url);
      return;
    }

    await transporter.sendMail({
      from: `"The Geographer" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "The Geographer - email verification",
      html: `Hi <b>${name}</b>,<br/><br/>Welcome to The Geographer !<br/><br/>Before logging in, please verify your email using the following link :<br/><br/><a href="${url}">Verify</a><br/><br/>Have a great time on the website !`, // plain‑text body
    });
  }

  async createUser(req, res) {
    try {
      if (!req.body.username) return res.status(300).send("Field username not specified")
      if (!req.body.password) return res.status(300).send("Field password not specified")
      if (!req.body.email) return res.status(300).send("Field email not specified")
      const { username, password, email, params } = req.body;

      const existingUsername = await this.db.select().from(users).where(eq(users.name, username));
      if (existingUsername.length > 0) return res.status(300).send("This username is already taken");
      const existingEmail = await this.db.select().from(users).where(eq(users.email, email));
      if (existingEmail.length > 0) return res.status(300).send("This email is already taken");

      const hash = bcrypt.hashSync(password);
      const vkey = await this.generateTableId(users, 'vkey');
      await this.db.insert(users).values({
        name: username,
        hash, email, vkey,
        params: this.getCleanParamsString(params)
      });

      // send a verification email...
      this.sendVerificationEmail(email, username, vkey)

      res.status(200).send();
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async verifyUser(req, res, next) {
    try {
      if (!req.body.token) return res.status(300).send("Field token not specified")
      const decyphered = Buffer.from(req.body.token, 'base64').toString('ascii');
      if (decyphered.length <= 32) return res.status(300).send("Wrong verification link");
      const vkey = decyphered.substring(0, 32);
      const username = decyphered.substring(32);

      var existing = await this.db.select().from(users).where(eq(users.name, username));
      if (existing.length == 0) return res.status(300).send("This user does not exist");
      
      const user = existing[0];
      if (user.verified) return res.status(300).send("User is already verified");
      if (user.vkey != vkey) return res.status(300).send("Wrong verification link");

      await this.db.update(users)
        .set({ vkey: null, verified: true })
        .where(eq(users.name, username));

      user.verified = true;
      req.user = user;
      next();
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async sendUserLogged(token, user, res) {
    if (user.verified) {
      res.status(200).json({ token, name: user.name, email: user.email, params: JSON.parse(user.params) });
    } else {
      res.status(300).send("Please verify your account before logging")
    }
  }

  async logUser(req, res) {
    try {
      var user;
      if (req.user) user = req.user;
      else {
        if (!req.body.username) return res.status(300).send("Field username not specified")
        if (!req.body.password) return res.status(300).send("Field password not specified")
        const { username, password } = req.body;
        var existing = await this.db.select().from(users).where(eq(users.name, username));
        if (existing.length == 0) return res.status(300).send("This user does not exist");
        user = existing[0];
        if (!bcrypt.compareSync(password, user.hash)) return res.status(300).send("Wrong password");
      }
      const token = jsonwebtoken.sign({ id: user.id, name: user.name }, this.SECRET_KEY, { expiresIn: '10d' });
      this.sendUserLogged(token, user, res);
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async reLogUser(req, res) {
    try {
      var existing = await this.db.select().from(users).where(eq(users.name, req.user.name));
      if (existing.length == 0) return res.status(300).send("This user does not exist");
      const token = jsonwebtoken.sign({ id: req.user.id, name: req.user.name }, this.SECRET_KEY, { expiresIn: '10d' });
      this.sendUserLogged(token, existing[0], res);
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async changeParams(req, res) {
    try {
      if (!req.body.params) return res.status(300).send("Field params not specified");
      const newParamsString = this.getCleanParamsString(req.body.params, req.user.params);
      await this.db.update(users)
        .set({ params: newParamsString })
        .where(eq(users.name, req.user.name));
      return res.status(200).send(newParamsString);
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }

  async getHighestReal(type) {
    const selected = {
      uname: games.uname,
      date: games.date,
      time: games.time,
      accuracy: games.accuracy
    };

    const highestTime = (await this.db.select(selected)
      .from(games)
      .where(eq(games.type, type))
      .orderBy(asc(games.time))
      .limit(1))[0];
    
    if (highestTime) {
      const htUser = (await this.db.select().from(users).where(eq(users.name, highestTime.uname)))[0];
      highestTime.iso = JSON.parse(htUser.params).iso;
    }

    const highestAccuracy = (await this.db.select(selected)
      .from(games)
      .where(eq(games.type, type))
      .orderBy(desc(games.accuracy))
      .limit(1))[0];

    if (highestAccuracy) {
      const haUser = (await this.db.select().from(users).where(eq(users.name, highestAccuracy.uname)))[0];
      highestAccuracy.iso = JSON.parse(haUser.params).iso;
    }

    return { highestTime, highestAccuracy };
  }

  async saveGame(req, res) {
    try {

      if (!req.body.type) return res.status(300).send("Field type not specified");
      if (!req.body.time) return res.status(300).send("Field time not specified");
      if (!req.body.accuracy) return res.status(300).send("Field accuracy not specified");

      const previousResults = await this.db.select()
        .from(games)
        .where(and(eq(games.uname, req.user.name), eq(games.type, req.body.type)));

      const highestReal = await this.getHighestReal(req.body.type);

      await this.db.insert(games).values({
        type: req.body.type,
        time: req.body.time,
        accuracy: req.body.accuracy,
        date: new Date(),
        uname: req.user.name
      })

      return res.status(200).send({
        previousResults,
        ...highestReal
      });

    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }

  async getHighest(req, res) {
    try {      
      if (!req.params.type) return res.status(300).send("Field type not specified");
      return res.status(200).send(await this.getHighestReal(req.params.type));
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }

  async getLeaderboards(req, res) {
    try {      
      if (!req.params.type) return res.status(300).send("Field type not specified");

      const fullTable = await this.db.select()
        .from(games)
        .where(eq(games.type, req.params.type))
        .orderBy(asc(games.time));
    
      const usersResults = {};
      for (const entry of fullTable) {
        if (!usersResults[entry.uname] || usersResults[entry.uname].time > entry.time) {
          usersResults[entry.uname] = entry;
        }
      }

      const resultTable = Object.values(usersResults).sort((a, b) => a.time - b.time).splice(0, 100);
      for (const entry of resultTable) {
        const user = (await this.db.select().from(users).where(eq(users.name, entry.uname)))[0];
        entry.iso = JSON.parse(user.params).iso;
      }

      return res.status(200).send(resultTable);
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }

  async getStats(req, res) {
    try {
      if (!req.params.uname) return res.status(300).send("Field uname not specified");
      const uname = req.params.uname;

      const existingUsers = await this.db.select()
        .from(users)
        .where(eq(users.name, uname));

      if (existingUsers.length == 0) return res.status(300).send("This user does not exist");

      const user = existingUsers[0];

      const table = await this.db.select()
        .from(games)
        .where(eq(games.uname, uname));

      const ugames = {};
      for (const entry of table) {
        if (!ugames[entry.type]) ugames[entry.type] = { u: [] };
        ugames[entry.type].u.push({
          date: entry.date,
          type: entry.type,
          time: entry.time,
          accuracy: entry.accuracy
        })
      }

      const types = Object.keys(ugames).map(t => ({ t, type: t[0], difficulty: t[1], region: t.substring(2) }));
      const grouped = Object.groupBy(types, ({ region }) => region);
      for (const region of Object.keys(grouped)) {
        grouped[region] = Object.groupBy(grouped[region], ({ type }) => type);
        for (const type of Object.keys(grouped[region])) {
          grouped[region][type] = Object.groupBy(grouped[region][type], ({ difficulty }) => difficulty);
          for (const difficulty of Object.keys(grouped[region][type])) {
            var typegames = ugames[type + difficulty + region];
            var bestgame = typegames.u.sort((a, b) => a.time - b.time)[0];
            bestgame.ngames = typegames.u.length;
            
            bestgame.rank = (await this.db.select({ uname: games.uname })
              .from(games)
              .where(and(eq(games.type, type + difficulty + region), lte(games.time, bestgame.time)))
              .groupBy(games.uname)
            ).length;

            grouped[region][type][difficulty] = bestgame;
          }
        }
      }

      return res.status(200).send({ 
        user: { name: user.name, iso: JSON.parse(user.params).iso },
        games: grouped
      });

    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }
}