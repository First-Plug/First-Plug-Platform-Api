# 📊 08 - Análisis de Schema - Datos de Usuario y Tenant

## ℹ️ Aclaración Importante

La información del usuario y tenant que se guarda en el Quote schema se obtiene del usuario logueado (token/session):

- **userEmail**: Del token JWT
- **userName**: Del token JWT
- **userPhone**: Del token JWT
- **tenantId**: Del token JWT
- **tenantName**: Del token JWT

Esta información se envía automáticamente en el payload del POST, no es completada por el usuario en el formulario.

---

## 🔍 Patrones Encontrados en el Proyecto

### 1. **Shipment Schema** (Referencia Principal)

```typescript
@Prop({ type: String, required: true })
tenant: string;  // ✅ Guarda NOMBRE del tenant, no ID

@Prop({
  type: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    personalEmail: String,
    // ... más datos desnormalizados
  }
})
member_data: MemberData;  // ✅ Guarda datos COMPLETOS del miembro
```

**Patrón**: Desnormaliza datos del miembro para no tener que hacer lookups

---

### 2. **GlobalProduct Schema** (Referencia Secundaria)

```typescript
@Prop({ type: MongooseSchema.Types.ObjectId, required: true })
tenantId: MongooseSchema.Types.ObjectId;  // ✅ Guarda ID

@Prop({ required: true })
tenantName: string;  // ✅ También guarda nombre

@Prop({ type: AssignedMemberData, required: false })
memberData?: {
  memberId: ObjectId;
  memberEmail: string;
  memberName: string;
  assignedAt: Date;
};  // ✅ Desnormaliza datos del miembro
```

**Patrón**: Guarda AMBOS (ID + nombre) para flexibilidad

---

### 3. **Product Schema** (Referencia Terciaria)

```typescript
@Prop({ type: String, required: false })
createdBy?: string;  // ✅ Guarda EMAIL del usuario que creó

@Prop({
  type: {
    warehouseId: ObjectId,
    warehouseCountryCode: String,
    warehouseName: String,
  }
})
fpWarehouse?: FpWarehouseData;  // ✅ Desnormaliza datos del warehouse
```

**Patrón**: Guarda email del usuario, no ID

---

## 📋 Recomendación para Quote Schema

### Opción A - Mínima (Solo lo necesario)

```typescript
@Prop({ type: Types.ObjectId, required: true })
tenantId: Types.ObjectId;  // ✅ ID del tenant

@Prop({ type: String, required: true })
userEmail: string;  // ✅ Email del usuario que pidió

@Prop({ type: String, required: false })
userName?: string;  // ✅ Nombre del usuario (opcional)

@Prop({ type: String, required: false })
userPhone?: string;  // ✅ Teléfono del usuario (opcional)

@Prop({ type: String, required: false })
companyName?: string;  // ✅ Nombre de la empresa (del tenant)
```

**Ventajas**:

- ✅ Consistente con Shipment (guarda email, no ID)
- ✅ Consistente con GlobalProduct (guarda ID + nombre)
- ✅ Datos suficientes para Slack
- ✅ No necesita lookup para mostrar en tabla

**Desventajas**:

- ❌ Si el usuario cambia nombre/teléfono, el quote queda con datos viejos
- ❌ Si el tenant cambia nombre, el quote queda con datos viejos

---

### Opción B - Completa (Desnormalización Total)

```typescript
@Prop({ type: Types.ObjectId, required: true })
tenantId: Types.ObjectId;

@Prop({ type: String, required: true })
tenantName: string;  // ✅ Nombre del tenant

@Prop({
  type: {
    email: String,
    firstName: String,
    lastName: String,
    phone: String,
    country: String,
    city: String,
  }
})
userData?: UserData;  // ✅ Datos completos del usuario
```

**Ventajas**:

- ✅ Datos históricos preservados
- ✅ No necesita lookup para mostrar
- ✅ Consistente con Shipment

**Desventajas**:

- ❌ Más campos en el documento
- ❌ Duplicación de datos

---

## 🎯 Recomendación Final

**Usar Opción A (Mínima)** porque:

1. **Consistencia**: Shipment usa email, no ID
2. **Simplicidad**: Solo lo necesario para Slack
3. **MVP**: No necesitamos datos históricos en esta fase
4. **Escalabilidad**: Fácil agregar más campos después

### Schema Recomendado

```typescript
@Schema({ timestamps: true })
export class Quote {
  _id: Types.ObjectId;

  // === TENANT ===
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: String, required: false })
  tenantName?: string; // Para Slack

  // === USUARIO ===
  @Prop({ type: String, required: true, index: true })
  userEmail: string; // Email del usuario que pidió

  @Prop({ type: String, required: false })
  userName?: string; // firstName + lastName

  @Prop({ type: String, required: false })
  userPhone?: string;

  // === SOLICITUD ===
  @Prop({
    type: String,
    enum: [
      'Comprar productos',
      'Logística',
      'Servicio técnico',
      'Recompra de equipos',
      'Asesoramiento',
    ],
    required: true,
    index: true,
  })
  requestType: string;

  @Prop({ type: Object, required: true })
  requestData: Record<string, any>; // Validado con Zod

  // === AUDITORÍA ===
  @Prop({ default: false })
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🚀 Próximos Pasos

1. Confirmar si esta estructura es correcta
2. Crear el archivo `quote.schema.ts`
3. Crear validaciones Zod
4. Implementar servicio
