const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Cargar configuraciones
const ADMIN_CONFIG = require('./config/admin.json');
const CHATS_CONFIG_FILE = './config/chats.json';

let chatsConfig = { chats: {} };
if (fs.existsSync(CHATS_CONFIG_FILE)) {
    chatsConfig = JSON.parse(fs.readFileSync(CHATS_CONFIG_FILE, 'utf8'));
}

function guardarChatsConfig() {
    fs.writeFileSync(CHATS_CONFIG_FILE, JSON.stringify(chatsConfig, null, 2));
}

// Cargar módulos disponibles
const eventosDeportivosModule = require('./modulos/eventos-deportivos/handler.js');

const MODULOS = {
    'eventos-deportivos': eventosDeportivosModule
};

// Inicializar cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

// Mostrar QR para conectar
client.on('qr', async (qr) => {
    console.log('🤖 Generando código QR...');

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
    console.log('✅ Bot multimodular conectado!');
    console.log(`🔧 Admin: ${ADMIN_CONFIG.adminName} (${ADMIN_CONFIG.adminNumber})`);

    // Iniciar verificación periódica de estadísticas pendientes (cada 5 minutos)
    setInterval(() => {
        // Verificar estadísticas pendientes en cada módulo que lo soporte
        if (eventosDeportivosModule.verificarEstadisticasPendientes) {
            eventosDeportivosModule.verificarEstadisticasPendientes(client);
        }
    }, 5 * 60 * 1000);
});

// Detectar configuración inicial del chat
function detectarConfiguracionInicial(texto, contactId) {
    // Solo el admin puede configurar
    if (!contactId.includes(ADMIN_CONFIG.adminNumber)) {
        return null;
    }

    const textoLower = texto.toLowerCase();

    // Detectar: "Hola @cenote/Cenote, acá te vas a llamar X y vas a..."
    const configMatch = texto.match(/hola\s+[@]?(\w+)[,\s]+(aca|acá|aqui|aquí)\s+te\s+vas?\s+a\s+llamar\s+([a-zA-Z0-9]+)\s+y\s+vas?\s+a\s+(.*)/i);

    if (configMatch) {
        const nickname = configMatch[3];
        const proposito = configMatch[4];

        // Detectar tipo de módulo basado en el propósito
        let modulo = null;

        if (proposito.match(/organizar|partido|deporte|padel|pádel|futbol|fútbol|evento/i)) {
            modulo = 'eventos-deportivos';
        } else if (proposito.match(/gasto|pago|compartir|divid|plata|dinero/i)) {
            modulo = 'gastos-compartidos'; // Futuro
        } else if (proposito.match(/cenote|data|analiz|análisis/i)) {
            modulo = 'cenotes'; // Futuro
        }

        return {
            nickname,
            modulo,
            proposito,
            configuracionCompleta: proposito
        };
    }

    return null;
}

// Manejar mensajes
client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        const isGroup = chat.isGroup;

        // Solo responder en grupos
        if (!isGroup) return;

        const groupId = chat.id._serialized;
        const body = msg.body.trim();
        const contact = await msg.getContact();
        const contactId = contact.id._serialized;

        // Verificar si el chat está configurado
        let chatConfig = chatsConfig.chats[groupId];

        // Si no está configurado, verificar si es una configuración inicial del admin
        if (!chatConfig) {
            const config = detectarConfiguracionInicial(body, contactId);

            if (config) {
                if (!config.modulo) {
                    await msg.reply(`⚠️ No pude identificar el tipo de módulo para: "${config.proposito}"\n\nMódulos disponibles:\n• eventos-deportivos (partidos, pádel, etc)\n• gastos-compartidos (próximamente)\n• cenotes (próximamente)\n\n¿Podrías ser más específico?`);
                    return;
                }

                // Configurar el chat
                chatsConfig.chats[groupId] = {
                    nickname: config.nickname,
                    modulo: config.modulo,
                    proposito: config.proposito,
                    configuracionCompleta: config.configuracionCompleta,
                    configuradoPor: contactId,
                    fechaConfiguracion: new Date().toISOString()
                };

                guardarChatsConfig();

                await msg.reply(`✅ *CONFIGURACIÓN COMPLETA*\n\n🤖 Nombre: ${config.nickname}\n📦 Módulo: ${config.modulo}\n🎯 Propósito: ${config.proposito}\n\n¡Ya estoy listo para ayudarlos! Escribí "ayuda" para ver qué puedo hacer.`);
                return;
            }

            // Si no hay configuración y no es un intento de configuración, informar
            if (contactId.includes(ADMIN_CONFIG.adminNumber)) {
                await msg.reply(`👋 ¡Hola! Soy un bot multimodular.\n\n⚙️ Para configurarme, escribí algo como:\n"Hola Cenote, acá te vas a llamar CP y vas a ayudarnos a organizar partidos de pádel"\n\nO también podés usar:\n/configurar [nombre] [tipo-modulo]`);
            }
            return;
        }

        // Chat configurado - delegar al módulo correspondiente
        const modulo = MODULOS[chatConfig.modulo];

        if (!modulo) {
            console.error(`Módulo no encontrado: ${chatConfig.modulo}`);
            return;
        }

        // Llamar al handler del módulo
        const respuesta = await modulo.handleMessage(msg, chatConfig);

        if (respuesta) {
            await msg.reply(respuesta);
        }

    } catch (error) {
        console.error('Error procesando mensaje:', error);
    }
});

// Comando para reconfigurar (solo admin)
client.on('message', async (msg) => {
    try {
        const body = msg.body.trim();
        const contact = await msg.getContact();
        const contactId = contact.id._serialized;
        const chat = await msg.getChat();
        const groupId = chat.id._serialized;

        // /reconfigurar - solo admin
        if (body === '/reconfigurar' && contactId.includes(ADMIN_CONFIG.adminNumber)) {
            if (chatsConfig.chats[groupId]) {
                delete chatsConfig.chats[groupId];
                guardarChatsConfig();
                await msg.reply('✅ Configuración eliminada. Podés configurarme de nuevo cuando quieras.');
            } else {
                await msg.reply('⚠️ Este chat no estaba configurado.');
            }
        }

        // /info - mostrar configuración actual
        if (body === '/info') {
            const chatConfig = chatsConfig.chats[groupId];
            if (chatConfig) {
                let info = `🤖 *CONFIGURACIÓN DEL CHAT*\n\n`;
                info += `📛 Nombre: ${chatConfig.nickname}\n`;
                info += `📦 Módulo: ${chatConfig.modulo}\n`;
                info += `🎯 Propósito: ${chatConfig.proposito}\n`;
                info += `📅 Configurado: ${new Date(chatConfig.fechaConfiguracion).toLocaleString('es-AR')}\n`;
                await msg.reply(info);
            } else {
                await msg.reply('⚠️ Este chat no está configurado todavía.');
            }
        }

    } catch (error) {
        // Silenciar errores de este handler para no interferir con el principal
    }
});

// Inicializar cliente
client.initialize();
