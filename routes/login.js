const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verificarToken = require('../middlewares/auth');

const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/RefreshToken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Ruta: POST /api/login
router.post('/', async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    try {
        const usuario = await Usuario.findOne({
            $or: [
                { correo: usernameOrEmail },
                { username: usernameOrEmail }
            ]
        });

        if (!usuario) {
            return res.status(401).json({ mensaje: 'Usuario no encontrado' });
        }

        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
        }


        const accessToken = jwt.sign({ id: usuario._id, username: usuario.username }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: usuario._id, username: usuario.username }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

        // Guarda en Mongo
        await RefreshToken.create({ token: refreshToken, userId: usuario._id });

        res.json({
            mensaje: 'Login exitoso',
            token: accessToken,
            refreshToken,
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                username: usuario.username,
                correo: usuario.correo,
                fotoPerfilUrl: usuario.fotoPerfilUrl
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});


router.post('/refresh', async (req, res) => {
    const refreshToken = req.body.token;

    const storedToken = await RefreshToken.findOne({
        token: refreshToken,
        userId: jwt.decode(refreshToken)?.id
    });

    if (!storedToken) {
        return res.status(403).json({ mensaje: 'Refresh token inválido' });
    }

    try {
        const user = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        const newAccessToken = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        res.json({ accessToken: newAccessToken });
    } catch (err) {
        res.status(403).json({ mensaje: 'Token expirado o inválido' });
    }
});


router.post('/logout', verificarToken, async (req, res) => {
    await RefreshToken.deleteOne({ token: req.body.token });
    await RefreshToken.deleteMany({ userId: req.usuario.id });

    res.json({ mensaje: 'Logout exitoso' });
});

module.exports = router;