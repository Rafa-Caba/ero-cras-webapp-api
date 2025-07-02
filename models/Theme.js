const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
    nombre: { type: String, required: true },         // Ej: "Color Primario"
    colorClass: { type: String, required: true },     // Ej: "primary"
    color: { type: String, required: true }           // Ej: "#EAD4FF"
});

module.exports = mongoose.model('Theme', ThemeSchema);
