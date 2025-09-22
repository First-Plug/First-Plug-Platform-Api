# 🌍 Migración de Países: Nombres → Códigos

Este documento explica cómo migrar los campos `country` de nombres completos (ej: "Argentina") a códigos ISO (ej: "AR") en toda la aplicación.

## 📋 Resumen de Cambios

### **Antes:**
```json
{
  "country": "Argentina",
  "originDetails": { "country": "Brazil" },
  "changes": { "oldData": { "country": "Chile" } }
}
```

### **Después:**
```json
{
  "country": "AR",
  "originDetails": { "country": "BR" },
  "changes": { "oldData": { "country": "CL" } }
}
```

## 🛠️ Scripts Disponibles

### **1. Test de Migración (Recomendado empezar aquí)**

```bash
# Listar todos los tenants disponibles
npm run test:migration list

# Ver estado actual de un tenant
npm run test:migration status mechi_test

# Simular migración sin hacer cambios (DRY RUN)
npm run test:migration dry-run mechi_test
```

### **2. Migración Real**

```bash
# Migrar un tenant específico (RECOMENDADO)
npm run migrate:countries mechi_test

# Migrar todos los tenants (CUIDADO!)
npm run migrate:countries
```

## 🎯 Estrategia Recomendada

### **Paso 1: Análisis**
```bash
# 1. Ver qué tenants tienes
npm run test:migration list

# 2. Elegir un tenant pequeño para probar
npm run test:migration status tenant_pequeño

# 3. Ver qué cambios se harían (sin modificar nada)
npm run test:migration dry-run tenant_pequeño
```

### **Paso 2: Prueba**
```bash
# Migrar el tenant de prueba
npm run migrate:countries tenant_pequeño

# Verificar que funcionó
npm run test:migration status tenant_pequeño
```

### **Paso 3: Producción**
```bash
# Migrar tenant por tenant
npm run migrate:countries tenant_1
npm run migrate:countries tenant_2
# ... etc
```

## 📊 Colecciones Afectadas

### **Por Tenant:**
- **`members`**: Campo `country`
- **`offices`**: Campo `country`  
- **`shipments`**: Campos `originDetails.country` y `destinationDetails.country`
- **`historial`**: Campos `changes.oldData.country` y `changes.newData.country` (recursivo)

### **Global:**
- **`users`**: Campo `country`

## 🔍 Mapeo de Países

El script usa el archivo existente `src/shipments/helpers/countryCodes.ts` más casos especiales:

```typescript
{
  "Argentina": "AR",
  "Brazil": "BR", 
  "Brasil": "BR",  // Variante
  "Chile": "CL",
  "Our office": "OO",     // Código especial
  "FP warehouse": "FP",   // Código especial
  // ... todos los países ISO
}
```

## ⚠️ Consideraciones Importantes

### **Backup**
- **SIEMPRE** haz backup antes de migrar
- Prueba primero con un tenant pequeño
- Verifica que la aplicación funcione después

### **Validaciones**
- Los schemas ya están actualizados para aceptar códigos
- Durante la migración, se permiten ambos formatos
- Después de migrar, solo se aceptarán códigos

### **History/Historial**
- Es la colección más compleja (datos anidados)
- El script busca recursivamente campos `country`
- Puede tomar más tiempo que otras colecciones

## 🚨 Troubleshooting

### **Error: "Country not found in mapping"**
```bash
# Ver qué países no están mapeados
npm run test:migration dry-run tenant_name
```
Agregar países faltantes al archivo `countryCodes.ts`

### **Error: "Connection failed"**
Verificar variables de entorno:
```bash
export MONGO_URI="mongodb://localhost:27017"
export MAIN_DB_NAME="first-plug"
```

### **Rollback**
Si algo sale mal, restaurar desde backup:
```bash
# Restaurar colección específica
mongorestore --db tenant_nombre --collection members backup/members.bson

# Restaurar tenant completo
mongorestore --db tenant_nombre backup/tenant_nombre/
```

## 📈 Monitoreo Post-Migración

### **Verificar Estado**
```bash
# Ver si la migración fue exitosa
npm run test:migration status tenant_name
```

### **Logs de Aplicación**
- Verificar que no hay errores de validación
- Confirmar que el frontend muestra países correctamente
- Probar crear/editar members, users, offices

### **Base de Datos**
```javascript
// Verificar que no quedan nombres sin migrar
db.members.find({ country: { $not: /^[A-Z]{2}$/, $ne: "" } })
db.offices.find({ country: { $not: /^[A-Z]{2}$/, $ne: "" } })
```

## ✅ Checklist de Migración

- [ ] Backup completo de la base de datos
- [ ] Probar con tenant pequeño
- [ ] Verificar que el frontend funciona
- [ ] Migrar tenants de producción uno por uno
- [ ] Verificar estado post-migración
- [ ] Monitorear logs por 24-48 horas
- [ ] Documentar cualquier issue encontrado

---

**💡 Tip:** Siempre empezar con `dry-run` para ver qué cambios se harían antes de ejecutar la migración real.
