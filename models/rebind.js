const mongoose = require('mongoose');

const RebindSchema = new mongoose.Schema({
    id: {type: String, required: true, select: true},
    ip: {type: String, required: true, select: true},
    port: {type: Number, required: false, select: true, default: 80},
    hostname: {type: String, required: true, index: {unique: true}, select: true},
    authenticationRequired: {type: Boolean, required: false, select: true, default: false},
});

module.exports = mongoose.model('Rebind', RebindSchema, 'rebinds');
