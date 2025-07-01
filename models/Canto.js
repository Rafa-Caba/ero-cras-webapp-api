const mongoose = require('mongoose');

const CantoSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: true,
    },
    texto: String,
    tipo: String,
    compositor: String,
    fecha: Date,
    url: String,
}, { timestamps: true });

module.exports = mongoose.model('Canto', CantoSchema);