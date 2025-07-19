import Log from '../models/Log';
import { Request } from 'express';

export interface RequestConUsuario extends Request {
    usuario?: {
        id: string;
        nombre: string;
        username: string;
        rol: string;
    };
}

export const registrarLog = async ({
    req,
    coleccion,
    accion,
    referenciaId,
    cambios = {}
}: {
    req: RequestConUsuario;
    coleccion: string;
    accion: 'crear' | 'actualizar' | 'eliminar' | 'agregar_reaccion' | 'quitar_reaccion';
    referenciaId: string;
    cambios?: Record<string, any>;
}) => {
    try {
        if (!req.usuario) return;

        await Log.create({
            usuario: req.usuario.id,
            coleccion,
            accion,
            referenciaId,
            cambios
        });
    } catch (error) {
        console.error('Error al registrar log:', error);
    }
};
