const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { exec } = require('child_process');

// ==================== CONFIGURACIÓN ====================
const ADMIN_NUMBER = '5491163067486'; // Tu número (Nico)
const DB_FILE = './datos-simple.json';

// ==================== BASE DE DATOS ====================
let db = {
    partidos: []
};

// Cargar DB
if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function guardarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ==================== CLIENTE WHATSAPP ====================
const client = new Client({
    authStrategy: new LocalAuth()
});

// Mostrar QR
client.on('qr', async (qr) => {
    console.log('🤖 Generando código QR...');
    qrcode.generate(qr, { small: true });

    const qrPath = './whatsapp-qr.png';
    try {
        await QRCode.toFile(qrPath, qr, { width: 400, margin: 2 });
        console.log(`✅ Código QR generado: ${qrPath}`);
        exec(`start ${qrPath}`);
    } catch (error) {
        console.error('Error generando QR:', error);
    }
});

client.on('ready', () => {
    console.log('✅ Bot de Pádel conectado!');
    console.log(`👤 Admin: ${ADMIN_NUMBER}`);
});

// ==================== ANTI-DUPLICADOS ====================
const mensajesProcesados = new Map(); // msgId -> timestamp

function esDuplicado(msgId) {
    const ahora = Date.now();

    // Limpiar mensajes viejos (más de 10 segundos)
    for (const [id, timestamp] of mensajesProcesados.entries()) {
        if (ahora - timestamp > 10000) {
            mensajesProcesados.delete(id);
        }
    }

    // Verificar si ya procesamos este mensaje
    if (mensajesProcesados.has(msgId)) {
        return true;
    }

    // Marcar como procesado
    mensajesProcesados.set(msgId, ahora);
    return false;
}

// ==================== FUNCIONES AUXILIARES ====================
function getAuthorPhone(msg) {
    // Extraer número de teléfono del autor
    if (msg._data && msg._data.notifyName) {
        // En grupos normales
        if (msg.author && msg.author.includes('@c.us')) {
            return msg.author.split('@')[0];
        }
    }

    // Fallback
    if (msg.from && msg.from.includes('@c.us')) {
        return msg.from.split('@')[0];
    }

    return null;
}

function getAuthorName(msg) {
    return msg._data?.notifyName || 'Usuario';
}

function esAdmin(msg) {
    const phone = getAuthorPhone(msg);
    // En comunidades, permitir todos los comandos
    const isCommunity = msg.from.includes('@g.us');
    return isCommunity || phone === ADMIN_NUMBER;
}

// ==================== HANDLER DE MENSAJES ====================
client.on('message', async (msg) => {
    try {
        // Solo grupos
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        // Anti-duplicados
        if (esDuplicado(msg.id.id)) {
            console.log(`⏭️  Duplicado ignorado: ${msg.body.substring(0, 30)}`);
            return;
        }

        const body = msg.body.trim();
        const groupId = chat.id._serialized;

        console.log(`📩 [${chat.name}] ${getAuthorName(msg)}: ${body}`);

        // Solo admin puede usar comandos
        if (!esAdmin(msg)) {
            console.log(`⛔ Usuario no autorizado`);
            return;
        }

        // ==================== COMANDOS ====================

        // /partido [día] [hora] [lugar...]
        if (body.startsWith('/partido ')) {
            const partes = body.split(' ');
            if (partes.length < 4) {
                await msg.reply('❌ Uso: /partido [día] [hora] [lugar]\nEjemplo: /partido Lunes 20:00 ClubNorte');
                return;
            }

            const dia = partes[1];
            const hora = partes[2];
            const lugar = partes.slice(3).join(' ');

            // Verificar si hay partido activo
            const partidoActivo = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (partidoActivo) {
                await msg.reply('⚠️ Ya hay un partido activo. Usá /limpiar para cancelarlo primero.');
                return;
            }

            // Crear partido
            const partido = {
                id: Date.now(),
                groupId,
                dia,
                hora,
                lugar,
                jugadores: [],
                equipos: null,
                finalizado: false,
                createdAt: new Date().toISOString()
            };

            db.partidos.push(partido);
            guardarDB();

            await msg.reply(
                `🎾 *NUEVO PARTIDO*\n\n` +
                `📅 ${dia} a las ${hora}\n` +
                `📍 ${lugar}\n\n` +
                `👥 Jugadores: 0/4\n\n` +
                `Comandos:\n` +
                `/agregar [nombre] - Agregar jugador\n` +
                `/quitar [nombre] - Quitar jugador\n` +
                `/cancha [precio] - Confirmar cancha\n` +
                `/lista - Ver jugadores\n` +
                `/sortear - Sortear equipos\n` +
                `/ganador [1 o 2] - Registrar ganador`
            );
            return;
        }

        // /agregar [nombre]
        if (body.startsWith('/agregar ')) {
            const nombre = body.substring(9).trim();
            if (!nombre) {
                await msg.reply('❌ Uso: /agregar [nombre]\nEjemplo: /agregar Manu');
                return;
            }

            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos. Creá uno con /partido');
                return;
            }

            // Verificar si ya está
            if (partido.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
                await msg.reply(`⚠️ ${nombre} ya está en la lista`);
                return;
            }

            partido.jugadores.push({
                nombre,
                agregadoEn: new Date().toISOString()
            });

            guardarDB();

            const total = partido.jugadores.length;
            await msg.reply(
                `✅ ${nombre} agregado!\n\n` +
                `👥 Jugadores: ${total}/4\n` +
                `${partido.jugadores.map(j => `• ${j.nombre}`).join('\n')}`
            );
            return;
        }

        // /quitar [nombre]
        if (body.startsWith('/quitar ')) {
            const nombre = body.substring(8).trim();
            if (!nombre) {
                await msg.reply('❌ Uso: /quitar [nombre]\nEjemplo: /quitar Manu');
                return;
            }

            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos');
                return;
            }

            const index = partido.jugadores.findIndex(j =>
                j.nombre.toLowerCase() === nombre.toLowerCase()
            );

            if (index === -1) {
                await msg.reply(`⚠️ ${nombre} no está en la lista`);
                return;
            }

            partido.jugadores.splice(index, 1);
            guardarDB();

            await msg.reply(
                `✅ ${nombre} eliminado\n\n` +
                `👥 Jugadores: ${partido.jugadores.length}/4\n` +
                `${partido.jugadores.map(j => `• ${j.nombre}`).join('\n')}`
            );
            return;
        }

        // /lista
        if (body === '/lista') {
            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos');
                return;
            }

            let mensaje = `🎾 *PARTIDO*\n\n`;
            mensaje += `📅 ${partido.dia} a las ${partido.hora}\n`;
            mensaje += `📍 ${partido.lugar}\n\n`;
            mensaje += `👥 Jugadores (${partido.jugadores.length}/4):\n`;

            if (partido.jugadores.length === 0) {
                mensaje += `_Todavía no hay jugadores_`;
            } else {
                mensaje += partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            }

            if (partido.equipos) {
                mensaje += `\n\n🎲 *EQUIPOS*\n\n`;
                mensaje += `🔵 Equipo 1:\n`;
                mensaje += partido.equipos.equipo1.map(j => `• ${j.nombre}`).join('\n');
                mensaje += `\n\n🔴 Equipo 2:\n`;
                mensaje += partido.equipos.equipo2.map(j => `• ${j.nombre}`).join('\n');
            }

            await msg.reply(mensaje);
            return;
        }

        // /cancha [precio]
        if (body.startsWith('/cancha ')) {
            const precio = body.substring(8).trim();
            if (!precio) {
                await msg.reply('❌ Uso: /cancha [precio]\nEjemplo: /cancha 20000');
                return;
            }

            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos');
                return;
            }

            partido.cancha = {
                confirmada: true,
                precio: parseFloat(precio),
                confirmadoEn: new Date().toISOString()
            };

            guardarDB();

            await msg.reply(
                `✅ *CANCHA CONFIRMADA*\n\n` +
                `💰 Precio: $${precio}\n` +
                `📍 ${partido.lugar}\n\n` +
                `Ya pueden sortear equipos con /sortear`
            );
            return;
        }

        // /sortear
        if (body === '/sortear') {
            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos');
                return;
            }

            if (partido.jugadores.length < 4) {
                await msg.reply(`⚠️ Faltan jugadores. Actuales: ${partido.jugadores.length}/4`);
                return;
            }

            // Mezclar jugadores
            const mezclados = [...partido.jugadores].sort(() => Math.random() - 0.5);

            partido.equipos = {
                equipo1: [mezclados[0], mezclados[1]],
                equipo2: [mezclados[2], mezclados[3]]
            };

            guardarDB();

            await msg.reply(
                `🎲 *EQUIPOS SORTEADOS*\n\n` +
                `🔵 *Equipo 1:*\n` +
                `• ${mezclados[0].nombre}\n` +
                `• ${mezclados[1].nombre}\n\n` +
                `🔴 *Equipo 2:*\n` +
                `• ${mezclados[2].nombre}\n` +
                `• ${mezclados[3].nombre}`
            );
            return;
        }

        // /ganador [1 o 2]
        if (body.startsWith('/ganador ')) {
            const ganador = body.substring(9).trim();
            if (!['1', '2'].includes(ganador)) {
                await msg.reply('❌ Uso: /ganador [1 o 2]\nEjemplo: /ganador 1');
                return;
            }

            const partido = db.partidos.find(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (!partido) {
                await msg.reply('❌ No hay partidos activos');
                return;
            }

            if (!partido.equipos) {
                await msg.reply('⚠️ Primero sorteá los equipos con /sortear');
                return;
            }

            partido.ganador = parseInt(ganador);
            partido.finalizado = true;
            partido.finalizadoEn = new Date().toISOString();

            guardarDB();

            const equipoGanador = partido.equipos[`equipo${ganador}`];

            await msg.reply(
                `🏆 *PARTIDO FINALIZADO*\n\n` +
                `🎉 Ganó el Equipo ${ganador}:\n` +
                `• ${equipoGanador[0].nombre}\n` +
                `• ${equipoGanador[1].nombre}\n\n` +
                `¡Felicitaciones! 🎊`
            );
            return;
        }

        // /limpiar
        if (body === '/limpiar') {
            const partidosActivos = db.partidos.filter(p =>
                p.groupId === groupId && !p.finalizado
            );

            if (partidosActivos.length === 0) {
                await msg.reply('⚠️ No hay partidos activos para limpiar');
                return;
            }

            db.partidos = db.partidos.filter(p =>
                !(p.groupId === groupId && !p.finalizado)
            );

            guardarDB();

            await msg.reply(
                `🗑️ *PARTIDO CANCELADO*\n\n` +
                `Ya podés crear un nuevo partido con /partido`
            );
            return;
        }

        // /ayuda
        if (body === '/ayuda') {
            await msg.reply(
                `🎾 *COMANDOS DEL BOT*\n\n` +
                `📋 *Partido:*\n` +
                `/partido [día] [hora] [lugar]\n` +
                `  _Crear partido nuevo_\n\n` +
                `/agregar [nombre]\n` +
                `  _Agregar jugador_\n\n` +
                `/quitar [nombre]\n` +
                `  _Quitar jugador_\n\n` +
                `/cancha [precio]\n` +
                `  _Confirmar cancha_\n\n` +
                `/lista\n` +
                `  _Ver estado del partido_\n\n` +
                `/sortear\n` +
                `  _Sortear equipos_\n\n` +
                `/ganador [1 o 2]\n` +
                `  _Registrar ganador_\n\n` +
                `/limpiar\n` +
                `  _Cancelar partido_\n\n` +
                `/ayuda\n` +
                `  _Ver esta ayuda_`
            );
            return;
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
});

// Iniciar
client.initialize();
