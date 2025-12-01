# 🎾 Bot Multimodular para WhatsApp

Bot modular para organizar eventos deportivos (pádel, fútbol, etc.) en grupos de WhatsApp con detección de lenguaje natural.

## 🚀 Instalación

1. Asegurate de tener Node.js instalado
2. Instalá las dependencias:
```bash
npm install
```

## ▶️ Uso

1. Iniciá el bot:
```bash
npm start
```

2. Escaneá el código QR que aparece en la terminal con WhatsApp

3. ¡Listo! El bot ya está escuchando en tus grupos

## 📱 Uso del Bot

### Configuración Inicial (Solo Admin)
El bot debe configurarse una vez por grupo. El admin escribe:
```
Hola Cenote, acá te vas a llamar CP y vas a ayudarnos a organizar partidos de pádel
```

### Lenguaje Natural 💬
El bot entiende mensajes naturales:

**Crear un partido:**
```
Armemos un partido el lunes a las 20 en ClubNorte
El 25/11 a las 19:30 en Palermo
```

**Anotarse:**
```
Me anoto
Yo juego
Me sumo
```

**Confirmar cancha:**
```
Cancha confirmada $20000
Ya tengo la cancha, sale $25k
```

**Sortear equipos:**
```
Sortear
Armar equipos
```

**Registrar resultado:**
```
Ganamos
Perdimos
Ganó el equipo 1
```

**Ver estado:**
```
Cómo vamos?
Estado del partido
```

### Comandos Tradicionales
También funcionan los comandos clásicos:
```
/partido [día] [hora] [lugar]
/anotarse
/sortear
/resultado [1 o 2]
/estado
/ayuda
```

## 💾 Datos

Los partidos se guardan en `modulos/eventos-deportivos/datos.json` con:
- Partidos activos
- Historial de partidos finalizados
- Estadísticas por jugador
- Solicitudes de estadísticas pendientes (2h post-partido)

## ✨ Características

- ✅ Detección de lenguaje natural
- ✅ Ciclo completo de partido (crear → anotar → confirmar cancha → sortear → resultado)
- ✅ Partidos se marcan como finalizados automáticamente
- ✅ Permite crear nuevos partidos después de finalizar el anterior
- ✅ Solicitud automática de estadísticas 2 horas después del partido
- ✅ Sistema de pagos (tracking de quién pagó la cancha)
- ✅ Soporte para 4+ jugadores con rotación
- ✅ Estadísticas de jugadores (partidos ganados/perdidos)
- ✅ Arquitectura modular (fácil agregar nuevos módulos)

## 🔧 Próximas mejoras

- Sistema de ranking ELO
- Comandos de estadísticas personales (`/stats @jugador`)
- Recordatorios automáticos antes del partido
- Historial de partidos con búsqueda
