# 📬 [3/10] Clasificación de Notificaciones por Email - FirstPlug

## 🎯 Resumen: 11 Notificaciones Organizadas

---

## 📌 TIPO 1: EVENTOS TRANSACCIONALES (Inmediatos)

### 1️⃣ **Habilitación de Usuario en Tenant**

- **Trigger**: SuperAdmin habilita usuario en tenant
- **Destinatarios**: Usuario habilitado
- **Timing**: Inmediato
- **Contenido**: "Ya puedes ingresar a la plataforma"
- **Complejidad**: ⭐ Baja

### 2️⃣ **Creación de Shipment (Event-Driven + Delayed Fallback)**

- **Trigger**: Shipment creado exitosamente
- **Destinatarios**: Usuario creador + Admin (si existe)
- **Lógica**:
  - Si status = "In Preparation" → Email inmediato (simple)
  - Si status = "Missing Data" → Esperar 10 min
    - Si cambia a "In Preparation" → Email de confirmación
    - Si sigue en "Missing Data" después de 10 min → Email de recordatorio
- **Timing**: Inmediato O 10 minutos (según estado)
- **Variantes**: 2 (In Preparation, Missing Data)
- **Complejidad**: ⭐⭐⭐ Alta (event-driven + delayed fallback)
- **Nota**: Usa event listener + Bull queue, NO cron job

### 3️⃣ **Cambio de Shipment a "On The Way"**

- **Trigger**: SuperAdmin cambia status
- **Destinatarios**: Usuario creador
- **Timing**: Inmediato
- **Contenido**: URL tracking si existe courier
- **Complejidad**: ⭐⭐ Media

### 4️⃣ **Shipment Recibido**

- **Trigger**: Status = "Received"
- **Destinatarios**: Usuario creador
- **Timing**: Inmediato
- **Contenido**: Confirmación de entrega
- **Complejidad**: ⭐ Baja

### 5️⃣ **Shipment Cancelado**

- **Trigger**: Status = "Cancelled"
- **Destinatarios**: Usuario creador
- **Timing**: Inmediato
- **Contenido**: Notificación + instrucciones reasignación
- **Complejidad**: ⭐⭐ Media

### 6️⃣ **Quote Generado**

- **Trigger**: Usuario submita request de cotización
- **Destinatarios**: Usuario + Admin (si existe)
- **Timing**: Inmediato
- **Contenido**: Confirmación recepción + datos quote
- **Complejidad**: ⭐ Baja

### 7️⃣ **Quote Cancelado**

- **Trigger**: Quote cancelado
- **Destinatarios**: Usuario
- **Timing**: Inmediato
- **Contenido**: Notificación cancelación
- **Complejidad**: ⭐ Baja

### 8️⃣ **Offboarding Solicitado**

- **Trigger**: Offboarding iniciado
- **Destinatarios**: Usuario + Admin
- **Timing**: Inmediato
- **Contenido**: Confirmación + detalles
- **Complejidad**: ⭐⭐ Media

### 9️⃣ **Shipment en "On Hold - Missing Data" (Recordatorio)**

- **Trigger**: Shipment sin actualizar por X días
- **Destinatarios**: Usuario creador
- **Timing**: Cron job (cada X horas)
- **Contenido**: Recordatorio + link video
- **Complejidad**: ⭐⭐ Media

---

## ⏰ TIPO 2: NOTIFICACIONES PROGRAMADAS (Cron Jobs)

### 🔟 **Onboarding Reminder - Primeros Días**

- **Trigger**: Cron job - 1 día, 3 días, 1 semana sin assets
- **Destinatarios**: Todos los users del tenant
- **Timing**:
  - Día 1: Asunto A
  - Día 3: Asunto B
  - Semana 1: Asunto C (luego semanal)
- **Contenido**: Instrucciones + video tutorial
- **Complejidad**: ⭐⭐⭐ Alta (3 variantes + lógica de timing)

### 1️⃣1️⃣ **Reporte Mensual de Computadoras**

- **Trigger**: Cron job - Primer martes del mes a las 10:08 hs
- **Destinatarios**: Cada tenant
- **Timing**: Mensual
- **Variantes** (5 casos):
  1. Sin computadoras → Instrucciones carga
  2. Todas óptimas sin acquisition date → Completar datos
  3. Con computadoras → Promedio antigüedad
  4. Faltan acquisition dates → Indicar cuántas
  5. Defective/Unusable → Detallar cuáles
  6. Por vencer (< 6 meses) → Detallar
  7. Vencidas → Detallar
- **Complejidad**: ⭐⭐⭐⭐ Muy Alta (7 variantes + lógica compleja)

---

## 📊 Resumen por Tipo

| Tipo                       | Cantidad | Timing        | Complejidad    |
| -------------------------- | -------- | ------------- | -------------- |
| Transaccionales Inmediatos | 7        | Inmediato     | Baja-Media     |
| Transaccionales Delayed    | 2        | 10 min / Cron | Media-Alta     |
| Programados (Cron)         | 2        | Cron job      | Media-Muy Alta |
| **TOTAL**                  | **11**   | Mixto         | Mixto          |

---

## 🏗️ Arquitectura Requerida

1. **EmailService**: Encapsulado, reutilizable

   - Templates dinámicos
   - Queue System (Bull/Redis) para delayed
   - Event listeners (@OnEvent)

2. **CronService**: Independiente (NO acoplado a Email)

   - Tareas genéricas
   - Inyecta EmailService
   - Inyecta otros servicios

3. **Event-Driven Pattern**:
   - ShipmentsService emite eventos
   - EmailService escucha eventos
   - Desacoplado y flexible
