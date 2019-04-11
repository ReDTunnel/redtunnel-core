const express = require('express');

const db = require('../models');

const router = express.Router();

router.get('/logout', (req, res) => {
    req.session.isAdmin = false;
    return res.json({
        success: true
    });
});

router.post('/login', (req, res) => {
    db.User.countDocuments().exec((err, data) => {
        if (err) {
            return res.json({error: err.message});
        } else if (!data) {
            return res.json({error: "setup is required"});
        }

        db.User.findOne({username: req.body.username}).select('password').exec((err, data) => {
            if (err) {
                return res.json({error: err.message});
            } else if (!data) {
                return res.json({error: "invalid username or password"});
            }

            data.comparePassword(req.body.password, (err, data) => {
                if (err) {
                    return res.json({error: err.message});
                }
                if (!data) {
                    return res.json({error: 'invalid username or password'});
                }

                req.session.cookie.domain = req.hostname.replace(/^(www|admin)./, '.');
                req.session.isAdmin = true;
                req.session.save((err) => {
                    if (err) {
                        return res.json({error: err.message});
                    }

                    return res.json({authenticated: true});
                });
            });
        })
    });
});

router.get('/authenticated', (req, res) => {
    return res.json({authenticated: !!req.session.isAdmin});
});

router.route('/setup')
    .get((req, res) => {
        db.User.countDocuments().exec((err, data) => {
            if (err) {
                return res.json({error: err.message});
            }

            return res.json({required_setup: !data});
        });
    })
    .post((req, res) => {
        db.User.countDocuments().exec((err, data) => {
            if (err) {
                return res.json({error: err.message});
            } else if (data) {
                return res.json({error: "setup is not required"});
            }

            const user = new db.User({
                username: req.body.username,
                password: req.body.password
            });

            user.save(function (err) {
                if (err) {
                    return res.json({error: err.message});
                }
                return res.json({success: true});
            })
        });
    });


router.use((req, res, next) => {
    if (!req.session.isAdmin) {
        return res.status(401).json({error: "Not Authorized"});
    }
    next();
});

router.get('/init', (req, res) => {
    db.Rebind.find({}, '-_id -__v').exec((err, data) => {
        if (err) {
            return res.json({error: err.message});
        }
        return res.json(data);
    });
});


router.route('/config')
    .get((req, res) => {
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
    })
    .post((req, res) => {
        const config = new db.Config(req.body);
        config.save((err, data) => {
            if (err) {
                return res.json({error: err.message});
            }
            return res.json(data);
        })
    });

module.exports = router;
