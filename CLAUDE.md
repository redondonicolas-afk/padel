# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Modular WhatsApp bot system that can be configured per-chat for different business purposes. Currently supports event organization (padel, sports) with plans for expense tracking, data analysis, and more. Built with Node.js and whatsapp-web.js, featuring natural language processing and per-chat configuration.

## Development Commands

```bash
# Start the bot
npm start

# Development mode (same as start)
npm dev
```

## Architecture

### Modular System

The bot uses a **master-module architecture** where each chat can be independently configured:

**index.js** (bot master)
- WhatsApp client initialization with LocalAuth strategy
- Chat configuration detection and management
- Module routing based on chat configuration
- Admin-only configuration control
- QR code generation for WhatsApp Web authentication

**config/**
- `admin.json` - Admin user configuration (number + name)
- `chats.json` - Per-chat configuration (nickname, module, purpose)

**modulos/[module-name]/**
- `handler.js` - Message processing logic for the module
- `datos.json` - Module-specific database
- `aprendizajes.md` - Documentation and learning notes

### Current Modules

**eventos-deportivos** - Sports event organization
- Match creation with NLP
- Player management (4+ with rotation support)
- Court confirmation
- Team randomization
- Payment tracking
- Post-match statistics (2h delayed prompt)
- Win/loss tracking

### Data Model

**partidos.json** - Single source of truth containing:
```javascript
{
  partidos: [],      // Array of match objects
  estadisticas: {}   // Reserved for future stats tracking
}
```

**Match object structure:**
```javascript
{
  id: timestamp,
  groupId: "whatsapp-group-id",
  dia: "date or day name",
  hora: "HH:MM",
  lugar: "venue name",
  jugadores: [{
    id: "whatsapp-id",
    nombre: "display name",
    numero: "phone number",
    confirmado: boolean,
    fechaConfirmacion: "ISO timestamp"
  }],
  canchaConfirmada: boolean,
  confirmado: boolean,        // true when 4+ players AND court confirmed
  equipos: {                  // null until /sortear called
    equipo1: [player, player],
    equipo2: [player, player]
  },
  suplente: player,           // for 5-player matches
  resultado: {
    ganador: 1 or 2,
    fecha: "ISO timestamp"
  },
  precioTotal: number,
  pagos: [{
    jugadorId: string,
    jugadorNombre: string,
    monto: number,
    fecha: "ISO timestamp"
  }],
  createdAt: "ISO timestamp"
}
```

### Natural Language Detection

**detectarIntencion() function** (index.js:63-188)
- Regex-based intent classifier supporting Spanish conversational patterns
- Returns intent objects with extracted entities (día, hora, lugar, precio, monto, ganador)
- Supported intents:
  - `partido`: Create match (extracts date/time/venue from free text)
  - `anotarse`: Join match
  - `darse_de_baja`: Leave match
  - `confirmar_asistencia`: Confirm attendance
  - `pedir_confirmacion`: Request attendance confirmation from all
  - `sortear`: Draw teams
  - `resultado`: Record match result
  - `confirmar_cancha`: Confirm court reservation (with optional price)
  - `registrar_pago`: Record payment
  - `estado`: View match status
  - `ayuda`: Help

### Match State Machine

1. **Created** → jugadores: [], canchaConfirmada: false, confirmado: false
2. **Players joining** → jugadores.push() on "me anoto"
3. **Court confirmed** → canchaConfirmada: true on "cancha confirmada"
4. **Confirmed** → confirmado: true ONLY when jugadores.length >= 4 AND canchaConfirmada
5. **Teams drawn** → equipos: {...} on /sortear
6. **Finished** → resultado: {...} on /resultado

### Message Handling Flow

1. Filter: Only process group messages (index.js:196)
2. Detect intent via NLP (index.js:202)
3. Execute natural language handlers (index.js:204-691) OR
4. Fall through to slash command handlers (index.js:712-917)
5. Auto-save db after state mutations via guardarDB()

## Key Implementation Details

- **QR Generation**: Creates whatsapp-qr.png on startup and attempts to auto-open (Windows-specific: `start` command)
- **Group Isolation**: Each group maintains independent match state via groupId
- **Active Match Query**: Find with `!p.confirmado && !p.resultado` for pending OR `!p.resultado` for any active
- **Team Shuffling**: Fisher-Yates algorithm (index.js:817-820)
- **Payment Tracking**: Prevents duplicate payments per player, calculates per-person split ($total/4)
- **Dual Command Interface**: Natural language preferred, slash commands as fallback

## Common Patterns

**Finding active match in a group:**
```javascript
const partido = db.partidos.find(p =>
  p.groupId === groupId &&
  !p.confirmado &&  // or omit for any active
  !p.resultado
);
```

**Saving changes:**
```javascript
guardarDB();  // Always call after mutating db object
```

**Reply formatting:**
```javascript
await msg.reply(`emoji *BOLD HEADER*\n\nContent with ✅ emojis`);
```

## Configuration Flow

### Initial Setup (Admin Only)

When added to a new group, the admin (configured in `config/admin.json`) must configure the chat:

**Natural language:**
```
"Hola Cenote, acá te vas a llamar CP y vas a ayudarnos a organizar partidos de pádel"
```

The bot will:
1. Extract nickname ("CP")
2. Detect module type from keywords (pádel → eventos-deportivos)
3. Save configuration to `config/chats.json`
4. Respond with confirmation

**Commands:**
- `/info` - Show current chat configuration
- `/reconfigurar` - Reset chat configuration (admin only)

### Module-specific Usage

See `modulos/[module-name]/aprendizajes.md` for detailed command lists.

**eventos-deportivos examples:**
- "Armemos un partido el 25/11 a las 20 en ClubNorte"
- "Me anoto" / "Yo juego"
- "Cancha confirmada $44000"
- "Sortear equipos"
- "Ganamos"

## Adding New Modules

1. Create directory: `modulos/[module-name]/`
2. Implement `handler.js` with `handleMessage(msg, chatConfig)` export
3. Create `aprendizajes.md` for documentation
4. Add module to `MODULOS` object in `index.js`
5. Add keyword detection in `detectarConfiguracionInicial()`
