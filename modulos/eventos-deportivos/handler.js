const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'datos.json');

// Cargar o crear base de datos
let db = {
    partidos: [],
    estadisticas: {},
    estadisticasPendientes: [] // Para tracking de solicitudes de stats 2h después
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function guardarDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

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

// Handler principal del módulo
async function handleMessage(msg, chatConfig) {
    const body = msg.body.trim();
    const chat = await msg.getChat();
    const groupId = chat.id._serialized;

    // Detectar lenguaje natural
    const intencion = detectarIntencion(body);

    // Si no hay intención detectada y no es comando, ignorar
    if (!intencion && !body.startsWith('/')) {
        return null;
    }

    // MANEJO DE LENGUAJE NATURAL - Crear partido
    if (intencion && intencion.tipo === 'partido') {
        return await crearPartido(msg, groupId, intencion, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Anotarse
    if (intencion && intencion.tipo === 'anotarse') {
        return await anotarsePartido(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Darse de baja
    if (intencion && intencion.tipo === 'darse_de_baja') {
        return await darseDeBalja(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Confirmar asistencia
    if (intencion && intencion.tipo === 'confirmar_asistencia') {
        return await confirmarAsistencia(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Pedir confirmación
    if (intencion && intencion.tipo === 'pedir_confirmacion') {
        return await pedirConfirmacion(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Sortear
    if (intencion && intencion.tipo === 'sortear') {
        return await sortearEquipos(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Resultado
    if (intencion && intencion.tipo === 'resultado') {
        return await registrarResultado(msg, groupId, intencion, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Confirmar cancha
    if (intencion && intencion.tipo === 'confirmar_cancha') {
        return await confirmarCancha(msg, groupId, intencion, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Registrar pago
    if (intencion && intencion.tipo === 'registrar_pago') {
        return await registrarPago(msg, groupId, intencion, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Estado
    if (intencion && intencion.tipo === 'estado') {
        return await mostrarEstado(msg, groupId, chatConfig);
    }

    // MANEJO DE LENGUAJE NATURAL - Ayuda
    if (intencion && intencion.tipo === 'ayuda' || body === '/ayuda' || body === '/help') {
        return await mostrarAyuda(msg, chatConfig);
    }

    // Comandos slash como fallback
    if (body.startsWith('/partido')) {
        return await crearPartidoComando(msg, groupId, body, chatConfig);
    }

    if (body === '/anotarse') {
        return await anotarsePartido(msg, groupId, chatConfig);
    }

    if (body === '/sortear') {
        return await sortearEquipos(msg, groupId, chatConfig);
    }

    if (body.startsWith('/resultado')) {
        return await registrarResultadoComando(msg, groupId, body, chatConfig);
    }

    if (body === '/estado') {
        return await mostrarEstado(msg, groupId, chatConfig);
    }

    return null;
}

// Funciones auxiliares
async function crearPartido(msg, groupId, intencion, chatConfig) {
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

        return `🎾 *NUEVO PARTIDO*\n📅 ${intencion.dia} a las ${intencion.hora}\n📍 ${intencion.lugar}\n\n👥 Jugadores: 0/4\n🏟️ Cancha: ❌ Pendiente\n\nEscribí "me anoto" para sumarte!\nCuando tengas la cancha, escribí "cancha confirmada"`;
    } else {
        // Dar feedback de lo que falta
        let faltantes = [];
        if (!intencion.dia) faltantes.push('día/fecha');
        if (!intencion.hora) faltantes.push('hora');
        if (!intencion.lugar) faltantes.push('lugar');

        let mensaje = `Para crear un partido me falta: ${faltantes.join(', ')}\n\n`;
        mensaje += `Ejemplo: "El 25/11 a las 20:00 en ClubNorte"`;

        return mensaje;
    }
}

async function anotarsePartido(msg, groupId, chatConfig) {
    const contact = await msg.getContact();
    const nombre = contact.pushname || contact.number;

    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.confirmado &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos. Creá uno escribiendo por ejemplo: "Armemos un partido el lunes a las 20"';
    }

    if (partido.jugadores.find(j => j.id === contact.id._serialized)) {
        return '⚠️ Ya estás anotado!';
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

        // Programar solicitud de estadísticas 2h después
        programarSolicitudEstadisticas(partido.id, groupId);

        const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
        guardarDB();
        return `✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n🏟️ Cancha: ✅ Confirmada\n\n${total > 4 ? '⚽ Como somos más de 4, todos van a jugar el mismo tiempo con rotación!\n\n' : ''}🎲 Escribí "sortear" para armar equipos!`;
    } else if (total >= 4 && !partido.canchaConfirmada) {
        const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
        guardarDB();
        return `✅ ${nombre} confirmado!\n\n👥 Jugadores: ✅ ${total}/4 COMPLETO${total > 4 ? ' +' + (total - 4) : ''}\n🏟️ Cancha: ❌ Falta confirmar\n\nSolo falta que alguien escriba "cancha confirmada"!`;
    } else {
        const canchaStatus = partido.canchaConfirmada ? '✅ Confirmada' : '❌ Pendiente';
        guardarDB();
        return `✅ ${nombre} confirmado!\n\n👥 Jugadores: ${total}/4\n🏟️ Cancha: ${canchaStatus}`;
    }
}

async function darseDeBalja(msg, groupId, chatConfig) {
    const contact = await msg.getContact();
    const nombre = contact.pushname || contact.number;

    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos.';
    }

    const jugadorIndex = partido.jugadores.findIndex(j => j.id === contact.id._serialized);

    if (jugadorIndex === -1) {
        return '⚠️ No estabas anotado en este partido.';
    }

    partido.jugadores.splice(jugadorIndex, 1);
    const total = partido.jugadores.length;

    // Si ya estaba confirmado y ahora falta gente, desconfirmar
    if (partido.confirmado && total < 4) {
        partido.confirmado = false;
    }

    guardarDB();

    return `❌ ${nombre} se dio de baja.\n\n👥 Jugadores: ${total}/4\n🏟️ Cancha: ${partido.canchaConfirmada ? '✅ Confirmada' : '❌ Pendiente'}\n\n${total < 4 ? `Faltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!` : '¡Ya somos 4!'}`;
}

async function confirmarAsistencia(msg, groupId, chatConfig) {
    const contact = await msg.getContact();
    const nombre = contact.pushname || contact.number;

    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos.';
    }

    const jugador = partido.jugadores.find(j => j.id === contact.id._serialized);

    if (!jugador) {
        return '⚠️ No estás anotado. Escribí "me anoto" para sumarte!';
    }

    if (jugador.confirmado) {
        return `✅ ${nombre}, ya estabas confirmado!`;
    }

    jugador.confirmado = true;
    jugador.fechaConfirmacion = new Date().toISOString();
    guardarDB();

    const confirmados = partido.jugadores.filter(j => j.confirmado).length;
    const total = partido.jugadores.length;

    return `✅ ${nombre} confirmado!\n\n👥 Confirmados: ${confirmados}/${total}`;
}

async function pedirConfirmacion(msg, groupId, chatConfig) {
    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos.';
    }

    if (partido.jugadores.length === 0) {
        return '❌ No hay jugadores anotados todavía.';
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

    return mensaje;
}

async function sortearEquipos(msg, groupId, chatConfig) {
    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        p.confirmado &&
        !p.equipos &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partido confirmado para sortear.';
    }

    if (partido.jugadores.length < 4) {
        return '❌ Necesitamos al menos 4 jugadores.';
    }

    const jugadores = [...partido.jugadores];

    // Shuffle
    for (let i = jugadores.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jugadores[i], jugadores[j]] = [jugadores[j], jugadores[i]];
    }

    const equipo1 = jugadores.slice(0, 2);
    const equipo2 = jugadores.slice(2, 4);

    partido.equipos = { equipo1, equipo2 };

    if (jugadores.length > 4) {
        partido.suplentes = jugadores.slice(4);
        partido.rotacionActiva = true;
    }

    guardarDB();

    let mensaje = `🎲 *SORTEO DE EQUIPOS*\n\n`;
    mensaje += `🔵 *EQUIPO 1*\n${equipo1.map(j => `• ${j.nombre}`).join('\n')}\n\n`;
    mensaje += `🔴 *EQUIPO 2*\n${equipo2.map(j => `• ${j.nombre}`).join('\n')}`;

    if (partido.suplentes && partido.suplentes.length > 0) {
        mensaje += `\n\n⏸️ *DESCANSAN (rotarán)*\n${partido.suplentes.map(j => `• ${j.nombre}`).join('\n')}`;
        mensaje += `\n\n⚽ Todos van a jugar el mismo tiempo!`;
    }

    mensaje += `\n\n📊 Al terminar, escribí "ganamos" o "perdimos"`;

    return mensaje;
}

async function registrarResultado(msg, groupId, intencion, chatConfig) {
    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        p.equipos &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partido activo con equipos sorteados.';
    }

    if (!intencion.ganador) {
        return '¿Quién ganó? Escribí "ganamos" si ganó tu equipo, o usa /resultado 1 o /resultado 2';
    }

    partido.resultado = {
        ganador: intencion.ganador,
        fecha: new Date().toISOString()
    };

    const equipoGanadorNombres = partido.equipos[`equipo${intencion.ganador}`].map(j => j.nombre).join(' y ');

    // Actualizar estadísticas
    actualizarEstadisticas(partido);

    guardarDB();

    return `🏆 *PARTIDO FINALIZADO*\n\n✅ Ganó el Equipo ${intencion.ganador}!\n🎉 ${equipoGanadorNombres}\n\n¡Buen partido!`;
}

async function confirmarCancha(msg, groupId, intencion, chatConfig) {
    const contact = await msg.getContact();
    const nombre = contact.pushname || contact.number;

    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.confirmado &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos para confirmar la cancha.';
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

        const precioPorPersona = intencion.precio / Math.max(4, partido.jugadores.length);
        const total = partido.jugadores.length;

        let mensaje = `🏟️ *CANCHA CONFIRMADA!*\n`;
        mensaje += `💰 Precio total: $${intencion.precio}\n`;
        mensaje += `👤 Por persona: $${precioPorPersona.toFixed(0)}\n\n`;
        mensaje += `✅ ${nombre} pagó la cancha ($${intencion.precio})\n\n`;

        if (total >= 4) {
            partido.confirmado = true;

            // Programar solicitud de estadísticas 2h después
            programarSolicitudEstadisticas(partido.id, groupId);

            const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
            mensaje += `✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n\n`;
            mensaje += `💸 Cada uno debe: $${precioPorPersona.toFixed(0)} a ${nombre}`;
        } else {
            mensaje += `👥 Jugadores: ${total}/4\n\nFaltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!`;
        }

        guardarDB();
        return mensaje;
    }

    // Si no hay precio pero se confirmó la cancha
    if (partido.canchaConfirmada) {
        return '✅ La cancha ya estaba confirmada!';
    }

    partido.canchaConfirmada = true;

    const total = partido.jugadores.length;

    // Verificar si ahora se confirma el partido completo
    if (total >= 4) {
        partido.confirmado = true;

        // Programar solicitud de estadísticas 2h después
        programarSolicitudEstadisticas(partido.id, groupId);

        const jugadoresNombres = partido.jugadores.map(j => `• ${j.nombre}`).join('\n');
        guardarDB();
        return `🏟️ *CANCHA CONFIRMADA!*\n\n✅ *PARTIDO CONFIRMADO!*\n\n👥 Jugadores:\n${jugadoresNombres}\n\n💰 ¿Cuánto sale la cancha? Decime el precio así lo divido entre todos.`;
    } else {
        guardarDB();
        return `🏟️ *CANCHA CONFIRMADA!*\n\n👥 Jugadores: ${total}/4\n\nFaltan ${4 - total} jugador${4 - total > 1 ? 'es' : ''} para completar!\n\n💰 ¿Cuánto sale la cancha?`;
    }
}

async function registrarPago(msg, groupId, intencion, chatConfig) {
    const contact = await msg.getContact();
    const nombre = contact.pushname || contact.number;

    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.resultado
    );

    if (!partido) {
        return '❌ No hay partidos activos.';
    }

    if (!partido.precioTotal) {
        return '❌ Todavía no se definió el precio de la cancha.';
    }

    if (!intencion.monto) {
        const precioPorPersona = partido.precioTotal / Math.max(4, partido.jugadores.length);
        return `💰 ¿Cuánto pagaste? El total es $${partido.precioTotal} ($${precioPorPersona.toFixed(0)} por persona)`;
    }

    // Verificar si ya pagó
    const yaPago = partido.pagos.find(p => p.jugadorId === contact.id._serialized);
    if (yaPago) {
        return `⚠️ ${nombre}, ya tenés registrado un pago de $${yaPago.monto}`;
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

    return mensaje;
}

async function mostrarEstado(msg, groupId, chatConfig) {
    const partido = db.partidos.find(p =>
        p.groupId === groupId &&
        !p.resultado
    );

    if (!partido) {
        return '📭 No hay partidos activos en este grupo.';
    }

    const total = partido.jugadores.length;
    const jugadoresOk = total >= 4;
    const canchaOk = partido.canchaConfirmada;

    // FORMATO NUEVO: Info principal arriba
    let mensaje = `🎾 *PARTIDO*\n\n`;
    mensaje += `📅 ${partido.dia} a las ${partido.hora}\n`;
    mensaje += `📍 ${partido.lugar}\n\n`;

    // JUGADORES con confirmación
    mensaje += `👥 *JUGADORES (${total}/4${total > 4 ? '+' : ''})*\n`;
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
        const precioPorPersona = partido.precioTotal / Math.max(4, total);
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
        if (total > 4) {
            mensaje += `\n⚽ Con rotación (${total} jugadores)`;
        }
    }

    // Equipos al final
    if (partido.equipos) {
        mensaje += `\n\n🔵 *Equipo 1:* ${partido.equipos.equipo1.map(j => j.nombre).join(' y ')}`;
        mensaje += `\n🔴 *Equipo 2:* ${partido.equipos.equipo2.map(j => j.nombre).join(' y ')}`;
        if (partido.suplentes && partido.suplentes.length > 0) {
            mensaje += `\n⏸️ *Descansan:* ${partido.suplentes.map(j => j.nombre).join(', ')}`;
        }
    }

    return mensaje;
}

async function mostrarAyuda(msg, chatConfig) {
    const nickname = chatConfig.nickname || 'Bot';
    const ayuda = `🎾 *${nickname.toUpperCase()} - AYUDA*\n\n` +
        `Podés hablarme naturalmente:\n\n` +
        `💬 *Ejemplos:*\n` +
        `• "Armemos un partido el lunes a las 20 en ClubNorte"\n` +
        `• "Me anoto" / "Yo juego"\n` +
        `• "Cancha confirmada $20000"\n` +
        `• "Sortear equipos"\n` +
        `• "Ganamos" / "Perdimos"\n` +
        `• "Cómo vamos?"\n\n` +
        `También funcionan los comandos:\n` +
        `/partido [día] [hora] [lugar]\n` +
        `/anotarse | /sortear | /resultado [1 o 2] | /estado`;

    return ayuda;
}

async function crearPartidoComando(msg, groupId, body, chatConfig) {
    const partes = body.split(' ');
    if (partes.length < 4) {
        return '❌ Uso: /partido [día] [hora] [lugar]\nEjemplo: /partido Lunes 20:00 ClubNorte';
    }

    const [_, dia, hora, ...lugarParts] = partes;
    const lugar = lugarParts.join(' ');

    return await crearPartido(msg, groupId, { dia, hora, lugar }, chatConfig);
}

async function registrarResultadoComando(msg, groupId, body, chatConfig) {
    const partes = body.split(' ');
    if (partes.length !== 2 || !['1', '2'].includes(partes[1])) {
        return '❌ Uso: /resultado [1 o 2]\nEjemplo: /resultado 1';
    }

    const equipoGanador = parseInt(partes[1]);
    return await registrarResultado(msg, groupId, { tipo: 'resultado', ganador: equipoGanador }, chatConfig);
}

function programarSolicitudEstadisticas(partidoId, groupId) {
    // Guardar en la cola para solicitar estadísticas 2h después
    const solicitud = {
        partidoId,
        groupId,
        timestamp: Date.now() + (2 * 60 * 60 * 1000) // 2 horas
    };

    if (!db.estadisticasPendientes) {
        db.estadisticasPendientes = [];
    }

    db.estadisticasPendientes.push(solicitud);
    guardarDB();
}

function actualizarEstadisticas(partido) {
    // Actualizar wins/losses para cada jugador
    partido.equipos.equipo1.forEach(jugador => {
        if (!db.estadisticas[jugador.id]) {
            db.estadisticas[jugador.id] = {
                nombre: jugador.nombre,
                partidos: 0,
                ganados: 0,
                perdidos: 0
            };
        }
        db.estadisticas[jugador.id].partidos++;
        if (partido.resultado.ganador === 1) {
            db.estadisticas[jugador.id].ganados++;
        } else {
            db.estadisticas[jugador.id].perdidos++;
        }
    });

    partido.equipos.equipo2.forEach(jugador => {
        if (!db.estadisticas[jugador.id]) {
            db.estadisticas[jugador.id] = {
                nombre: jugador.nombre,
                partidos: 0,
                ganados: 0,
                perdidos: 0
            };
        }
        db.estadisticas[jugador.id].partidos++;
        if (partido.resultado.ganador === 2) {
            db.estadisticas[jugador.id].ganados++;
        } else {
            db.estadisticas[jugador.id].perdidos++;
        }
    });
}

// Función para verificar si hay estadísticas pendientes de solicitar
function verificarEstadisticasPendientes(client) {
    if (!db.estadisticasPendientes) return;

    const ahora = Date.now();
    const pendientes = db.estadisticasPendientes.filter(s => s.timestamp <= ahora);

    pendientes.forEach(async (solicitud) => {
        const partido = db.partidos.find(p => p.id === solicitud.partidoId);
        if (partido && partido.resultado) {
            try {
                const chat = await client.getChatById(solicitud.groupId);
                await chat.sendMessage(`📊 *ESTADÍSTICAS DEL PARTIDO*\n\n¿Cómo les fue? Cuéntenme sobre el partido:\n\n• ¿Fue parejo?\n• ¿Quién jugó mejor?\n• ¿Algún punto destacable?`);
            } catch (error) {
                console.log('Error al enviar solicitud de estadísticas:', error);
            }
        }

        // Remover de pendientes
        db.estadisticasPendientes = db.estadisticasPendientes.filter(s => s.partidoId !== solicitud.partidoId);
        guardarDB();
    });
}

// Exportar funciones
module.exports = {
    handleMessage,
    verificarEstadisticasPendientes
};
