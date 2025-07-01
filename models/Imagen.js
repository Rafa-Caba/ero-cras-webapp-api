const mongoose = require('mongoose');

const ImagenSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    imagenUrl: {
        type: String,
        required: true
    },
    destacada: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

module.exports = mongoose.model('Imagen', ImagenSchema);