# 📊 13 - Mapeo de Campos por Categoría (Mock vs Sistema)

## 🎯 Estructura del Sistema

El sistema usa un modelo de **atributos dinámicos** por categoría:

```typescript
CATEGORY_KEYS: Record<Category, AttributeKey[]> = {
  Merchandising: ['color'],
  Computer: ['brand', 'model', 'color', 'screen', 'keyboardLanguage', 'processor', 'ram', 'storage', 'gpu'],
  Monitor: ['brand', 'model', 'screen', 'color'],
  Audio: ['brand', 'model', 'color'],
  Peripherals: ['brand', 'model', 'color', 'keyboardLanguage'],
  Other: ['brand', 'color', 'model'],
}
```

---

## 📋 Mapeo: Mock → Estructura de Quote

### Computer

**Pantalla 2a: OS Selection (Opcional)**
- macOS, Windows, Linux → Se guarda en `attributes.keyboardLanguage` o nuevo campo

**Pantalla 2b: Campos Específicos**
| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Processor | attributes.processor | dropdown | ✅ |
| RAM | attributes.ram | dropdown | ✅ |
| Storage | attributes.storage | dropdown | ✅ |
| Screen Size | attributes.screen | dropdown | ✅ |
| Other Specifications | additionalInfo | textarea | ❌ |
| Extend Warranty | warranty | checkbox | ❌ |
| Device Enrollment | deviceEnrollment | checkbox | ❌ |

---

### Monitor

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Screen Size | attributes.screen | dropdown | ✅ |
| Resolution | attributes.screen | dropdown | ✅ |
| Additional Specs | additionalInfo | textarea | ❌ |

---

### Audio

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Specifications | additionalInfo | textarea | ❌ |

---

### Peripherals

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Type | attributes.keyboardLanguage | dropdown | ⚠️ |
| Additional Info | additionalInfo | textarea | ❌ |

---

### Merchandising

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Description | name | string | ✅ |
| Additional Requirements | additionalInfo | textarea | ❌ |

---

### Phone (Nuevo)

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Additional Info | additionalInfo | textarea | ❌ |

---

### Tablet (Nuevo)

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Brand | attributes.brand | dropdown | ✅ |
| Model | attributes.model | string | ✅ |
| Additional Info | additionalInfo | textarea | ❌ |

---

### Other

| Mock Field | Sistema | Tipo | Obligatorio |
|------------|---------|------|-------------|
| Quantity | quantity | number | ✅ |
| Description | name | string | ✅ |
| Additional Info | additionalInfo | textarea | ❌ |

---

## 🔑 Observaciones

1. **Nuevas Categorías**: Phone y Tablet no existen en el sistema actual
2. **OS Selection**: Computer tiene selección de OS (macOS, Windows, Linux)
3. **Checkboxes**: Warranty y Device Enrollment son específicos de Computer
4. **Merchandising**: Usa `name` en lugar de `brand`/`model`
5. **Pantalla 3**: Común para todas (Country, City, Delivery Date, Comments)

---

**Próximo paso**: Actualizar documentos con esta estructura.

