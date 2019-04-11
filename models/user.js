const bcrypt = require('bcrypt-nodejs');
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {type: String, required: true, index: {unique: true}, select: true},
    password: {type: String, required: true, select: false},
});

UserSchema.pre('save', function (next) {
    const user = this;
    if (!user.isModified('password')) {
        return next();
    }

    bcrypt.hash(user.password, null, null, function (err, hash) {
        if (err) {
            return next(err);
        }

        user.password = hash;
        next();
    })
});

UserSchema.methods.comparePassword = function (password, callback) {
    const user = this;
    return bcrypt.compare(password, user.password, callback);
};

module.exports = mongoose.model('User', UserSchema, 'users');
