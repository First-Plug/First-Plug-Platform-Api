# 🔢 Patrón de Contador Incremental - Quotes Reutiliza ShipmentMetadata

## 📊 Estructura de la Colección

### **Colección: shipmentmetadata (REUTILIZADA)**

```json
[
  {
    "_id": "orderCounter",
    "lastOrderNumber": 1000
  },
  {
    "_id": "quote_counter",
    "lastQuoteNumber": 500
  }
]
```

**Una sola colección para ambos contadores.**

---

## 🔧 Implementación

### **Shipments (Existente)**

```typescript
const ShipmentMetadataModel = connection.model(
  'ShipmentMetadata',
  ShipmentMetadataSchema,
  'shipmentmetadata',
);

const existing = await ShipmentMetadataModel.findById('orderCounter');
const initial = existing?.lastOrderNumber || 0;
const generator = new OrderNumberGenerator(initial);

const nextNumber = generator.getNext(); // 1001
await this.finalizeOrderNumber(connection, generator.getCurrent());
```

### **Quotes (Nuevo - Reutiliza Colección)**

```typescript
const MetadataModel = connection.model(
  'ShipmentMetadata',
  ShipmentMetadataSchema,
  'shipmentmetadata',
);

const metadata = await MetadataModel.findByIdAndUpdate(
  'quote_counter', // ← Registro diferente del orderCounter
  { $inc: { lastQuoteNumber: 1 } },
  { new: true, upsert: true },
);
const nextNumber = metadata.lastQuoteNumber; // 501
```

---

## 🎯 ¿Por Qué Reutilizar shipmentmetadata?

### **Opción 1: Colección Separada (quote_metadata)**

```
❌ Crea una colección nueva innecesaria
❌ Duplica la estructura de metadatos
❌ Más colecciones que mantener
```

### **Opción 2: Reutilizar shipmentmetadata ✅**

```
✅ Una sola colección para todos los metadatos
✅ Patrón ya establecido en el proyecto
✅ Menos colecciones que mantener
✅ Fácil de escalar (agregar más contadores)
```

---

## 📈 Estructura de Datos

### **shipmentmetadata Collection (Actual)**

```json
{
  "_id": "orderCounter",
  "lastOrderNumber": 1000
}
```

### **shipmentmetadata Collection (Con Quotes)**

```json
[
  {
    "_id": "orderCounter",
    "lastOrderNumber": 1000
  },
  {
    "_id": "quote_counter",
    "lastQuoteNumber": 500
  }
]
```

**Futuro (si necesitas más metadatos):**

```json
[
  {
    "_id": "orderCounter",
    "lastOrderNumber": 1000
  },
  {
    "_id": "quote_counter",
    "lastQuoteNumber": 500
  },
  {
    "_id": "invoice_counter",
    "lastInvoiceNumber": 200
  }
]
```

---

## 🔐 Garantías de Atomicidad

### **MongoDB findByIdAndUpdate**

```typescript
// Operación ATÓMICA - No hay race conditions
const metadata = await MetadataModel.findByIdAndUpdate(
  'quote_counter',
  { $inc: { lastQuoteNumber: 1 } }, // Incrementa de forma atómica
  { new: true, upsert: true }, // Retorna el documento actualizado
);
```

**¿Por qué es seguro?**

- ✅ `findByIdAndUpdate` es una operación atómica en MongoDB
- ✅ Incluso con 1000 requests simultáneos, cada uno obtiene un número único
- ✅ No hay race conditions
- ✅ El contador nunca se repite

---

## 📊 Comparación de Métodos

| Aspecto           | Shipments                    | Quotes             |
| ----------------- | ---------------------------- | ------------------ |
| **Colección**     | `shipmentmetadata`           | `quote_metadata`   |
| **Campo**         | `lastOrderNumber`            | `lastQuoteNumber`  |
| **Generador**     | `OrderNumberGenerator` class | Directo con `$inc` |
| **Atomicidad**    | ✅ Sí                        | ✅ Sí              |
| **Escalabilidad** | ✅ Buena                     | ✅ Mejor           |

---

## 🚀 Ventajas del Patrón Quotes

**Más simple que Shipments:**

- No necesita clase `OrderNumberGenerator`
- Usa directamente `$inc` de MongoDB
- Menos código, misma garantía

**Más escalable:**

- Fácil agregar más metadatos
- Una colección para todo
- Patrón consistente

---

## 📝 Ejemplo de Uso

```typescript
// Crear quote
const requestId = await this.generateRequestId(QuoteModel, tenantName);
// Resultado: "QR-mechi_test-000001"

// Crear otro quote
const requestId = await this.generateRequestId(QuoteModel, tenantName);
// Resultado: "QR-mechi_test-000002"

// Borrar quote #1
await quoteModel.updateOne({ _id: id }, { isDeleted: true });

// Crear nuevo quote
const requestId = await this.generateRequestId(QuoteModel, tenantName);
// Resultado: "QR-mechi_test-000003" ✅ (nunca repite #1)
```

---

## 🔄 Migración Futura

Si en el futuro necesitas cambiar el patrón:

1. Ambos usan `findByIdAndUpdate` (compatible)
2. Solo cambiarías el nombre del campo
3. Sin impacto en la lógica de negocio
