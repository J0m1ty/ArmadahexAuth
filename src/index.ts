import { App } from 'uWebSockets.js';
import { QuickDB } from 'quick.db';
import { nanoid } from 'nanoid';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import type { User, AuthResponse, AuthQuery } from './types';

config();

const db = new QuickDB();
const port = Number(process.env.PORT) ?? 3030;
const version = '1.0';
const appid = process.env.APPID;
const limit = 1000 * 60 * 60 * 24 * 7; // 1 week

if (!appid) {
    throw new Error('APPID environment variable is not set');
}

export const app = App();

// Handle all requests at root
app.get('/*', async (res, req) => {
    const url = new URL('http://localhost' + req.getUrl() + '?' + req.getQuery());
    const query = Object.fromEntries(url.searchParams) as AuthQuery;

    let result = 0;
    let message = 'Incomplete authentication.';
    let userid: string | null = null;
    let data: AuthResponse['Data'] | undefined;

    try {
        if (!query.appid || !query.user || (!query.pass && !query.token) || !query.version) {
            result = 3;
            message = 'Missing parameters.';
        } else if (query.appid !== appid) {
            result = 5;
            message = 'Invalid appid token.';
        } else if (query.version !== version) {
            result = 4;
            message = 'Version mismatch.';
        } else {
            const user = (await db.get(`users.${query.user}`)) as User | null;
            const blacklist = readFileSync('./blacklist.txt', 'utf-8').split('\n');

            if (!user) {
                if (!query.pass || query.token) {
                    result = 3;
                    message = 'No username found, and no new password provided.';
                } else if (query.user.length < 4 || query.user.length > 16) {
                    result = 3;
                    message = 'Username must be between 4 and 16 characters.';
                } else if (!/^[a-zA-Z0-9_]+$/.test(query.user)) {
                    result = 3;
                    message = 'Username can only contain alphanumeric characters and underscores.';
                } else if (query.pass && !/^[A-Fa-f0-9]{64}$/.test(query.pass)) {
                    result = 3;
                    message = 'Invalid password format.';
                } else if (blacklist.includes(query.user)) {
                    result = 3;
                    message = 'Username is blacklisted.';
                } else {
                    const token = nanoid(32);
                    const expires = Date.now() + limit;

                    await db.set(`users.${query.user}`, {
                        username: query.user,
                        password: query.pass,
                        token,
                        expires,
                    });

                    result = 1;
                    message = 'Success. New user created.';
                    userid = query.user;
                    data = { Token: token, UserID: userid };
                }
            } else {
                if (query.pass && user.password !== query.pass) {
                    result = 2;
                    message = 'Incorrect username or password.';
                } else if (query.token && !/^[A-Za-z0-9_-]{32}$/.test(query.token)) {
                    result = 3;
                    message = 'Invalid token format.';
                } else if (
                    query.token &&
                    (user.token !== query.token || user.expires < Date.now())
                ) {
                    result = 3;
                    message = 'Token invalid or expired.';
                } else if (blacklist.includes(query.user)) {
                    result = 2;
                    message = 'Username is blacklisted.';
                } else {
                    let token = user.token;

                    if (query.pass && user.expires < Date.now()) {
                        token = nanoid(32);
                        const expires = Date.now() + limit;

                        await db.set(`users.${query.user}`, {
                            username: query.user,
                            password: query.pass,
                            token,
                            expires,
                        });
                    }

                    result = 1;
                    message = 'Success. User logged in.';
                    userid = query.user;
                    data = { Token: token, UserID: userid };
                }
            }
        }

        const response: AuthResponse = { ResultCode: result };
        if (message) response.Message = message;
        if (result === 1 && userid) response.UserID = userid;
        if ((result === 1 || result === 0) && data) response.Data = data;

        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(response));
    } catch (error) {
        console.error(error);
        res.writeStatus('500 Internal Server Error');
        res.end(JSON.stringify({ ResultCode: 6, Message: 'Internal server error' }));
    }
}).listen("0.0.0.0", port, (listenSocket) => {
    if (listenSocket) console.log(`Server is running on 0.0.0.0:${port}`);
    else console.error(`Failed to start server on port ${port}`);
});
