# Debug - Quotes GET Endpoint Paginación

## Console Logs Agregados

Se han agregado console.log en los siguientes lugares para debuggear:

### 1. **QuotesController.findAll()**
```
🎯 GET /quotes called with query params: { page, size, startDate, endDate }
👤 User info: { tenantName, userEmail }
📅 Parsed dates: { start, end }
📦 Final result: { dataCount, totalCount, totalPages }
```

### 2. **QuotesService.findAll() - Legacy**
```
🔍 findAll (legacy) called with: { tenantName, userEmail }
✅ findAll results count: X
```

### 3. **QuotesService.findAllPaginated()**
```
🔍 findAllPaginated called with: { tenantName, userEmail, page, size, startDate, endDate }
📋 Query: { userEmail, isDeleted, createdAt }
⏭️ Skip: X Limit: Y
✅ Results: { dataCount, totalCount, totalPages }
```

## Pasos para Debuggear

### 1. Verificar que hay quotes en la BD
```bash
# Llamar al endpoint legacy (sin paginación)
GET /quotes
```
Debería retornar un array con quotes. Si retorna `[]`, no hay quotes en la BD.

### 2. Verificar parámetros del controller
```bash
# Llamar con parámetros explícitos
GET /quotes?page=1&size=10
```
Revisar console para ver:
- ✅ `🎯 GET /quotes called with query params`
- ✅ `👤 User info`
- ✅ `📅 Parsed dates`

### 3. Verificar query de MongoDB
```bash
# Llamar con filtro de fecha
GET /quotes?page=1&size=10&startDate=2025-01-01T00:00:00Z&endDate=2025-12-31T23:59:59Z
```
Revisar console para ver:
- ✅ `📋 Query` - Debe mostrar el query de MongoDB
- ✅ `⏭️ Skip/Limit` - Debe mostrar skip=0, limit=10
- ✅ `✅ Results` - Debe mostrar dataCount > 0

## Posibles Problemas

### ❌ Problema 1: dataCount = 0 pero legacy findAll() retorna datos
**Causa**: El filtro de fecha está excluyendo los datos
**Solución**: Revisar que startDate/endDate sean correctas

### ❌ Problema 2: userEmail no coincide
**Causa**: El userEmail del token no coincide con el guardado en BD
**Solución**: Verificar que el usuario que crea quotes sea el mismo que hace el GET

### ❌ Problema 3: isDeleted = true
**Causa**: Las quotes están marcadas como eliminadas
**Solución**: Verificar que isDeleted sea false en la BD

## Comandos Útiles

### Ver logs en tiempo real
```bash
npm run start:dev
# Luego hacer requests y ver console
```

### Limpiar console
```bash
# En el terminal
clear
```

### Verificar BD directamente
```bash
# Conectar a MongoDB y ejecutar:
db.quotes.find({ userEmail: "tu@email.com", isDeleted: false }).pretty()
```

