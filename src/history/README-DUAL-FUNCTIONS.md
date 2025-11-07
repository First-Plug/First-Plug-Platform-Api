# 🔄 Funciones Duales de History - Guía de Uso

Este documento explica cómo usar las funciones duales de history que mantienen compatibilidad entre registros legacy y nuevos.

## 📋 Funciones Disponibles

### **Assets History**

#### **Función Original** (`recordAssetHistory`)
```typescript
import { recordAssetHistory } from 'src/products/helpers/history.helper';

await recordAssetHistory(
  historyService,
  'create',
  userId,
  oldData,      // Datos pre-formateados
  newData,      // Datos pre-formateados
  'single-product'
);
```

**Cuándo usar:**
- ✅ Migraciones de datos legacy
- ✅ Compatibilidad hacia atrás
- ✅ Cuando ya tienes datos formateados
- ✅ Sistemas que no requieren location details

#### **Función Enhanced** (`recordEnhancedAssetHistory`)
```typescript
import { recordEnhancedAssetHistory } from 'src/products/helpers/history.helper';

await recordEnhancedAssetHistory(
  historyService,
  'relocate',
  userId,
  oldProduct,           // ProductDocument
  newProduct,           // ProductDocument
  'single-product',
  'AR',                 // newMemberCountry
  'US'                  // oldMemberCountry
);
```

**Cuándo usar:**
- ✅ Nuevos desarrollos
- ✅ Funcionalidades multi-office/warehouse
- ✅ Cuando necesitas location details
- ✅ Tracking de country codes

#### **Helper Automático** (`AssetHistoryHelper.auto`)
```typescript
import { AssetHistoryHelper } from 'src/products/helpers/history.helper';

await AssetHistoryHelper.auto(
  historyService,
  'update',
  userId,
  oldProduct,
  newProduct,
  'single-product',
  {
    preferEnhanced: true,
    memberCountry: 'AR'
  }
);
```

### **Shipments History**

#### **Función Original** (`recordShipmentHistory`)
```typescript
import { recordShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';

await recordShipmentHistory(
  historyService,
  'create',
  userId,
  oldShipment,
  newShipment,
  'shipment-merge'
);
```

#### **Función Enhanced** (`recordEnhancedShipmentHistory`)
```typescript
import { recordEnhancedShipmentHistory } from 'src/shipments/helpers/recordShipmentHistory';

await recordEnhancedShipmentHistory(
  historyService,
  'create',
  userId,
  null,
  newShipment,
  'single-product',
  {
    origin: {
      officeName: 'Buenos Aires Office',
      officeCountry: 'AR'
    },
    destination: {
      memberName: 'John Doe',
      memberCountry: 'US'
    }
  }
);
```

#### **Helper Automático** (`ShipmentHistoryHelper.auto`)
```typescript
import { ShipmentHistoryHelper } from 'src/shipments/helpers/recordShipmentHistory';

await ShipmentHistoryHelper.auto(
  historyService,
  'create',
  userId,
  null,
  newShipment,
  'single-product',
  {
    preferEnhanced: true,
    locationData: {
      origin: { officeName: 'Main Office', officeCountry: 'AR' },
      destination: { memberName: 'John Doe', memberCountry: 'US' }
    }
  }
);
```

## 🎯 Recomendaciones de Uso

### **Para Nuevos Desarrollos**
```typescript
// ✅ RECOMENDADO: Usar Enhanced functions
await recordEnhancedAssetHistory(/* ... */);
await recordEnhancedShipmentHistory(/* ... */);

// ✅ ALTERNATIVA: Usar helpers automáticos
await AssetHistoryHelper.auto(/* ... */, { preferEnhanced: true });
await ShipmentHistoryHelper.auto(/* ... */, { preferEnhanced: true });
```

### **Para Compatibilidad Legacy**
```typescript
// ✅ RECOMENDADO: Usar funciones originales
await recordAssetHistory(/* ... */);
await recordShipmentHistory(/* ... */);

// ✅ ALTERNATIVA: Usar helpers sin preferencia Enhanced
await AssetHistoryHelper.auto(/* ... */); // Sin preferEnhanced
```

### **Para Migración Gradual**
```typescript
// ✅ Empezar con helper automático
const useEnhanced = shouldUseEnhancedFeatures(); // Tu lógica de decisión

await AssetHistoryHelper.auto(
  historyService,
  actionType,
  userId,
  oldProduct,
  newProduct,
  context,
  {
    preferEnhanced: useEnhanced,
    memberCountry: useEnhanced ? getMemberCountry() : undefined
  }
);
```

## ⚠️ Consideraciones Importantes

### **Compatibilidad**
- Las funciones originales **SIEMPRE** funcionarán con registros legacy
- Las funciones Enhanced generan registros que se normalizan automáticamente
- El `HistoryService` detecta automáticamente registros legacy vs nuevos

### **Performance**
- Funciones originales: Más rápidas (menos procesamiento)
- Funciones Enhanced: Más lentas (más formateo y validaciones)
- Helpers automáticos: Performance variable según la decisión

### **Datos Requeridos**
- **Original**: Requiere datos pre-formateados (`oldData`, `newData`)
- **Enhanced**: Requiere `ProductDocument` o `ShipmentDocument` completos
- **Auto**: Se adapta a lo que tengas disponible

## 🔧 Troubleshooting

### **Error: "Cannot format undefined product"**
```typescript
// ❌ PROBLEMA
await recordEnhancedAssetHistory(historyService, 'create', userId, null, undefined);

// ✅ SOLUCIÓN
if (newProduct) {
  await recordEnhancedAssetHistory(historyService, 'create', userId, null, newProduct);
}
```

### **Error: "Invalid ObjectId for team population"**
```typescript
// ✅ SOLUCIÓN: El HistoryService ya maneja esto automáticamente
// Los errores se logean como warnings, no rompen la funcionalidad
```

### **Registros legacy no se muestran correctamente**
```typescript
// ✅ SOLUCIÓN: Verificar que AssetHistoryCompatibility esté funcionando
import { AssetHistoryCompatibility } from 'src/history/helpers/asset-compatibility.helper';

const needsNormalization = AssetHistoryCompatibility.needsNormalization(record);
console.log('Needs normalization:', needsNormalization);
```

## 📊 Migración Recomendada

1. **Fase 1**: Usar helpers automáticos sin `preferEnhanced`
2. **Fase 2**: Gradualmente activar `preferEnhanced` en nuevas funcionalidades
3. **Fase 3**: Migrar completamente a funciones Enhanced
4. **Fase 4**: (Opcional) Deprecar funciones originales en el futuro
