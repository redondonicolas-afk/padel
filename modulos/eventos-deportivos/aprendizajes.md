# Aprendizajes - Eventos Deportivos

## Configuración actual del módulo

**Propósito:** Organizar partidos de pádel semanales con gestión completa de jugadores, equipos, pagos y estadísticas.

## Funcionalidades implementadas

### ✅ Gestión de partidos
- Creación de partidos con lenguaje natural
- Detección de día/hora/lugar
- Confirmación automática cuando hay 4+ jugadores y cancha reservada
- Sistema de anotación/baja de jugadores

### ✅ Sistema de rotación para +4 jugadores
- Cuando hay más de 4 jugadores, se implementa rotación automática
- Todos juegan el mismo tiempo
- El bot organiza quién descansa en cada set

### ✅ Gestión de equipos
- Sorteo aleatorio de equipos
- Soporte para 4-5 jugadores
- Identificación de suplente

### ✅ Tracking de pagos
- Registro de quién pagó la cancha
- División automática del costo entre jugadores
- Tracking de quién debe a quién

### ✅ Estadísticas post-partido
- El bot pregunta estadísticas 2 horas después del partido confirmado
- Registro de resultados
- Historial de partidos

## Mejoras pendientes

- [ ] Sistema automático de recordatorios
- [ ] Ranking de jugadores por victorias
- [ ] Gestión de pagos entre personas (futuro)
- [ ] Rotaciones automáticas durante el partido (para 5+ jugadores)

## Comandos disponibles

### Lenguaje natural
- "Armemos un partido el [día] a las [hora] en [lugar]"
- "Me anoto" / "Yo juego" / "Cuenta conmigo"
- "Me bajo" / "No puedo"
- "Cancha confirmada" (con precio opcional)
- "Sortear equipos"
- "Ganamos" / "Perdimos"
- "Cómo vamos?" / "Estado"

### Comandos slash
- `/partido [día] [hora] [lugar]`
- `/anotarse`
- `/sortear`
- `/resultado [1 o 2]`
- `/estado`
- `/ayuda`

## Notas técnicas

- Base de datos: JSON local
- Detección por groupId
- Persistencia automática en cada operación
