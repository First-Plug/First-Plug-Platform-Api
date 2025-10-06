# ✅ Checklist de Implementación Frontend - Warehouse Management

Este documento es una guía paso a paso para implementar la gestión de warehouses en el frontend del SuperAdmin.

---

## 📋 Checklist General

### 1. Configuración Inicial
- [ ] Crear interfaces TypeScript para Warehouse y DTOs
- [ ] Configurar servicios/API para los endpoints
- [ ] Configurar manejo de errores global
- [ ] Configurar notificaciones/toasts

### 2. UI/UX Components
- [ ] Crear formulario de edición de warehouse
- [ ] Crear switch/toggle para isActive
- [ ] Crear modal de confirmación para activación
- [ ] Crear indicadores visuales de completitud
- [ ] Crear tooltips informativos

### 3. Validaciones
- [ ] Implementar validación de campos requeridos
- [ ] Implementar validación en tiempo real
- [ ] Deshabilitar toggle si warehouse incompleto
- [ ] Mostrar campos faltantes

### 4. Funcionalidades
- [ ] Implementar actualización de datos
- [ ] Implementar toggle de activación
- [ ] Implementar obtención de warehouses
- [ ] Implementar manejo de respuestas
- [ ] Implementar manejo de errores

---

## 🎨 Componentes a Crear

### 1. WarehouseForm Component

**Propósito:** Formulario para editar datos del warehouse

**Props:**
```typescript
interface WarehouseFormProps {
  warehouse: Warehouse;
  country: string;
  onSave: (data: UpdateWarehouseDataDto) => Promise<void>;
  onCancel: () => void;
}
```

**Campos del Formulario:**
- [ ] Name (required, max 100)
- [ ] Address (required, max 200)
- [ ] Apartment (optional, max 100)
- [ ] City (required, max 50)
- [ ] State (required, max 50)
- [ ] Zip Code (required, max 20)
- [ ] Email (optional, email validation)
- [ ] Phone (optional)
- [ ] Contact Person (optional, max 100)
- [ ] Canal (select: whatsapp, slack, mail, phone)
- [ ] Partner Type (select: partner, own, temporary, default)
- [ ] Additional Info (optional, textarea, max 500)

**Validaciones:**
- [ ] Validar campos requeridos
- [ ] Validar formato de email
- [ ] Validar longitud máxima de campos
- [ ] Mostrar errores en tiempo real
- [ ] Deshabilitar botón "Save" si hay errores

---

### 2. WarehouseActiveToggle Component

**Propósito:** Switch para activar/desactivar warehouse

**Props:**
```typescript
interface WarehouseActiveToggleProps {
  warehouse: Warehouse;
  country: string;
  onToggle: (isActive: boolean) => Promise<void>;
  disabled?: boolean;
}
```

**Comportamiento:**
- [ ] Mostrar estado actual (activo/inactivo)
- [ ] Deshabilitar si warehouse incompleto
- [ ] Mostrar tooltip si está deshabilitado
- [ ] Abrir modal de confirmación al hacer click
- [ ] Actualizar estado después de confirmación

---

### 3. WarehouseActivationModal Component

**Propósito:** Modal de confirmación para activar/desactivar

**Props:**
```typescript
interface WarehouseActivationModalProps {
  isOpen: boolean;
  warehouse: Warehouse;
  country: string;
  action: 'activate' | 'deactivate';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

**Contenido del Modal:**

**Para Activar:**
```
⚠️ ¿Estás seguro de activar este warehouse?

Warehouse: [Nombre]
País: [País]

Esto causará:
• Desactivación de otros warehouses activos en [País]
• Migración automática de productos al nuevo warehouse

¿Deseas continuar?

[Cancelar] [Activar]
```

**Para Desactivar:**
```
⚠️ ¿Estás seguro de desactivar este warehouse?

Warehouse: [Nombre]
País: [País]

El sistema buscará automáticamente otro warehouse completo para activar.
Si no hay otro disponible, el país quedará sin warehouse activo.

¿Deseas continuar?

[Cancelar] [Desactivar]
```

---

### 4. WarehouseCompletenessIndicator Component

**Propósito:** Indicador visual de completitud del warehouse

**Props:**
```typescript
interface WarehouseCompletenessIndicatorProps {
  warehouse: Warehouse;
}
```

**Estados:**
- [ ] ✅ Completo (verde) - Todos los campos requeridos completos
- [ ] ⚠️ Incompleto (amarillo/rojo) - Faltan campos requeridos
- [ ] Mostrar lista de campos faltantes en tooltip

**Ejemplo:**
```
✅ Warehouse completo
   Puede ser activado

⚠️ Warehouse incompleto
   Faltan: city, zipCode
```

---

## 🔧 Funciones Utilitarias

### 1. Validación de Completitud

```typescript
/**
 * Verifica si un warehouse tiene todos los campos requeridos
 */
function isWarehouseComplete(warehouse: Warehouse): boolean {
  const requiredFields: (keyof Warehouse)[] = [
    'name',
    'address',
    'city',
    'state',
    'zipCode'
  ];
  
  return requiredFields.every(field => {
    const value = warehouse[field];
    return value && typeof value === 'string' && value.trim() !== '';
  });
}
```

### 2. Obtener Campos Faltantes

```typescript
/**
 * Retorna lista de campos requeridos faltantes
 */
function getMissingFields(warehouse: Warehouse): string[] {
  const requiredFields: (keyof Warehouse)[] = [
    'name',
    'address',
    'city',
    'state',
    'zipCode'
  ];
  
  return requiredFields.filter(field => {
    const value = warehouse[field];
    return !value || typeof value !== 'string' || value.trim() === '';
  });
}
```

### 3. Formatear Nombres de Campos

```typescript
/**
 * Convierte nombres de campos a formato legible
 */
function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    name: 'Nombre',
    address: 'Dirección',
    city: 'Ciudad',
    state: 'Estado/Provincia',
    zipCode: 'Código Postal',
    email: 'Email',
    phone: 'Teléfono',
    contactPerson: 'Persona de Contacto',
    canal: 'Canal de Comunicación',
    partnerType: 'Tipo de Partner',
    additionalInfo: 'Información Adicional'
  };
  
  return fieldNames[field] || field;
}
```

---

## 🌐 Servicios API

### 1. Warehouse Service

```typescript
class WarehouseService {
  private baseUrl = '/superadmin/warehouses';
  
  /**
   * Actualizar datos del warehouse
   */
  async updateWarehouseData(
    country: string,
    warehouseId: string,
    data: UpdateWarehouseDataDto
  ): Promise<UpdateWarehouseDataResponse> {
    const response = await fetch(
      `${this.baseUrl}/${country}/${warehouseId}/data`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );
    
    if (!response.ok) {
      throw await this.handleError(response);
    }
    
    return await response.json();
  }
  
  /**
   * Toggle estado de activación
   */
  async toggleWarehouseActive(
    country: string,
    warehouseId: string,
    isActive: boolean
  ): Promise<ToggleWarehouseActiveResponse> {
    const response = await fetch(
      `${this.baseUrl}/${country}/${warehouseId}/toggle-active`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      }
    );
    
    if (!response.ok) {
      throw await this.handleError(response);
    }
    
    return await response.json();
  }
  
  /**
   * Obtener warehouses de un país
   */
  async getWarehousesByCountry(country: string): Promise<CountryWarehousesResponse> {
    const response = await fetch(
      `${this.baseUrl}/${country}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      }
    );
    
    if (!response.ok) {
      throw await this.handleError(response);
    }
    
    return await response.json();
  }
  
  /**
   * Manejo de errores
   */
  private async handleError(response: Response): Promise<Error> {
    const error = await response.json();
    return new Error(error.message || 'Error desconocido');
  }
  
  /**
   * Obtener token de autenticación
   */
  private getToken(): string {
    // Implementar según tu sistema de autenticación
    return localStorage.getItem('token') || '';
  }
}
```

---

## 🎯 Flujos de Usuario

### Flujo 1: Editar Datos del Warehouse

```
1. Usuario abre formulario de edición
   ↓
2. Formulario se carga con datos actuales
   ↓
3. Usuario edita campos
   ↓
4. Validación en tiempo real
   ↓
5. Usuario hace click en "Guardar"
   ↓
6. Frontend valida datos
   ↓
7. Frontend envía PATCH /warehouses/:country/:warehouseId/data
   ↓
8. Backend procesa y retorna respuesta
   ↓
9. Frontend procesa respuesta:
   - Si autoActivated: Mostrar notificación especial
   - Si success: Mostrar mensaje de éxito
   - Si error: Mostrar mensaje de error
   ↓
10. Actualizar UI con nuevos datos
```

### Flujo 2: Activar Warehouse

```
1. Usuario hace click en toggle "Active"
   ↓
2. Frontend valida si warehouse está completo
   ↓
3. Si incompleto:
   - Mostrar tooltip con campos faltantes
   - No permitir activación
   ↓
4. Si completo:
   - Abrir modal de confirmación
   ↓
5. Usuario lee advertencias en modal
   ↓
6. Usuario hace click en "Activar"
   ↓
7. Frontend envía PATCH /warehouses/:country/:warehouseId/toggle-active
   Body: { "isActive": true }
   ↓
8. Backend procesa:
   - Valida completitud
   - Desactiva otros warehouses
   - Migra productos
   ↓
9. Frontend recibe respuesta
   ↓
10. Frontend muestra resultados:
    - Warehouses desactivados
    - Productos migrados
    - Tenants afectados
    ↓
11. Actualizar UI
```

### Flujo 3: Desactivar Warehouse

```
1. Usuario hace click en toggle "Active" (para desactivar)
   ↓
2. Abrir modal de confirmación
   ↓
3. Usuario lee advertencias
   ↓
4. Usuario hace click en "Desactivar"
   ↓
5. Frontend envía PATCH /warehouses/:country/:warehouseId/toggle-active
   Body: { "isActive": false }
   ↓
6. Backend procesa:
   - Desactiva warehouse
   - Busca otro para activar
   ↓
7. Frontend recibe respuesta
   ↓
8. Si hay warning:
   - Mostrar alerta amarilla
   - Informar que país quedó sin warehouse activo
   ↓
9. Actualizar UI
```

---

## 🚨 Manejo de Errores

### Error 400: Warehouse Incompleto

```typescript
try {
  await warehouseService.toggleWarehouseActive(country, warehouseId, true);
} catch (error) {
  if (error.statusCode === 400) {
    // Parsear mensaje para obtener campos faltantes
    const missingFields = parseMissingFields(error.message);
    
    showError(
      'No se puede activar el warehouse',
      `Faltan los siguientes campos: ${missingFields.join(', ')}`
    );
    
    // Enfocar primer campo faltante
    focusField(missingFields[0]);
  }
}
```

### Error 404: Warehouse No Encontrado

```typescript
try {
  await warehouseService.updateWarehouseData(country, warehouseId, data);
} catch (error) {
  if (error.statusCode === 404) {
    showError(
      'Warehouse no encontrado',
      'El warehouse que intentas actualizar no existe'
    );
    
    // Recargar lista de warehouses
    await reloadWarehouses();
  }
}
```

### Error 401/403: No Autorizado

```typescript
try {
  await warehouseService.toggleWarehouseActive(country, warehouseId, true);
} catch (error) {
  if (error.statusCode === 401 || error.statusCode === 403) {
    showError(
      'Sesión expirada',
      'Por favor, inicia sesión nuevamente'
    );
    
    // Redirigir a login
    router.push('/login');
  }
}
```

---

## 📱 Notificaciones

### Tipos de Notificaciones

1. **Éxito Simple**
   ```
   ✅ Warehouse actualizado correctamente
   ```

2. **Éxito con Auto-activación**
   ```
   ✅ Warehouse actualizado y activado automáticamente
   El warehouse se completó y fue activado porque no había otro activo en el país.
   ```

3. **Éxito con Migración**
   ```
   ✅ Warehouse activado correctamente
   • Warehouses desactivados: Warehouse Buenos Aires Norte
   • Productos migrados: 45
   • Tenants afectados: 3
   ```

4. **Warning**
   ```
   ⚠️ Warehouse desactivado
   Argentina ahora no tiene warehouses activos. Los productos no podrán asignarse a FP warehouse hasta que se active uno.
   ```

5. **Error**
   ```
   ❌ No se puede activar el warehouse
   Faltan los siguientes campos: city, zipCode
   ```

---

## ✅ Testing Checklist

### Tests Unitarios
- [ ] Validación de completitud
- [ ] Obtención de campos faltantes
- [ ] Formateo de nombres de campos

### Tests de Integración
- [ ] Actualizar datos del warehouse
- [ ] Activar warehouse completo
- [ ] Intentar activar warehouse incompleto
- [ ] Desactivar warehouse
- [ ] Obtener warehouses por país

### Tests E2E
- [ ] Flujo completo de edición
- [ ] Flujo completo de activación
- [ ] Flujo completo de desactivación
- [ ] Manejo de errores

---

## 📚 Recursos

- **Documentación Principal:** `docs/SUPERADMIN-WAREHOUSE-ENDPOINTS.md`
- **Ejemplos de Código:** `docs/SUPERADMIN-WAREHOUSE-EXAMPLES.md`
- **Resumen Ejecutivo:** `docs/WAREHOUSE-UPDATE-SUMMARY.md`

---

**Última Actualización:** 2025-01-20
**Versión:** 1.0

