# 📋 [4/5] Plan de Implementación - Email Service

## 🎯 Estrategia: MVP en 2 Fases

**Fase 1 (MVP)**: 2-3 semanas - Transaccionales inmediatos
**Fase 2 (Escalado)**: 2-3 semanas - Delayed, queue, cron

---

## 🚀 FASE 1: MVP (2-3 semanas)

### **1.1 Setup Base**

#### Instalación de Dependencias

```bash
npm install resend
npm install zod  # Para validación
```

#### Crear Módulo Email

- [ ] `src/email/email.module.ts`
- [ ] `src/email/email.service.ts`
- [ ] `src/email/email.config.ts`
- [ ] `src/email/email.types.ts`

#### Configuración Resend

- [ ] Agregar `RESEND_API_KEY` a `.env`
- [ ] Crear `email.config.ts` con validación Zod
- [ ] Registrar en `ConfigModule`

---

### **1.2 Templates Transaccionales Inmediatos**

#### Template Base

- [ ] `src/email/templates/base.template.ts`
  - Estructura HTML responsive
  - Estilos CSS
  - Header/Footer

#### Templates (8 total)

- [ ] User Enabled
- [ ] Shipment Created (In Preparation)
- [ ] Shipment On Way
- [ ] Shipment Received
- [ ] Shipment Cancelled
- [ ] Quote Created
- [ ] Quote Cancelled
- [ ] Offboarding

---

### **1.3 Event Listeners**

- [ ] `src/email/events/email.events.ts`
- [ ] Escuchar eventos de ShipmentsService
- [ ] Escuchar eventos de QuotesService
- [ ] Escuchar eventos de MembersService

---

### **1.4 Integración con Servicios**

- [ ] ShipmentsService → emite eventos
- [ ] QuotesService → emite eventos
- [ ] MembersService → emite eventos
- [ ] EmailService → escucha eventos

---

### **1.5 Testing & Deployment**

- [ ] Unit tests (EmailService, templates)
- [ ] Integration tests (event flows)
- [ ] Deployment a staging
- [ ] Verificar en Resend dashboard

---

## 📈 FASE 2: Escalado (Semanas 4-6)

### **2.1 Queue System**

#### Instalación

```bash
npm install @nestjs/bull bull
npm install redis  # o usar Upstash
```

#### Setup

- [ ] `src/email/queue/email.queue.ts`
- [ ] `src/email/queue/email.processor.ts`
- [ ] Configurar Redis/In-Memory

---

### **2.2 Delayed Emails**

- [ ] Shipment Created (Missing Data) - 10 min delay
- [ ] Recordatorio Missing Data - 6 horas
- [ ] Reintentos automáticos

---

### **2.3 Cron Service (Independiente)**

#### Instalación

```bash
npm install @nestjs/schedule
```

#### Setup

- [ ] `src/cron/cron.module.ts`
- [ ] `src/cron/cron.service.ts`
- [ ] `src/cron/tasks/monthly-report.task.ts`
- [ ] `src/cron/tasks/missing-data-check.task.ts`

---

### **2.4 Estadísticas en BD**

- [ ] Crear tabla `EmailLog`
- [ ] Webhooks de Resend
- [ ] Endpoint `/webhooks/email-events`
- [ ] Queries de estadísticas

---

### **2.5 Testing & Deployment**

- [ ] Tests de queue
- [ ] Tests de cron jobs
- [ ] Deployment a producción
- [ ] Monitoreo

---

## 📊 Matriz de Dependencias

### FASE 1: MVP

```
EmailService (Base)
├── Templates (8 transaccionales)
├── Event Listeners
└── Integración (ShipmentsService, QuotesService, etc)
    └── Emiten eventos → EmailService escucha
```

### FASE 2: Escalado

```
Fase 1 (Base)
├── Queue System (Bull + Redis)
│   └── Delayed Emails
├── CronService (INDEPENDIENTE)
│   ├── Inyecta EmailService
│   ├── Inyecta ShipmentsService
│   └── Tareas genéricas
└── Estadísticas en BD
    ├── Tabla EmailLog
    ├── Webhooks Resend
    └── Queries complejas
```

---

## 🎯 Criterios de Éxito

- ✅ Todos los 11 tipos de notificaciones funcionando
- ✅ Emails entregados correctamente (Resend)
- ✅ Delayed emails procesados en tiempo
- ✅ Cron jobs ejecutándose en horarios correctos
- ✅ Logging completo de todos los envíos
- ✅ Tests con cobertura > 80%
- ✅ Documentación actualizada

---

## 📝 Notas Importantes

1. **Resend API Key**: Guardar en `.env`, NUNCA en código
2. **Templates**: Usar JSX/HTML limpio, responsive
3. **Logging**: Registrar todos los envíos para auditoría
4. **Errores**: Reintentos automáticos, alertas en fallos
5. **Testing**: Usar Resend sandbox para tests
