import ThemeGroup from "../models/ThemeGroup";

const gruposIniciales = [
    {
        nombre: 'Predeterminado',
        descripcion: 'Grupo de colores base por defecto',
        activo: true,
        esTemaPublico: true,
        colores: [
            { nombre: 'Color Primario', colorClass: 'primary', color: '#ead4ff' },
            { nombre: 'Color Secondario', colorClass: 'secondary', color: '#cfaef9' },
            { nombre: 'Color de Boton', colorClass: 'btn-general', color: '#a966ff' },
            { nombre: 'Color de los Menus Laterales', colorClass: 'side-menus', color: '#ead4ff' },
            { nombre: 'Color del Header', colorClass: 'header', color: '#cfaef9' },
            { nombre: 'Color del Footer', colorClass: 'footer', color: '#b68fe6' },
            { nombre: 'Color de la Navegacion', colorClass: 'nav', color: '#f3e3fb' },
            { nombre: 'Hover del Boton General', colorClass: 'btn-general-hover', color: '#8a36f8' },
            { nombre: 'Color de la Navegacion - Hover', colorClass: 'nav-link-hover', color: '#b68fe6' },
            { nombre: 'Color de los Formularios', colorClass: 'form-color', color: '#c5b9cc' },
            { nombre: 'Color del texto', colorClass: 'text-color', color: '#000000' },
        ]
    },
    {
        nombre: 'Oscuro',
        descripcion: 'Modo oscuro con tonos púrpura y contraste alto',
        activo: false,
        esTemaPublico: false,
        colores: [
            { nombre: 'Color Primario', colorClass: 'primary', color: '#1c0f2e' },
            { nombre: 'Color Secondario', colorClass: 'secondary', color: '#7b4fa6' },
            { nombre: 'Color de Boton', colorClass: 'btn-general', color: '#8a36f8' },
            { nombre: 'Color de los Menus Laterales', colorClass: 'side-menus', color: '#2e1a4d' },
            { nombre: 'Color del Header', colorClass: 'header', color: '#3c2666' },
            { nombre: 'Color del Footer', colorClass: 'footer', color: '#3c2666' },
            { nombre: 'Color de la Navegacion', colorClass: 'nav', color: '#271c3a' },
            { nombre: 'Hover del Boton General', colorClass: 'btn-general-hover', color: '#a966ff' },
            { nombre: 'Color de la Navegacion - Hover', colorClass: 'nav-link-hover', color: '#a966ff' },
            { nombre: 'Color de los Formularios', colorClass: 'form-color', color: '#888888' },
            { nombre: 'Color del texto', colorClass: 'text-color', color: '#ffffff' },
        ]
    },
    {
        nombre: 'Claro',
        descripcion: 'Tema claro con fondo blanco y detalles lavanda',
        activo: false,
        esTemaPublico: false,
        colores: [
            { nombre: 'Color Primario', colorClass: 'primary', color: '#ffffff' },
            { nombre: 'Color Secondario', colorClass: 'secondary', color: '#dcc1fb' },
            { nombre: 'Color de Boton', colorClass: 'btn-general', color: '#d6b3ff' },
            { nombre: 'Color de los Menus Laterales', colorClass: 'side-menus', color: '#f8f2ff' },
            { nombre: 'Color del Header', colorClass: 'header', color: '#efe1ff' },
            { nombre: 'Color del Footer', colorClass: 'footer', color: '#e4d4f9' },
            { nombre: 'Color de la Navegacion', colorClass: 'nav', color: '#f4edff' },
            { nombre: 'Hover del Boton General', colorClass: 'btn-general-hover', color: '#c499f9' },
            { nombre: 'Color de la Navegacion - Hover', colorClass: 'nav-link-hover', color: '#dabcf9' },
            { nombre: 'Color de los Formularios', colorClass: 'form-color', color: '#f3ecf9' },
            { nombre: 'Color del texto', colorClass: 'text-color', color: '#000000' },
        ]
    }
];

export const crearGrupoPredeterminado = async () => {
    const existentes = await ThemeGroup.find({ nombre: { $in: gruposIniciales.map(g => g.nombre) } });

    if (existentes.length === gruposIniciales.length) {
        console.log('🟡 Todos los grupos ya existen. Nada que crear.');
        return;
    }

    // 🔁 Desactivar todos los existentes si alguno se va a activar
    await ThemeGroup.updateMany({}, { activo: false });

    for (const grupo of gruposIniciales) {
        const yaExiste = existentes.find(e => e.nombre === grupo.nombre);
        if (!yaExiste) {
            const creado = await ThemeGroup.create(grupo);
            console.log(`✅ Grupo "${grupo.nombre}" creado.`);
        } else {
            console.log(`🟡 Grupo "${grupo.nombre}" ya existía.`);
        }
    }
};
