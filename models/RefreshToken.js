const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    createdAt: { type: Date, default: Date.now, expires: '7d' } // expira en 7 días
});

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);