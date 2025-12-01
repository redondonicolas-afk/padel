# Changelog - Bot de Pádel

## [2025-11-29] - Reestructuración completa del sistema

### 🐛 Bugs Corregidos

#### 1. Problema: Dos bots corriendo simultáneamente
**Síntoma:** El bot respondía dos veces a cada mensaje, uno con "como vamos" y otro con "como venimos"

**Causa raíz:** En `index.js` había dos event listeners separados para el evento `message`:
- Líneas 114-181: Handler principal para routing de módulos
- Líneas 184-221: Handler secundario para comandos admin

**Solución:**
- Consolidé ambos handlers en un único event listener
- Movó los comandos admin (`/reconfigurar`, `/info`) al principio del handler principal
- Eliminé el segundo listener duplicado

**Archivos modificados:**
- `index.js`: Líneas 113-207 (handler único consolidado)

---

#### 2. Problema: Partidos no se cerraban después de registrar resultado
**Síntoma:** Después de registrar el resultado de un partido, no se podía crear un nuevo partido porque el anterior seguía "activo"

**Causa raíz:**
- No existía un flag `finalizado` en la estructura de partidos
- Todas las búsquedas de partido activo solo verificaban `!p.resultado`
- El partido quedaba en estado limbo: con resultado pero sin marcar como finalizado

**Solución:**
- Agregué campo `finalizado: false` a la estructura inicial del partido
- Agregué `historialPartidos` array a la DB para partidos finalizados
- Actualicé TODAS las búsquedas de partido activo para verificar:
  - `!p.resultado`
  - `!p.finalizado`
- En `registrarResultado()`:
  - Marco `partido.finalizado = true`
  - Agrego `fechaFinalizacion`
  - Muevo el partido al `historialPartidos`
  - Mensaje de confirmación incluye "Podés organizar un nuevo partido cuando quieras!"

**Archivos modificados:**
- `handler.js`:
  - Línea 11: Agregado `historialPartidos` a estructura DB
  - Línea 257: Agregado `finalizado: false` en creación de partido
  - Líneas 285-289: `anotarsePartido()` - agregado `!p.finalizado`
  - Líneas 334-338: `darseDeBalja()` - agregado `!p.finalizado`
  - Líneas 367-371: `confirmarAsistencia()` - agregado `!p.finalizado`
  - Líneas 398-402: `pedirConfirmacion()` - agregado `!p.finalizado`
  - Líneas 428-434: `sortearEquipos()` - agregado `!p.finalizado`
  - Líneas 479-484: `registrarResultado()` - agregado `!p.finalizado`
  - Líneas 505-513: `registrarResultado()` - marcar como finalizado y mover a historial
  - Líneas 523-528: `confirmarCancha()` - agregado `!p.finalizado`
  - Líneas 601-605: `registrarPago()` - agregado `!p.finalizado`
  - Líneas 651-655: `mostrarEstado()` - agregado `!p.finalizado`

---

#### 3. Problema: Solicitud de estadísticas se enviaba antes de tiempo
**Síntoma:** El mensaje de estadísticas 2 horas después no esperaba a que el partido realmente terminara

**Solución:**
- Actualicé `verificarEstadisticasPendientes()` para verificar:
  - `partido.resultado` existe
  - `partido.finalizado === true`
- Mejoré el mensaje de estadísticas para incluir el equipo ganador

**Archivos modificados:**
- `handler.js`: Líneas 830-856 (función `verificarEstadisticasPendientes`)

---

### ✨ Mejoras

1. **Mensaje de partido finalizado más claro:**
   - Ahora incluye: "💬 Podés organizar un nuevo partido cuando quieras!"

2. **Mensaje de estadísticas post-partido mejorado:**
   - Incluye quién ganó
   - Preguntas más específicas sobre el partido

3. **Documentación actualizada:**
   - `README.md` actualizado con características completas
   - Explicación de lenguaje natural
   - Arquitectura modular documentada

---

### 🔧 Cambios Técnicos

**Estructura de Partido (antes vs después):**

```javascript
// ANTES
{
  id, groupId, dia, hora, lugar,
  jugadores: [],
  canchaConfirmada: false,
  confirmado: false,
  equipos: null,
  resultado: null,  // ← Solo este campo
  precioTotal: null,
  pagos: [],
  createdAt
}

// DESPUÉS
{
  id, groupId, dia, hora, lugar,
  jugadores: [],
  canchaConfirmada: false,
  confirmado: false,
  equipos: null,
  resultado: null,
  finalizado: false,  // ← NUEVO campo crítico
  fechaFinalizacion,  // ← Se agrega al finalizar
  precioTotal: null,
  pagos: [],
  createdAt
}
```

**Estructura de DB (antes vs después):**

```javascript
// ANTES
{
  partidos: [],
  estadisticas: {},
  estadisticasPendientes: []
}

// DESPUÉS
{
  partidos: [],
  estadisticas: {},
  estadisticasPendientes: [],
  historialPartidos: []  // ← NUEVO: partidos finalizados
}
```

---

### 📊 Testing Sugerido

1. **Ciclo completo de partido:**
   - [ ] Crear partido con lenguaje natural
   - [ ] Anotar 4 jugadores
   - [ ] Confirmar cancha
   - [ ] Sortear equipos
   - [ ] Registrar resultado
   - [ ] Verificar que partido se marca como finalizado
   - [ ] Crear NUEVO partido (debe funcionar)

2. **Verificar que no hay duplicación:**
   - [ ] Enviar mensaje y verificar UNA sola respuesta
   - [ ] Probar con varios mensajes consecutivos

3. **Estadísticas post-partido:**
   - [ ] Crear partido con hora actual + 1 minuto
   - [ ] Completar partido
   - [ ] Esperar 2 horas (o modificar timestamp en DB para testing)
   - [ ] Verificar que mensaje se envía correctamente

---

### 🚀 Próximos pasos recomendados

1. Agregar comando `/historial` para ver partidos pasados
2. Comando `/stats` para ver estadísticas personales
3. Limpieza automática de partidos muy antiguos del historial
4. Comando `/cancelar` para cancelar partido activo
5. Migrar a TypeScript para mejor type safety
6. Agregar tests unitarios con Jest
