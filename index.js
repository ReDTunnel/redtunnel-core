const net = require('net');
const ejs = require('ejs');
const http = require('http');
const crypto = require('crypto');
const uuidv1 = require('uuid/v1');
const express = require('express');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const sharedSession = require("express-socket.io-session");

const db = require('./models');
const routes = require('./routes');
const config = require('./config');

const app = express();
const session = require('express-session')({
    name: 'redtunnel',
    secret: config.SECRET,
    resave: false,
    saveUninitialized: false,
});


function parseRawBody(req, res, buf, encoding) {
    if (buf) {
        req.rawBody = buf.toString(encoding || 'utf-8');
    }
}

app.set('view engine', 'ejs');
app.use(bodyParser.json({verify: parseRawBody}));
app.use(bodyParser.urlencoded({verify: parseRawBody, extended: true}));
app.use(bodyParser.raw({verify: parseRawBody, type: '*'}));
app.use(express.static('public'));
app.use(session);

const client = new net.Socket();
const server = http.Server(app);
const io = socketIO(server, {
    wsEngine: 'ws',
    pingTimeout: 3000,
    pingInterval: 5000,
    transports: ['websocket']
});

const resources = {};
const timeouts = {};

function isRebindSubDomain(domainParts) {
    return (
        domainParts.length > 3 &&
        domainParts[0].match(/^\d{1,3}(-\d{1,3}){3}$/) &&
        domainParts[1].match(/^\d{2,5}$/) &&
        domainParts[2].match(/^\w{32}$/)
    )
}

app.use((req, res, next) => {
    if (!req.hostname) {
        return next();
    }
    let domainParts = req.hostname.split('.');
    if (!isRebindSubDomain(domainParts)) {
        return next();
    }
    if (!req.session.isAdmin) {
        return res.status(401).send("Not Authorized");
    }

    let id = domainParts[2];
    let ip = domainParts[0].replace(/-/g, '.');
    let port = Number(domainParts[1]) || 80;
    let method = req.method || "GET";
    let headers = req.headers || {};
    let body = req.rawBody;

    let uuid = uuidv1();
    resources[uuid] = res;

    for (let header of config.UNSAFE_HEADERS) {
        delete headers[header.toLocaleLowerCase()];
    }
    db.Config.findOne().select('responseTimeout').exec((err, data) => {
        if (!data) {
            data = JSON.parse(JSON.stringify(new db.Config()));
        }
        setTimeout(() => {
            try {
                if (!resources[uuid]) {
                    return;
                }
                delete resources[uuid];
                res.status(408).send('Request Timeout');
            } catch (e) {
                console.error(e);
            }
        }, data.responseTimeout);
    });

    io.emit(id, {
        type: "resource",
        id: id,
        ip: ip,
        port: port,
        path: req.originalUrl,
        method: method,
        headers: headers,
        body: body,
        uuid: uuid
    });

    // console.log(JSON.stringify({
    //     type: "resource",
    //     id: id,
    //     ip: ip,
    //     port: port,
    //     path: req.originalUrl,
    //     method: method,
    //     headers: headers,
    //     body: body,
    //     uuid: uuid
    // }, undefined, 2));
    // console.log(`resource '${req.originalUrl}' requested from ${id} ${ip}:${port}`);
});

app.use((req, res, next) => {
    res.set({
        'Server': 'ReDTunnel',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    });
    next();
});

// Api Router
app.use('/api', routes.api);


// Routes
app.get('/', (req, res) => {
    res.render('main');
});

app.get('/admin(/*)?', (req, res) => {
    res.render('admin');
});

app.get('/ping', (req, res) => {
    res.render('ping');
});

app.get('/scan', (req, res) => {
    res.render('scan');
});

app.get('/rebind', (req, res) => {
    client.write(`${JSON.stringify({
        type: "dns",
        method: "add",
        hostname: req.hostname,
        id: req.hostname.split('.')[1]
    })}\n`);
    res.render('rebind');
});

app.get('/register', (req, res) => {
    res.json({
        id: crypto.randomBytes(16).toString('hex')
    });
});

app.get('/config', (req, res) => {
    db.Config.findOne().exec((err, data) => {
        if (err) {
            return res.json({error: err.message});
        }
        if (!data) {
            data = JSON.parse(JSON.stringify(new db.Config()));
            delete data._id;
        }
        return res.json(data);
    });
});


function getResource(data) {
    try {
        let res = resources[data.uuid];
        // console.log(data);

        if (!res) {
            // console.log("Response Timed Out");
            return;
        }

        // Content-Encoding: gzip, compress, deflate, identity, br
        delete data.headers['content-encoding'];

        // Transfer-Encoding: chunked, compress, deflate, gzip, identity
        delete data.headers['transfer-encoding'];

        res.set(data.headers);
        if (data.redirected) {
            res.redirect(301, data.url)
        } else {
            res.status(data.status);
            if (data.content) {
                try {
                    res.send(Buffer.from(data.content, 'base64'));
                } catch (e) {
                    console.error(e);
                }
            }
        }
        res.end();
        delete resources[data.uuid];
    } catch (e) {
        console.error(e);
    }
}

io.use(sharedSession(session));
io.on('connection', (socket) => {
    let id = socket.handshake.query.id;
    if (id === 'admin') {
        // console.log(socket.handshake.session.isAdmin);
        if (socket.handshake.session && !socket.handshake.session.isAdmin) {
            // socket.disconnect(true);
            socket.disconnect();
            // console.log('socket.disconnect');
        }
        return;
    }

    if (timeouts[id]) {
        clearTimeout(timeouts[id]);
    }
    console.log(`${id} connected`);
    let data = {
        type: "status",
        ip: socket.conn.remoteAddress,
        id: id,
        status: "connected"
    };
    // console.log(JSON.stringify(data));
    io.emit('admin', data);

    socket.on(id, (data) => {
        // console.log(JSON.stringify(data));

        switch (data.type) {
            case "resource":
                getResource(data);
                break;
            case "ping":
            case "scan":
                io.emit('admin', data);
                break;
            case "rebind":
                let domain = socket.handshake.headers.host.replace('www.', '');
                data.hostname = `${data.ip.replace(/\./g, '-')}.${data.port}.${data.id}.${domain}`;

                io.emit('admin', data);
                if (!data.error) {
                    const rebind = new db.Rebind(data);
                    rebind.save();
                }
                break;
        }
    });

    socket.on('disconnect', () => {
        timeouts[id] = setTimeout(() => {
            client.write(`${JSON.stringify({
                type: "dns",
                method: "del",
                id: id
            })}\n`);

            db.Rebind.deleteMany({id: id});
        }, 60000);

        console.log(`${socket.handshake.query.id} disconnected`);
        let data = {
            type: "status",
            ip: socket.conn.remoteAddress,
            id: id,
            status: "disconnect"
        };
        // console.log(JSON.stringify(data));
        io.emit('admin', data);
    });
});


mongoose.connect(
    `mongodb://${config.DATABASE_HOST}:${config.DATABASE_PORT}/ReDTunnel`, {
        useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false
    }, (err) => {
        if (err) {
            console.log(err.message);
            process.exit(1);
        }

        console.log(`Connected to the database on ${config.DATABASE_HOST}:${config.DATABASE_PORT}...`);
        client.connect(config.DNS_PORT, config.DNS_HOST, () => {
            if (err) {
                console.log(err.message);
                process.exit(1);
            }

            console.log(`Connected to the dns on ${config.DNS_HOST}:${config.DNS_PORT}...`);
            server.listen(config.SERVER_PORT, config.SERVER_HOST, () => {
                if (err) {
                    console.log(err.message);
                    process.exit(1);
                }

                console.log(`Listening on ${config.SERVER_HOST}:${config.SERVER_PORT}...`);
            });
        });
    }
);
