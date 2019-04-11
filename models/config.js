const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    loopBackOnly: {type: Boolean, required: false, select: true, default: false},
    findAuthResponses: {type: Boolean, required: false, select: true, default: false},
    shuffleIps: {type: Boolean, required: false, select: true, default: false},
    poolSize: {type: Number, required: false, select: true, default: 10},
    pingTimeout: {type: Number, required: false, select: true, default: 2000},
    scanTimeout: {type: Number, required: false, select: true, default: 2500},
    responseTimeout: {type: Number, required: false, select: true, default: 150000},
    rebindInterval: {type: Number, required: false, select: true, default: 5000},
    pingPort: {type: Number, required: false, select: true, default: 65535},
    ports: {
        type: Array,
        required: false,
        select: true,
        default: [80, 3000, 4040, 5000, 5800, 7000, 8000, 8080, 8090, 8888, 9000, 9090]
    },
});


module.exports = mongoose.model('Config', ConfigSchema, 'config');
