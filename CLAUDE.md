# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp bot for organizing padel matches in group chats. Built with Node.js and whatsapp-web.js, featuring natural language processing for conversational commands and a simple JSON-based data persistence layer.

## Development Commands

```bash
# Start the bot
npm start

# Development mode (same as start)
npm dev
```

## Architecture

### Core Components

**index.js** (main file)
- WhatsApp client initialization with LocalAuth strategy
- Message event handlers for both natural language and slash commands
- QR code generation for WhatsApp Web authentication (terminal + PNG file)
- JSON database operations (read/write to partidos.json)

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

## Natural Language Examples

- "Armemos un partido el 25/11 a las 20 en ClubNorte"
- "Me anoto" / "Yo juego" / "Cuenta conmigo"
- "Me bajo" / "No puedo" / "Cancelo"
- "Cancha confirmada $44000" → sets price and confirms court
- "Pagué $11000" → records individual payment
- "Sortear equipos"
- "Ganamos" → team 1 wins (sender's team assumed)
- "Cómo vamos?" / "Estado"
