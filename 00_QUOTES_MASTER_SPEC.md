# 📋 QUOTES - Master Specification (Multi-Step Form)

## 🎯 Overview

**Quotes** es un sistema para que usuarios soliciten presupuestos de productos. El formulario es **multi-paso** con campos **específicos por categoría**.

---

## 📱 Flujo General

```
Pantalla 1: Seleccionar Categoría (8 opciones)
    ↓
Pantalla 2: Campos Específicos de la Categoría
    ↓
Pantalla 3: Datos de Entrega (Común)
    ↓
Guardar Quote
```

---

## 🛍️ Categorías y Campos

### Computer (Especial - 2 sub-pantallas)
**Pantalla 2a**: OS Selection (macOS, Windows, Linux) - Opcional, con "Skip"
**Pantalla 2b**: 
- Quantity, Brand, Model, Processor, RAM, Storage, Screen Size, Other Specifications
- Checkboxes: Extend Warranty, Device Enrollment

### Monitor
- Quantity, Brand, Model, Screen Size, Resolution, Additional Specs

### Audio
- Quantity, Brand, Model, Specifications

### Peripherals
- Quantity, Brand, Model, Type, Additional Info

### Merchandising
- Quantity, Description (textarea), Additional Requirements (textarea)

### Other
- Quantity, Description (textarea), Additional Info (textarea)

### Phone (Nuevo)
- Quantity, Brand, Model, Additional Info

### Tablet (Nuevo)
- **Directo a Pantalla 3** (sin Pantalla 2)

---

## 📍 Pantalla 3: Datos de Entrega (Común)
- Country (dropdown)
- City (string)
- Required Delivery Date (date)
- Additional Comments (textarea)

---

## 💾 Quote Schema

```typescript
{
  _id: ObjectId,
  tenantId: ObjectId,
  userEmail: string,
  userName?: string,
  userPhone?: string,
  requestType: 'Comprar productos',
  requestData: {
    category: string,
    // Campos específicos según categoría
    quantity: number,
    country: string,
    city: string,
    deliveryDate: string,
    comments?: string,
  },
  createdAt: Date,
  updatedAt: Date,
  isDeleted: boolean,
}
```

---

## 🔑 Notas Importantes

1. **Tablet**: Va directo a Pantalla 3
2. **Computer**: Tiene OS selection opcional
3. **Merchandising**: Usa Description en lugar de Brand/Model
4. **Pantalla 3**: Común para todas las categorías
5. **Datos de Usuario**: Se obtienen del token (no del formulario)

---

**Próximo paso**: Implementación del backend.

