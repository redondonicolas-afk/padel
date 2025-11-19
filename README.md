# 🎾 Bot de Pádel para WhatsApp

Bot simple para organizar partidos de pádel en grupos de WhatsApp.

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

## 📱 Comandos

### Crear un partido
```
/partido [día] [hora] [lugar]
Ejemplo: /partido Lunes 20:00 ClubNorte
```

### Anotarse al partido
```
/anotarse
```
Cuando haya 4 jugadores confirmados, el partido se activa automáticamente.

### Sortear equipos
```
/sortear
```
Sortea las parejas aleatoriamente. Soporta 4 o 5 jugadores.

### Registrar resultado
```
/resultado [1 o 2]
Ejemplo: /resultado 1
```
Registra qué equipo ganó el partido.

### Ver estado del partido
```
/estado
```

### Ayuda
```
/ayuda
```

## 💾 Datos

Los partidos se guardan en `partidos.json` automáticamente.

## 🔧 Próximas mejoras

- Estadísticas de jugadores
- Sistema de ranking
- Rotaciones automáticas para 5 jugadores
- Historial de partidos
