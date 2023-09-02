import fs from 'fs';
import https from 'https';

import { nanoid } from 'nanoid';

import 'dotenv/config';

import { QuickDB } from 'quick.db';
const db = new QuickDB();

import express from 'express';
const app = express();

const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/jomity.net/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/jomity.net/cert.pem')
};
const port = 3030;
const version = '1.0';
const appid = process.env.APPID;
const limit = 1000 * 60 * 60 * 24 * 7; // 1 week

app.get('/', async (req, res) => {
    let query = req.query;

    // Request parameters
    let in_appid = query["appid"];
    let in_user = query["user"];
    let in_pass = query["pass"];
    let in_token = query["token"];
    let in_version = query["version"];

    // Response parameters
    let result = 0;
    let message = "Incomplete authentication.";

    // Only used if result is a success
    let userid = null;
    let data = {"Token": "", "UserID": ""};

    // must have appid, user, (pass or token), and version
    if (!in_appid || !in_user || (!in_pass && !in_token) || !in_version) {
        result = 3;
        message = "Missing parameters.";
    }
    else if (in_appid != appid) {
        result = 5;
        message = "Invalid appid token.";
    }
    else if (in_version != version) {
        result = 4;
        message = "Version mismatch.";
    }
    else {
        let user = await db.get(`users.${in_user}`);

        if (!user) {
            if (!in_pass || in_token) {
                result = 3;
                message = "No username found, and no new password provided.";
            }
            else if (in_user.length < 4 || in_user.length > 16) {
                result = 3;
                message = "Username must be between 4 and 16 characters.";
            }
            else if (!in_user.match(/^[a-zA-Z0-9_]+$/)) {
                result = 3;
                message = "Username can only contain alphanumeric characters and underscores.";
            }
            else if (in_pass && !in_pass.match(/^[A-Fa-f0-9]{64}$/)) {
                result = 3;
                message = "Invalid password format.";
            }
            else if (fs.readFileSync('./blacklist.txt').toString().split('\n').includes(in_user)) {
                result = 3;
                message = "Username is blacklisted.";
            }
            else {
                const token = nanoid(32);
                
                let date = Date.now() + limit;
                await db.set(`users.${in_user}`, { username: in_user, password: in_pass, token: token, expires: date });

                result = 1;
                message = "Success. New user created.";
                userid = in_user;
                data["Token"] = token;
                data["UserID"] = userid;
            }
        }
        else if (in_pass && (user.password != in_pass)) {
            result = 2;
            message = "Incorrect username or password.";
        }
        else if (in_token && !in_token.match(/^[A-Za-z0-9_-]{32}$/)) {
            result = 3;
            message = "Invalid token format.";
        }
        else if (in_token && (user.token != in_token || user.expires < Date.now())) {
            result = 3;
            message = "Token invalid or expired.";
        }
        else if (fs.readFileSync('./blacklist.txt').toString().split('\n').includes(in_user)) {
            result = 2;
            message = "Username is blacklisted.";
        }
        else {
            let token = user.token;

            if (in_pass && user.expires < Date.now()) {
                token = nanoid(32);

                let date = Date.now() + limit;
                await db.set(`users.${in_user}`, { username: in_user, password: in_pass, token: token, expires: date });
            }

            result = 1;
            message = "Success. User logged in.";
            userid = in_user;
            data["Token"] = token;
            data["UserID"] = userid;
        }
    }
    
    let json = {"ResultCode": result};

    if (message) {
        json["Message"] = message;
    }

    if (result == 1 && userid) {
        json["UserID"] = userid;
    }
    
    if ((result == 1 || result == 0) && data?.["Token"] && data?.["UserID"]) {
        json["Data"] = data;
    }

    console.log(json);

    res.json(json);
});

const server = https.createServer(options, app);

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});