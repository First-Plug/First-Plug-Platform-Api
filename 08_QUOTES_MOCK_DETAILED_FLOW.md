# 🎯 12 - Flujo Detallado del Mock - Pantallas y Campos por Categoría

## 📱 Flujo General (Multi-Paso)

```
Pantalla 1: Seleccionar Categoría
    ↓
Pantalla 2: Campos Específicos de la Categoría
    ↓
Pantalla 3: Datos de Entrega (Country, City, Delivery Date, Comments)
    ↓
Guardar Quote
```

---

## 🛍️ Categorías Disponibles

**Categorías del Sistema:**
- Computer
- Audio
- Monitor
- Peripherals
- Other

**Nuevas Categorías (del Mock):**
- Furniture
- Phone
- Tablet

---

## 📋 Pantalla 1: Seleccionar Categoría

Botón por cada categoría (8 opciones totales)

---

## 🖥️ Pantalla 2: Campos Específicos por Categoría

### Computer

**Paso 2a: Seleccionar OS (Opcional)**
- Opciones: macOS, Windows, Linux
- Botón: "Skip" (para saltar esta selección)

**Paso 2b: Campos Específicos**
- Quantity (número)
- Brand (dropdown)
- Model (string)
- Processor (dropdown)
- RAM (dropdown)
- Storage (dropdown)
- Screen Size (dropdown)
- Other Specifications (textarea)

**Checkboxes Adicionales:**
- Extend Warranty
- Device Enrollment (ABM/Intune/MDM setup)

**Botón**: Continue

---

### Tablet

**Campos:**
- Country (dropdown)
- City (string)
- Required Delivery Date (date)
- Additional Comments (textarea)

**Botón**: Save Product

---

### Merchandising

**Campos:**
- Quantity (número)
- Description (textarea)
- Additional Requirements (textarea)

**Botón**: Continue

---

### Phone

**Campos:** (Similar a Tablet - necesita confirmación)
- Quantity
- Brand (dropdown)
- Model (string)
- Additional Info (textarea)

**Botón**: Continue

---

### Audio

**Campos:** (Similar a Computer - necesita confirmación)
- Quantity
- Brand (dropdown)
- Model (string)
- Specifications (textarea)

**Botón**: Continue

---

### Monitor

**Campos:** (Similar a Computer - necesita confirmación)
- Quantity
- Brand (dropdown)
- Model (string)
- Screen Size (dropdown)
- Resolution (dropdown)
- Additional Specs (textarea)

**Botón**: Continue

---

### Peripherals

**Campos:** (Similar a Computer - necesita confirmación)
- Quantity
- Brand (dropdown)
- Model (string)
- Type (dropdown)
- Additional Info (textarea)

**Botón**: Continue

---

### Other

**Campos:**
- Quantity
- Description (textarea)
- Additional Info (textarea)

**Botón**: Continue

---

## 📍 Pantalla 3: Datos de Entrega (Común para Todas)

**Campos:**
- Country (dropdown)
- City (string)
- Required Delivery Date (date)
- Additional Comments (textarea)

**Botón**: Save

---

## 🔑 Observaciones Importantes

1. **Tablet**: Va directamente a Pantalla 3 (sin Pantalla 2)
2. **Computer**: Tiene Pantalla 2a (seleccionar OS) + Pantalla 2b (campos específicos)
3. **Merchandising**: Tiene Pantalla 2 pero sin Brand/Model
4. **Skip OS**: Si selecciona "Skip" en Computer, igual va a Pantalla 2b
5. **Checkboxes**: Solo en Computer (Warranty, Device Enrollment)

---

## 📊 Estructura de Datos Esperada

Cada categoría tendrá su propia estructura en `requestData`:

```typescript
interface ProductoItem {
  category: string;
  // Campos específicos según categoría
  quantity: number;
  // ... otros campos
}
```

---

**Próximo paso**: Actualizar todos los documentos con esta estructura multi-paso.

