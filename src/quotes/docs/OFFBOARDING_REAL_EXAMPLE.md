# Offboarding Service - Real Example

## Caso Real: Offboarding de Almudena Cerezo

**Contexto:** Almudena Cerezo (Brand Manager) está siendo offboardeada. Tiene 4 productos asignados que necesitan ser distribuidos:

- Backpack (Merchandising) → No recuperable, se descarta
- Monitor LG Smart Monitor → Se reasigna a Evelio Farias
- iPhone 15 Pro → Se envía a Oficina Principal (Guatemala)
- Logitech Mouse → Se envía a Warehouse

```json
{
  "services": [
    {
      "serviceCategory": "Offboarding",
      "originMember": {
        "memberId": "686beb6f9c7a0951bbec40df",
        "firstName": "Almudena",
        "lastName": "Cerezo",
        "email": "almudenacerezo@work.com",
        "countryCode": "UY"
      },
      "isSensitiveSituation": false,
      "employeeKnows": true,
      "desirablePickupDate": "2025-01-15",
      "products": [
        {
          "productId": "686beb939c7a0951bbec4461",
          "productSnapshot": {
            "category": "Monitor",
            "brand": "LG",
            "model": "Smart Monitor",
            "serialNumber": "LG-SM-2024-001",
            "location": "Employee",
            "assignedTo": "Almudena Cerezo",
            "assignedEmail": "almudenacerezo@work.com",
            "countryCode": "UY"
          },
          "destination": {
            "type": "Member",
            "memberId": "686beb6f9c7a0951bbec40de",
            "assignedMember": "Evelio Farias",
            "assignedEmail": "eveliofarias@work.com",
            "countryCode": "ES"
          }
        },
        {
          "productId": "686beb939c7a0951bbec43da",
          "productSnapshot": {
            "category": "Other",
            "brand": "Apple",
            "model": "iPhone 15 Pro",
            "serialNumber": "IPHONE-15-PRO-001",
            "location": "Employee",
            "assignedTo": "Almudena Cerezo",
            "assignedEmail": "almudenacerezo@work.com",
            "countryCode": "UY"
          },
          "destination": {
            "type": "Office",
            "officeId": "687e7e601d43bf08d8f26046",
            "officeName": "Oficina Principal",
            "countryCode": "GT"
          }
        },
        {
          "productId": "686beb939c7a0951bbec4483",
          "productSnapshot": {
            "category": "Peripherals",
            "brand": "Logitech",
            "model": "M240 Mouse Bluetooth",
            "serialNumber": "LOG-MOUSE-2022-001",
            "location": "Employee",
            "assignedTo": "Almudena Cerezo",
            "assignedEmail": "almudenacerezo@work.com",
            "countryCode": "UY"
          },
          "destination": {
            "type": "Warehouse",
            "warehouseId": "warehouse-uy-001",
            "warehouseName": "Uruguay Central Warehouse",
            "countryCode": "UY"
          }
        }
      ],
      "additionalDetails": "Almudena Cerezo está siendo offboardeada. Monitor reasignado a Evelio Farias en Madrid. iPhone enviado a Oficina Principal en Guatemala. Mouse enviado a warehouse en Uruguay. Backpack (no recuperable) descartado."
    }
  ]
}
```

## Detalles del Payload

### Origin Member (Almudena Cerezo)

- **ID:** 686beb6f9c7a0951bbec40df
- **Nombre:** Almudena Cerezo
- **Email:** almudenacerezo@work.com
- **País:** UY (Uruguay)
- **Posición:** Brand Manager

### Productos a Offboardear (3 de 4)

#### 1. Monitor LG → Evelio Farias (Member)

- **Producto:** LG Smart Monitor
- **ID:** 686beb939c7a0951bbec4461
- **Estado:** In Transit
- **Destino:** Evelio Farias (eveliofarias@work.com) en Madrid, España
- **Razón:** Reasignación a otro miembro del equipo

#### 2. iPhone 15 Pro → Oficina Principal (Office)

- **Producto:** Apple iPhone 15 Pro
- **ID:** 686beb939c7a0951bbec43da
- **Estado:** In Transit
- **Destino:** Oficina Principal en Guatemala
- **Razón:** Centralizar equipos en oficina

#### 3. Logitech Mouse → Warehouse (Warehouse)

- **Producto:** Logitech M240 Mouse Bluetooth
- **ID:** 686beb939c7a0951bbec4483
- **Estado:** In Transit - Missing Data
- **Destino:** Uruguay Central Warehouse
- **Razón:** Almacenamiento temporal

### Producto No Incluido

- **Backpack (Merchandising):** No recuperable, se descarta (no incluido en el payload)

## Notas Importantes

1. **isSensitiveSituation:** `false` - Offboarding normal, no es una situación sensible
2. **employeeKnows:** `true` - Almudena está informada del offboarding
3. **Distribución de Productos:**
   - 1 producto a otro member (reasignación)
   - 1 producto a oficina (centralización)
   - 1 producto a warehouse (almacenamiento)
   - 1 producto descartado (no recuperable)

## Validaciones Esperadas

✅ Email válido para todos los miembros
✅ Country codes válidos (UY, ES, GT)
✅ Mínimo 1 producto (tenemos 3)
✅ Destino requerido por producto (todos tienen)
✅ Additional details dentro del límite (1000 caracteres)
