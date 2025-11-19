const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const { exec } = require('child_process');

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

// Base de datos simple en JSON
const DB_FILE = './partidos.json';

// Cargar o crear base de datos
let db = {
    partidos: [],
    estadisticas: {}
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function guardarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Mostrar QR para conectar
client.on('qr', async (qr) => {
    console.log('🎾 Generando código QR...');

    // Generar QR en terminal (por si acaso)
    qrcode.generate(qr, { small: true });

    // Generar QR como imagen PNG
    const qrPath = './whatsapp-qr.png';
    try {
        await QRCode.toFile(qrPath, qr, {
            width: 400,
            margin: 2
        });
        console.log('\n✅ ¡Código QR generado!');
        console.log(`📱 Abre el archivo: ${qrPath}`);
        console.log('👉 Escanéalo con WhatsApp (Configuración > Dispositivos vinculados > Vincular dispositivo)\n');

        // Intentar abrir el QR automáticamente
        exec(`start ${qrPath}`, (error) => {
            if (error) {
                console.log('⚠️  Abre manualmente el archivo whatsapp-qr.png');
            }
        });
    } catch (error) {
        console.error('Error al generar QR:', error);
    }
});

client.on('ready', () => {
    console.log('✅ Bot de pádel conectado!');
});

// Funciones de detección de lenguaje natural
function detectarIntencion(texto) {
    const textoLower = texto.toLowerCase();

    // Detectar creación de partido
    if (textoLower.match(/\b(armar|crear|organizar|hacer|proponer|armemos|hagamos|agregar|agregá|agrega|poner|poné|fecha|próximo|proximo)\b.*\b(partido|partidos|juego|cancha)\b/i) ||
        textoLower.match(/\b(partido|juego|cancha)\b.*\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|hoy|mañana|ma[ñn]ana)\b/i) ||
        textoLower.match(/\b(partido|juego|cancha)\b.*\b\d{1,2}\/\d{1,2}\b/i) ||
        textoLower.match(/\bfecha.*\d{1,2}\/\d{1,2}\b/i) ||
        textoLower.match(/\b(próximo|proximo)\b.*\bpartido\b/i)) {

        // Extraer día (día de semana o fecha dd/mm)
        let dia = null;

        // Primero intentar detectar fecha dd/mm o dd-mm
        const fechaMatch = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
        if (fechaMatch) {
            dia = `${fechaMatch[1]}/${fechaMatch[2]}`;
        } else {
            // Si no hay fecha numérica, buscar día de la semana
            const dias = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo', 'hoy', 'mañana', 'ma[ñn]ana'];
            for (let d of dias) {
                const match = textoLower.match(new RegExp(`\\b${d}\\b`, 'i'));
                if (match) {
                    dia = match[0];
                    break;
                }
            }
        }

        // Extraer hora (puede ser HH:MM o solo HH)
        const horaMatch = textoLower.match(/\b(\d{1,2}):?(\d{2})?\s*(hs|h|am|pm)?\b/);
        const hora = horaMatch ? (horaMatch[2] ? `${horaMatch[1]}:${horaMatch[2]}` : `${horaMatch[1]}:00`) : null;

        // Buscar lugar después de palabras clave
        const lugarMatch = textoLower.match(/\b(en|lugar|club|cancha)\s+([a-zñáéíóú\s]+)/i);
        const lugar = lugarMatch ? lugarMatch[2].trim().split(/\s+(y|,|\.|el|la|los|las)\s+/)[0] : null;

        return { tipo: 'partido', dia, hora, lugar };
    }

    // Detectar anotarse
    if (textoLower.match(/\b(me anoto|yo juego|me sumo|voy|cuenten conmigo|cuenta conmigo|me apunto|anótame|anotame|presente|yo|me uno)\b/i)) {
        return { tipo: 'anotarse' };
    }

    // Detectar darse de baja
    if (textoLower.match(/\b(me bajo|no puedo|no voy|me borro|no cuenten conmigo|cancelo|no llego|baja)\b/i)) {
        return { tipo: 'darse_de_baja' };
    }

    // Detectar confirmación (cuando ya está anotado)
    if (textoLower.match(/\b(confirmo|confirmado|sigo|dale|ok|estoy|voy)\b/i) &&
        !textoLower.match(/\b(cancha|partido)\b/i)) {
        return { tipo: 'confirmar_asistencia' };
    }

    // Detectar pedido de confirmación
    if (textoLower.match(/\b(confirmen|confirmación|quien|quién|quienes|quiénes)\b.*\b(viene|va|juega|confirma)\b/i) ||
        textoLower.match(/\b(roll\s*call|lista|pasen lista|confirmar)\b/i)) {
        return { tipo: 'pedir_confirmacion' };
    }

    // Detectar sorteo
    if (textoLower.match(/\b(sortear|sorteo|armar equipos|hacer equipos|equipos|parejas|sortea)\b/i)) {
        return { tipo: 'sortear' };
    }

    // Detectar resultado
    if (textoLower.match(/\b(ganamos|perdimos|ganó|gano|perdió|perdio|resultado)\b/i)) {
        // Detectar qué equipo ganó
        if (textoLower.match(/\b(equipo\s*1|primero|azul|ganamos\s*nosotros|ganamos)\b/i)) {
            return { tipo: 'resultado', ganador: 1 };
        } else if (textoLower.match(/\b(equipo\s*2|segundo|rojo|perdimos)\b/i)) {
            return { tipo: 'resultado', ganador: 2 };
        }
        return { tipo: 'resultado' };
    }

    // Detectar consulta de estado
    if (textoLower.match(/\b(estado|como vamos|quienes|quién|quien|confirmados|cuantos|cuántos)\b/i)) {
        return { tipo: 'estado' };
    }

    // Detectar confirmación de cancha
    if (textoLower.match(/\b(cancha|campo|pista)\b.*\b(confirmad[ao]|reservad[ao]|list[ao]|ok|listo|tengo|tenemos|saque|saqué|pagué|pague)\b/i) ||
        textoLower.match(/\b(confirmad[ao]|reservad[ao]|list[ao]|saque|saqué|pagué|pague)\b.*\b(cancha|campo|pista)\b/i) ||
        textoLower.match(/\bya\s+(saque|saqué|tengo|reserve|reservé)\b.*\b(cancha|campo|pista)\b/i)) {

        // Extraer precio si está presente
        const precioMatch = texto.match(/\$?\s*(\d+\.?\d*)\s*(mil|k|pesos)?/i);
        let precio = null;
        if (precioMatch) {
            precio = parseFloat(precioMatch[1]);
            // Si dice "mil" o "k", multiplicar por 1000
            if (precioMatch[2] && precioMatch[2].match(/mil|k/i)) {
                precio = precio * 1000;
            }
        }

        return { tipo: 'confirmar_cancha', precio };
    }

    // Detectar que alguien pagó
    if (textoLower.match(/\b(pagué|pague|pago|ya\s+pag[uoé]|transferí|transferi|puse)\b/i) &&
        !textoLower.match(/\bcancha\b/i)) {

        // Extraer monto
        const montoMatch = texto.match(/\$?\s*(\d+\.?\d*)\s*(mil|k|pesos)?/i);
        let monto = null;
        if (montoMatch) {
            monto = parseFloat(montoMatch[1]);
            if (montoMatch[2] && montoMatch[2].match(/mil|k/i)) {
                monto = monto * 1000;
            }
        }

        return { tipo: 'registrar_pago', monto };
    }

    // Detectar ayuda
    if (textoLower.match(/\b(ayuda|help|comandos|que puedo|qué puedo|cómo|como)\b/i)) {
        return { tipo: 'ayuda' };
    }

    return null;
}

// Manejar mensajes
client.on('message', async (msg) => {
    const chat = await msg.getChat();
    const isGroup = chat.isGroup;

    // Solo responder en grupos
    if (!isGroup) return;

    const groupId = chat.id._serialized;
    const body = msg.body.trim();

    // Detectar lenguaje natural
    const intencion = detectarIntencion(body);

    // MANEJO DE LENGUAJE NATURAL - Crear partido
    if (intencion && intencion.tipo === 'partido') {
        if (intencion.dia && intencion.hora && intencion.lugar) {
            const partido = {
                id: Date.now(),
                groupId,
                dia: intencion.dia,
                hora: intencion.hora,
                lugar: intencion.lugar,
                jugadores: [],
                canchaConfirmada: false,
                confirmado: false,
                equipos: null,
                resultado: null,
                precioTotal: null,
                pagos: [],
                createdAt: new Date().toISOString()
            };

            db.partidos.push(partido);
            guardarDB();

            await msg.reply(`🎾 *NUEVO PARTIDO*\n📅 ${intencion.dia} a las ${intencion.hora}\n📍 ${intencion.lugar}\n\n👥 Jugadores: 0/4\n🏟️ Cancha: ❌ Pendiente\n\nEscribí "me anoto" para sumarte!\nCuando tengas la cancha, escribí "cancha confirmada"`);
            return;
        } else {
            // Dar feedback de lo que falta
            let faltantes = [];
            if (!intencion.dia) faltantes.push('día/fecha');
            if (!intencion.hora) faltantes.push('hora');
            if (!intencion.lugar) faltantes.push('lugar');

            let mensaje = `Para crear un partido me falta: ${faltantes.join(', ')}\n\n`;
            mensaje += `Ejemplo: "El 25/11 a las 20:00 en ClubNorte"`;

            await msg.reply(mensaje);
            return;
        }
    }

    // MANEJO DE LENGUAJE NATURAL - Anotarse
    if (intencion && intencion.tipo === 'anotarse') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.confirmado &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos. Creá uno escribiendo por ejemplo: "Armemos un partido el lunes a las 20"');
            return;
        }

        if (partido.jugadores.find(j => j.id === contact.id._serialized)) {
            await msg.reply('⚠️ Ya estás anotado!');
            return;
        }

        partido.jugadores.push({
            id: contact.id._serialized,
            nombre,
            numero: contact.number,
            confirmado: true,
            fechaConfirmacion: new Date().toISOString()
        });

        const total = partido.jugadores.length;

        // Verificar si se cumplen AMBAS condiciones
        if (total >= 4 && partido.canchaConfirmada) {
            partido.confirmado = true;
            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            await msg.reply(`✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n🏟️ Cancha: ✅ Confirmada\n\n🎲 Escribí "sortear" para armar equipos!`);
        } else if (total >= 4 && !partido.canchaConfirmada) {
            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            await msg.reply(`✅ ${nombre} confirmado!\n\n👥 Jugadores: ✅ ${total}/4 COMPLETO\n🏟️ Cancha: ❌ Falta confirmar\n\nSolo falta que alguien escriba "cancha confirmada"!`);
        } else {
            const canchaStatus = partido.canchaConfirmada ? '✅ Confirmada' : '❌ Pendiente';
            await msg.reply(`✅ ${nombre} confirmado!\n\n👥 Jugadores: ${total}/4\n🏟️ Cancha: ${canchaStatus}`);
        }

        guardarDB();
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Darse de baja
    if (intencion && intencion.tipo === 'darse_de_baja') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos.');
            return;
        }

        const jugadorIndex = partido.jugadores.findIndex(j => j.id === contact.id._serialized);

        if (jugadorIndex === -1) {
            await msg.reply('⚠️ No estabas anotado en este partido.');
            return;
        }

        partido.jugadores.splice(jugadorIndex, 1);
        const total = partido.jugadores.length;

        // Si ya estaba confirmado y ahora falta gente, desconfirmar
        if (partido.confirmado && total < 4) {
            partido.confirmado = false;
        }

        guardarDB();

        await msg.reply(`❌ ${nombre} se dio de baja.\n\n👥 Jugadores: ${total}/4\n🏟️ Cancha: ${partido.canchaConfirmada ? '✅ Confirmada' : '❌ Pendiente'}\n\n${total < 4 ? `Faltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!` : '¡Ya somos 4!'}`);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Confirmar asistencia
    if (intencion && intencion.tipo === 'confirmar_asistencia') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos.');
            return;
        }

        const jugador = partido.jugadores.find(j => j.id === contact.id._serialized);

        if (!jugador) {
            await msg.reply('⚠️ No estás anotado. Escribí "me anoto" para sumarte!');
            return;
        }

        if (jugador.confirmado) {
            await msg.reply(`✅ ${nombre}, ya estabas confirmado!`);
            return;
        }

        jugador.confirmado = true;
        jugador.fechaConfirmacion = new Date().toISOString();
        guardarDB();

        const confirmados = partido.jugadores.filter(j => j.confirmado).length;
        const total = partido.jugadores.length;

        await msg.reply(`✅ ${nombre} confirmado!\n\n👥 Confirmados: ${confirmados}/${total}`);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Pedir confirmación
    if (intencion && intencion.tipo === 'pedir_confirmacion') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos.');
            return;
        }

        if (partido.jugadores.length === 0) {
            await msg.reply('❌ No hay jugadores anotados todavía.');
            return;
        }

        // Marcar todos como no confirmados para forzar reconfirmación
        partido.jugadores.forEach(j => {
            j.confirmado = false;
        });
        guardarDB();

        let mensaje = `📣 *CONFIRMACIÓN DE ASISTENCIA*\n\n`;
        mensaje += `📅 ${partido.dia} a las ${partido.hora}\n`;
        mensaje += `📍 ${partido.lugar}\n\n`;
        mensaje += `Por favor, confirmen escribiendo "confirmo" o "voy":\n\n`;
        mensaje += partido.jugadores.map(j => `• ${j.nombre} ❓`).join('\n');

        await msg.reply(mensaje);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Sortear
    if (intencion && intencion.tipo === 'sortear') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            p.confirmado &&
            !p.equipos &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partido confirmado para sortear.');
            return;
        }

        if (partido.jugadores.length < 4) {
            await msg.reply('❌ Necesitamos al menos 4 jugadores.');
            return;
        }

        const jugadores = [...partido.jugadores];

        for (let i = jugadores.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jugadores[i], jugadores[j]] = [jugadores[j], jugadores[i]];
        }

        const equipo1 = jugadores.slice(0, 2);
        const equipo2 = jugadores.slice(2, 4);

        partido.equipos = { equipo1, equipo2 };

        if (jugadores.length === 5) {
            partido.suplente = jugadores[4];
        }

        guardarDB();

        let mensaje = `🎲 *SORTEO DE EQUIPOS*\n\n`;
        mensaje += `🔵 *EQUIPO 1*\n${equipo1.map(j => `• ${j.nombre}`).join('\n')}\n\n`;
        mensaje += `🔴 *EQUIPO 2*\n${equipo2.map(j => `• ${j.nombre}`).join('\n')}`;

        if (partido.suplente) {
            mensaje += `\n\n⏸️ *DESCANSA*\n• ${partido.suplente.nombre}`;
        }

        mensaje += `\n\n📊 Al terminar, escribí "ganamos" o "perdimos"`;

        await msg.reply(mensaje);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Resultado
    if (intencion && intencion.tipo === 'resultado') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            p.equipos &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partido activo con equipos sorteados.');
            return;
        }

        if (!intencion.ganador) {
            await msg.reply('¿Quién ganó? Escribí "ganamos" si ganó tu equipo, o usa /resultado 1 o /resultado 2');
            return;
        }

        partido.resultado = {
            ganador: intencion.ganador,
            fecha: new Date().toISOString()
        };

        const equipoGanadorNombres = partido.equipos[`equipo${intencion.ganador}`].map(j => j.nombre).join(' y ');

        guardarDB();

        await msg.reply(`🏆 *PARTIDO FINALIZADO*\n\n✅ Ganó el Equipo ${intencion.ganador}!\n🎉 ${equipoGanadorNombres}\n\n¡Buen partido!`);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Confirmar cancha
    if (intencion && intencion.tipo === 'confirmar_cancha') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.confirmado &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos para confirmar la cancha.');
            return;
        }

        // Manejar precio si se proporcionó
        if (intencion.precio) {
            partido.precioTotal = intencion.precio;
            partido.canchaConfirmada = true;

            // Registrar que quien confirmó la cancha la pagó
            partido.pagos.push({
                jugadorId: contact.id._serialized,
                jugadorNombre: nombre,
                monto: intencion.precio,
                fecha: new Date().toISOString()
            });

            const precioPorPersona = intencion.precio / 4;
            const total = partido.jugadores.length;

            let mensaje = `🏟️ *CANCHA CONFIRMADA!*\n`;
            mensaje += `💰 Precio total: $${intencion.precio}\n`;
            mensaje += `👤 Por persona: $${precioPorPersona.toFixed(0)}\n\n`;
            mensaje += `✅ ${nombre} pagó la cancha ($${intencion.precio})\n\n`;

            if (total >= 4) {
                partido.confirmado = true;
                const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
                mensaje += `✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n\n`;
                mensaje += `💸 Cada uno debe: $${precioPorPersona.toFixed(0)} a ${nombre}`;
            } else {
                mensaje += `👥 Jugadores: ${total}/4\n\nFaltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!`;
            }

            await msg.reply(mensaje);
            guardarDB();
            return;
        }

        // Si no hay precio pero se confirmó la cancha
        if (partido.canchaConfirmada) {
            await msg.reply('✅ La cancha ya estaba confirmada!');
            return;
        }

        partido.canchaConfirmada = true;

        const total = partido.jugadores.length;

        // Verificar si ahora se confirma el partido completo
        if (total >= 4) {
            partido.confirmado = true;
            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            await msg.reply(`🏟️ *CANCHA CONFIRMADA!*\n\n✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n\n💰 ¿Cuánto sale la cancha? Decime el precio así lo divido entre todos.`);
        } else {
            await msg.reply(`🏟️ *CANCHA CONFIRMADA!*\n\n👥 Jugadores: ${total}/4\n\nFaltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!\n\n💰 ¿Cuánto sale la cancha?`);
        }

        guardarDB();
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Registrar pago
    if (intencion && intencion.tipo === 'registrar_pago') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos.');
            return;
        }

        if (!partido.precioTotal) {
            await msg.reply('❌ Todavía no se definió el precio de la cancha.');
            return;
        }

        if (!intencion.monto) {
            await msg.reply(`💰 ¿Cuánto pagaste? El total es $${partido.precioTotal} ($${(partido.precioTotal / 4).toFixed(0)} por persona)`);
            return;
        }

        // Verificar si ya pagó
        const yaPago = partido.pagos.find(p => p.jugadorId === contact.id._serialized);
        if (yaPago) {
            await msg.reply(`⚠️ ${nombre}, ya tenés registrado un pago de $${yaPago.monto}`);
            return;
        }

        partido.pagos.push({
            jugadorId: contact.id._serialized,
            jugadorNombre: nombre,
            monto: intencion.monto,
            fecha: new Date().toISOString()
        });

        guardarDB();

        const totalPagado = partido.pagos.reduce((sum, p) => sum + p.monto, 0);
        const faltaPagar = partido.precioTotal - totalPagado;

        let mensaje = `✅ ${nombre} pagó $${intencion.monto}\n\n`;
        mensaje += `💰 Total pagado: $${totalPagado} / $${partido.precioTotal}\n`;

        if (faltaPagar <= 0) {
            mensaje += `\n🎉 ¡Cancha pagada completa!`;
        } else {
            mensaje += `💸 Falta: $${faltaPagar}`;
        }

        await msg.reply(mensaje);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Estado
    if (intencion && intencion.tipo === 'estado') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('📭 No hay partidos activos en este grupo.');
            return;
        }

        const total = partido.jugadores.length;
        const jugadoresOk = total >= 4;
        const canchaOk = partido.canchaConfirmada;

        // FORMATO NUEVO: Info principal arriba
        let mensaje = `🎾 *PARTIDO*\n\n`;
        mensaje += `📅 ${partido.dia} a las ${partido.hora}\n`;
        mensaje += `📍 ${partido.lugar}\n\n`;

        // JUGADORES con confirmación
        mensaje += `👥 *JUGADORES (${total}/4)*\n`;
        if (partido.jugadores.length > 0) {
            mensaje += partido.jugadores.map(j => {
                const status = j.confirmado ? '✅' : '❓';
                return `${status} ${j.nombre}`;
            }).join('\n');
        } else {
            mensaje += `(Nadie anotado todavía)`;
        }

        const confirmados = partido.jugadores.filter(j => j.confirmado).length;
        if (confirmados < total && total > 0) {
            mensaje += `\n⚠️ ${total - confirmados} sin confirmar`;
        }

        // CANCHA
        mensaje += `\n\n🏟️ *CANCHA*\n`;
        mensaje += canchaOk ? `✅ Confirmada` : `❌ Pendiente`;

        // PAGOS (abajo de cancha)
        if (partido.precioTotal) {
            const precioPorPersona = partido.precioTotal / 4;
            const totalPagado = partido.pagos.reduce((sum, p) => sum + p.monto, 0);
            const faltaPagar = partido.precioTotal - totalPagado;

            mensaje += `\n💰 Total: $${partido.precioTotal} ($${precioPorPersona.toFixed(0)} c/u)\n`;

            if (partido.pagos.length > 0) {
                mensaje += `\n*Pagos:*\n`;
                partido.pagos.forEach(p => {
                    mensaje += `✅ ${p.jugadorNombre}: $${p.monto}\n`;
                });
            }

            if (faltaPagar > 0) {
                mensaje += `\n💸 Falta pagar: $${faltaPagar}`;
            } else {
                mensaje += `\n🎉 ¡Pagada!`;
            }
        }

        // Estado general
        if (!jugadoresOk || !canchaOk) {
            mensaje += `\n\n⚠️ *FALTA:*\n`;
            if (!jugadoresOk) mensaje += `• ${4 - total} jugador${4 - total > 1 ? 'es' : ''} más\n`;
            if (!canchaOk) mensaje += `• Confirmar cancha\n`;
        } else if (partido.confirmado) {
            mensaje += `\n\n✅ *¡PARTIDO CONFIRMADO!*`;
        }

        // Equipos al final
        if (partido.equipos) {
            mensaje += `\n\n🔵 *Equipo 1:* ${partido.equipos.equipo1.map(j => j.nombre).join(' y ')}`;
            mensaje += `\n🔴 *Equipo 2:* ${partido.equipos.equipo2.map(j => j.nombre).join(' y ')}`;
        }

        await msg.reply(mensaje);
        return;
    }

    // MANEJO DE LENGUAJE NATURAL - Ayuda
    if (intencion && intencion.tipo === 'ayuda') {
        const ayuda = `🎾 *BOT DE PÁDEL*\n\n` +
            `Podés hablarme naturalmente:\n\n` +
            `💬 *Ejemplos:*\n` +
            `• "Armemos un partido el lunes a las 20 en ClubNorte"\n` +
            `• "Me anoto" / "Yo juego"\n` +
            `• "Sortear equipos"\n` +
            `• "Ganamos" / "Perdimos"\n` +
            `• "Cómo vamos?"\n\n` +
            `También funcionan los comandos:\n` +
            `/partido [día] [hora] [lugar]\n` +
            `/anotarse | /sortear | /resultado [1 o 2] | /estado`;

        await msg.reply(ayuda);
        return;
    }

    // Comando: /partido [día] [hora] [lugar]
    if (body.startsWith('/partido')) {
        const partes = body.split(' ');
        if (partes.length < 4) {
            await msg.reply('❌ Uso: /partido [día] [hora] [lugar]\nEjemplo: /partido Lunes 20:00 ClubNorte');
            return;
        }

        const [_, dia, hora, ...lugarParts] = partes;
        const lugar = lugarParts.join(' ');

        const partido = {
            id: Date.now(),
            groupId,
            dia,
            hora,
            lugar,
            jugadores: [],
            canchaConfirmada: false,
            confirmado: false,
            equipos: null,
            resultado: null,
            precioTotal: null,
            pagos: [],
            createdAt: new Date().toISOString()
        };

        db.partidos.push(partido);
        guardarDB();

        await msg.reply(`🎾 *NUEVO PARTIDO*\n📅 ${dia} a las ${hora}\n📍 ${lugar}\n\n👥 Jugadores: 0/4\n🏟️ Cancha: ❌ Pendiente\n\nEscribí "me anoto" para sumarte!\nCuando tengas la cancha, escribí "cancha confirmada"`);
    }

    // Comando: /anotarse
    if (body === '/anotarse') {
        const contact = await msg.getContact();
        const nombre = contact.pushname || contact.number;

        // Buscar partido activo en este grupo
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.confirmado &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partidos activos. Creá uno con /partido');
            return;
        }

        // Verificar si ya está anotado
        if (partido.jugadores.find(j => j.id === contact.id._serialized)) {
            await msg.reply('⚠️ Ya estás anotado!');
            return;
        }

        // Agregar jugador
        partido.jugadores.push({
            id: contact.id._serialized,
            nombre,
            numero: contact.number,
            confirmado: true,
            fechaConfirmacion: new Date().toISOString()
        });

        const total = partido.jugadores.length;

        // Verificar si se cumplen AMBAS condiciones
        if (total >= 4 && partido.canchaConfirmada) {
            partido.confirmado = true;
            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            await msg.reply(`✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n🏟️ Cancha: ✅ Confirmada\n\n🎲 Usá /sortear para armar equipos!`);
        } else if (total >= 4 && !partido.canchaConfirmada) {
            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            await msg.reply(`✅ ${nombre} confirmado!\n\n👥 Jugadores: ✅ ${total}/4 COMPLETO\n🏟️ Cancha: ❌ Falta confirmar\n\nSolo falta que alguien escriba "cancha confirmada"!`);
        } else {
            const canchaStatus = partido.canchaConfirmada ? '✅ Confirmada' : '❌ Pendiente';
            await msg.reply(`✅ ${nombre} confirmado!\n\n👥 Jugadores: ${total}/4\n🏟️ Cancha: ${canchaStatus}`);
        }

        guardarDB();
    }

    // Comando: /sortear
    if (body === '/sortear') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            p.confirmado &&
            !p.equipos &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partido confirmado para sortear.');
            return;
        }

        if (partido.jugadores.length < 4) {
            await msg.reply('❌ Necesitamos al menos 4 jugadores.');
            return;
        }

        // Sortear parejas
        const jugadores = [...partido.jugadores];

        // Shuffle
        for (let i = jugadores.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jugadores[i], jugadores[j]] = [jugadores[j], jugadores[i]];
        }

        const equipo1 = jugadores.slice(0, 2);
        const equipo2 = jugadores.slice(2, 4);

        partido.equipos = { equipo1, equipo2 };

        if (jugadores.length === 5) {
            partido.suplente = jugadores[4];
        }

        guardarDB();

        let mensaje = `🎲 *SORTEO DE EQUIPOS*\n\n`;
        mensaje += `🔵 *EQUIPO 1*\n${equipo1.map(j => `• ${j.nombre}`).join('\n')}\n\n`;
        mensaje += `🔴 *EQUIPO 2*\n${equipo2.map(j => `• ${j.nombre}`).join('\n')}`;

        if (partido.suplente) {
            mensaje += `\n\n⏸️ *DESCANSA*\n• ${partido.suplente.nombre}`;
        }

        mensaje += `\n\n📊 Al terminar, registrá el resultado con:\n/resultado 1 (si ganó equipo 1)\n/resultado 2 (si ganó equipo 2)`;

        await msg.reply(mensaje);
    }

    // Comando: /resultado [1 o 2]
    if (body.startsWith('/resultado')) {
        const partes = body.split(' ');
        if (partes.length !== 2 || !['1', '2'].includes(partes[1])) {
            await msg.reply('❌ Uso: /resultado [1 o 2]\nEjemplo: /resultado 1');
            return;
        }

        const equipoGanador = parseInt(partes[1]);

        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            p.equipos &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('❌ No hay partido activo con equipos sorteados.');
            return;
        }

        partido.resultado = {
            ganador: equipoGanador,
            fecha: new Date().toISOString()
        };

        const equipoGanadorNombres = partido.equipos[`equipo${equipoGanador}`].map(j => j.nombre).join(' y ');

        guardarDB();

        await msg.reply(`🏆 *PARTIDO FINALIZADO*\n\n✅ Ganó el Equipo ${equipoGanador}!\n🎉 ${equipoGanadorNombres}\n\n¡Buen partido!`);
    }

    // Comando: /estado
    if (body === '/estado') {
        const partido = db.partidos.find(p =>
            p.groupId === groupId &&
            !p.resultado
        );

        if (!partido) {
            await msg.reply('📭 No hay partidos activos en este grupo.');
            return;
        }

        let mensaje = `📊 *ESTADO DEL PARTIDO*\n\n`;
        mensaje += `📅 ${partido.dia} a las ${partido.hora}\n`;
        mensaje += `📍 ${partido.lugar}\n\n`;
        mensaje += `👥 Jugadores (${partido.jugadores.length}/4):\n`;
        mensaje += partido.jugadores.map(j => `• ${j.nombre}`).join('\n');

        if (partido.equipos) {
            mensaje += `\n\n🔵 *Equipo 1:* ${partido.equipos.equipo1.map(j => j.nombre).join(' y ')}`;
            mensaje += `\n🔴 *Equipo 2:* ${partido.equipos.equipo2.map(j => j.nombre).join(' y ')}`;
        }

        await msg.reply(mensaje);
    }

    // Comando: /ayuda
    if (body === '/ayuda' || body === '/help') {
        const ayuda = `🎾 *BOT DE PÁDEL - COMANDOS*\n\n` +
            `📝 *Organizar partido:*\n` +
            `/partido [día] [hora] [lugar]\n` +
            `Ejemplo: /partido Lunes 20:00 ClubNorte\n\n` +
            `✅ *Anotarse:*\n/anotarse\n\n` +
            `🎲 *Sortear equipos:*\n/sortear\n\n` +
            `📊 *Registrar resultado:*\n/resultado [1 o 2]\n\n` +
            `📋 *Ver estado:*\n/estado`;

        await msg.reply(ayuda);
    }
});

// Inicializar cliente
client.initialize();
