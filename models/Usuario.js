const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    correo: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    fotoPerfilUrl: String,
    rol: {
        type: String,
        enum: ['admin', 'editor', 'viewer'],
        default: 'viewer'
    }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);
