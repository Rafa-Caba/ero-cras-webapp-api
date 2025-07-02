// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const loginRoutes = require('./routes/login');
const themesRoutes = require('./routes/themes');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/login', loginRoutes);
app.use('/api/cantos', require('./routes/cantos'));
app.use('/api/usuarios', require('./routes/usuarios'));
// app.use('/api/imagenes', require('./routes/imagenes'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/themes', themesRoutes);

// Carpeta Publica para las imagenes
app.use('/uploads', express.static('uploads'));

// Conexión DB
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => app.listen(PORT, () => console.log(`Servidor listo en el puerto ${PORT}`)))
    .catch(err => console.log("Error de conexión a MongoDB:", err));
