const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secretoSuperUltraSeguro';

const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(403).json({ mensaje: 'Token no proporcionado' });
    }

    try {
        const decodificado = jwt.verify(token, JWT_SECRET);
        req.usuario = decodificado;
        next();
    } catch (err) {
        res.status(401).json({ mensaje: 'Token inválido' });
    }
};

module.exports = verificarToken;