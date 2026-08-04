// scripts/qa/phase-17-socket.mjs

import fs from 'node:fs';
import process from 'node:process';
import { io } from 'socket.io-client';

const statePath = process.argv[2];

if (!statePath || !fs.existsSync(statePath)) {
    console.error('✗ Falta el archivo de estado generado por phase-17-api.sh.');
    process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const requiredFields = [
    'apiOrigin',
    'apiBaseUrl',
    'choirAId',
    'choirBId',
    'platformAccessToken',
    'adminAAccessToken',
    'viewerAAccessToken',
    'adminBAccessToken'
];

for (const field of requiredFields) {
    if (typeof state[field] !== 'string' || state[field].length === 0) {
        console.error(`✗ El estado de Socket.IO no contiene ${field}.`);
        process.exit(1);
    }
}

const sockets = [];
const sleep = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
});

const pass = (message) => {
    console.log(`✓ ${message}`);
};

const fail = (message) => {
    throw new Error(message);
};

const connectSocket = (label, auth) => {
    return new Promise((resolve, reject) => {
        const socket = io(state.apiOrigin, {
            auth,
            transports: ['websocket'],
            reconnection: false,
            timeout: 5000
        });
        const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error(`${label}: timeout de conexión`));
        }, 6000);

        socket.once('connect', () => {
            clearTimeout(timeout);
            sockets.push(socket);
            resolve(socket);
        });

        socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            socket.disconnect();
            reject(new Error(
                `${label}: ${error.data?.code ?? error.message}`
            ));
        });
    });
};

const expectConnectionError = (label, auth, expectedCode) => {
    return new Promise((resolve, reject) => {
        const socket = io(state.apiOrigin, {
            auth,
            transports: ['websocket'],
            reconnection: false,
            timeout: 5000
        });
        const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error(`${label}: no se recibió connect_error`));
        }, 6000);

        socket.once('connect', () => {
            clearTimeout(timeout);
            socket.disconnect();
            reject(new Error(`${label}: la conexión fue aceptada`));
        });

        socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            socket.disconnect();
            const actualCode = error.data?.code;

            if (actualCode !== expectedCode) {
                reject(new Error(
                    `${label}: se esperaba ${expectedCode}, se recibió ${actualCode ?? error.message}`
                ));
                return;
            }

            pass(`${label} (${expectedCode})`);
            resolve();
        });
    });
};

const postChatMessage = async (accessToken, content) => {
    const response = await fetch(`${state.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-device-id': 'phase-17-socket'
        },
        body: JSON.stringify({
            content,
            type: 'TEXT'
        })
    });

    if (response.status !== 201) {
        const responseBody = await response.text();
        fail(`No se pudo crear el mensaje para la prueba Socket.IO: HTTP ${response.status} ${responseBody}`);
    }
};

try {
    await expectConnectionError(
        'Token Socket.IO inválido',
        { accessToken: 'invalid-token' },
        'INVALID_ACCESS_TOKEN'
    );

    await expectConnectionError(
        'SUPER_ADMIN sin targetChoirId',
        { accessToken: state.platformAccessToken },
        'SOCKET_TARGET_CHOIR_REQUIRED'
    );

    await expectConnectionError(
        'Usuario tenant con targetChoirId falsificado',
        {
            accessToken: state.adminAAccessToken,
            targetChoirId: state.choirBId
        },
        'TENANT_SOCKET_TARGET_FORBIDDEN'
    );

    const adminA = await connectSocket(
        'ADMIN A',
        { accessToken: state.adminAAccessToken }
    );
    pass('ADMIN A conectado al room derivado por el servidor');

    const viewerA = await connectSocket(
        'VIEWER A',
        { accessToken: state.viewerAAccessToken }
    );
    pass('VIEWER A conectado al mismo coro');

    const adminB = await connectSocket(
        'ADMIN B',
        { accessToken: state.adminBAccessToken }
    );
    pass('ADMIN B conectado a un coro distinto');

    const platformA = await connectSocket(
        'SUPER_ADMIN target A',
        {
            accessToken: state.platformAccessToken,
            targetChoirId: state.choirAId
        }
    );
    pass('SUPER_ADMIN conectado únicamente con target explícito');

    let viewerTypingPayload = null;
    let adminBReceivedTyping = false;

    viewerA.once('user-typing', (payload) => {
        viewerTypingPayload = payload;
    });
    adminB.once('user-typing', () => {
        adminBReceivedTyping = true;
    });

    adminA.emit('typing', true);
    await sleep(800);

    if (!viewerTypingPayload || viewerTypingPayload.isTyping !== true) {
        fail('VIEWER A no recibió el evento typing del Coro A');
    }

    if (adminBReceivedTyping) {
        fail('ADMIN B recibió un evento typing del Coro A');
    }

    pass('Los eventos typing permanecen dentro del room correcto');

    let adminAReceivedMessage = false;
    let viewerAReceivedMessage = false;
    let platformAReceivedMessage = false;
    let adminBReceivedMessage = false;

    adminA.once('new-message', () => {
        adminAReceivedMessage = true;
    });
    viewerA.once('new-message', () => {
        viewerAReceivedMessage = true;
    });
    platformA.once('new-message', () => {
        platformAReceivedMessage = true;
    });
    adminB.once('new-message', () => {
        adminBReceivedMessage = true;
    });

    await postChatMessage(
        state.adminAAccessToken,
        `Socket isolation ${Date.now()}`
    );
    await sleep(1200);

    if (
        !adminAReceivedMessage ||
        !viewerAReceivedMessage ||
        !platformAReceivedMessage
    ) {
        fail('No todos los sockets autorizados del Coro A recibieron new-message');
    }

    if (adminBReceivedMessage) {
        fail('ADMIN B recibió new-message del Coro A');
    }

    pass('new-message se emite solamente al room del coro seleccionado');
} finally {
    for (const socket of sockets) {
        socket.disconnect();
    }
}
