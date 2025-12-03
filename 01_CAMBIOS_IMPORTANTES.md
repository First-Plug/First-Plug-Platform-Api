# ⚠️ 00 - Cambios Importantes Basados en el Mock

## 🎯 Resumen de Cambios

Se han incorporado los requisitos del mock proporcionado. Esto afecta significativamente la estructura del schema y el formulario.

**Importante**:

- La información del usuario (email, nombre, teléfono, tenant) se obtiene del token/session y se envía automáticamente
- El usuario NO completa estos campos en el formulario
- **Primer Release**: Solo **Producto** (Servicio será en un release futuro)
- Las categorías de producto son las que ya existen en el sistema
- NO se pide presupuesto en ningún formulario
- Se pide **Brand** y **Model** para Computer, Audio, Monitor, Peripherals, Other
- Se pide **ProductName** para Merchandising
- Validación: Al menos uno de Brand, Model o ProductName debe estar presente
- Se pide **Additional Info** libre para especificar detalles

---

## 📊 Cambios Principales

### 1. **RequestID Automático**

```typescript
requestID: string; // Formato: QR-2025-001
```

- Se genera automáticamente al crear un quote
- Formato: `QR-YYYY-NNN` (QR-2025-001, QR-2025-002, etc.)

### 2. **Priority en Cada Item**

Cada producto/servicio tiene su propia prioridad:

```typescript
priority: 'low' | 'medium' | 'high' | 'urgent';
```

Descripciones:

- **Low**: NO rush
- **Medium**: standard
- **High**: Need soon
- **Urgent**: ASAP

### 3. **Items Array en RequestData**

Todos los tipos ahora tienen un array de items:

```typescript
items: Array<{
  // Campos específicos del tipo
  priority: 'low' | 'medium' | 'high' | 'urgent';
}>;
```

### 4. **Tabla de Quotes**

Columnas requeridas:

- **requestID**: QR-2025-001
- **type**: "product" o "service"
- **items**: Cantidad total de items
- **priority**: Prioridad más alta
- **created**: Fecha de creación
- **user**: Usuario que creó
- **actions**: Ver detalle

### 5. **Formulario Modal**

Flujo:

1. Seleccionar "Producto" o "Servicio"
2. Modal se abre con campos específicos
3. Agregar item a la lista
4. Repetir o enviar

---

## 📝 Tipos Principales - Primer Release

### ProductoData (NUEVO)

```typescript
interface ProductoData {
  items: Array<{
    category:
      | 'Computer'
      | 'Audio'
      | 'Monitor'
      | 'Peripherals'
      | 'Merchandising'
      | 'Other';
    brand?: string; // Opcional (para Merchandising)
    model?: string; // Opcional (para Merchandising)
    productName?: string; // Opcional (para Merchandising)
    quantity: number;
    additionalInfo?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryDate: string;
  comments?: string;
}

// Validación: Al menos uno de brand, model o productName debe estar presente
```

### ServicioData (Futuro Release)

```typescript
// Será agregado en un release futuro
```

---

## ✅ Resumen de Cambios - Primer Release

| Aspecto                    | Antes                | Ahora                                                 |
| -------------------------- | -------------------- | ----------------------------------------------------- |
| **Tipos de solicitud**     | 5 tipos              | Solo Producto (Servicio en futuro)                    |
| **Categorías de producto** | Personalizadas       | Del sistema (6 categorías)                            |
| **Presupuesto**            | Requerido en algunos | NO se pide                                            |
| **Brand y Model**          | N/A                  | Campos opcionales (para Computer, Audio, etc.)        |
| **ProductName**            | N/A                  | Campo opcional (para Merchandising)                   |
| **Validación**             | N/A                  | Al menos uno de Brand, Model o ProductName debe estar |
| **Additional Info**        | N/A                  | Campo opcional libre                                  |
| **Priority**               | En el quote          | En cada item                                          |
| **Items**                  | Algunos tipos        | Array de items                                        |
| **RequestID**              | N/A                  | QR-YYYY-NNN (automático)                              |

---

## 🚀 Próximos Pasos

1. **Lee** 10_QUOTES_FORM_FLOW.md (flujo completo)
2. **Lee** 09_QUOTES_MOCK_REQUIREMENTS.md (requisitos del mock)
3. **Lee** 07_QUOTES_TYPES_DEFINITION.md (tipos TypeScript)
4. **Comienza** implementación

---

**¡Estructura lista para implementar!**
