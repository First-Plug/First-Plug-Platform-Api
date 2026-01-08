# 🎨 Offboarding Service - Frontend

## 📌 ¿Qué Necesita Hacer el Frontend?

Crear un **nuevo flujo de servicio** específico para Offboarding que es diferente a los otros servicios (IT Support, Cleaning, Storage).

---

## 🔄 Flujo en 7 Pasos

### 1️⃣ Seleccionar Servicio

```
Dropdown: IT Support | Cleaning | Storage | Offboarding ← NUEVO
```

### 2️⃣ Seleccionar Member Origen (ÚNICO EN OFFBOARDING)

```
Dropdown con búsqueda de members
Usuario selecciona member a offboardear
```

### 3️⃣ Cargar Productos Automáticamente

```
API: GET /members/{memberId}/products?recoverable=true
Mostrar lista de productos cargados automáticamente
```

### 4️⃣ Especificar Destino por Producto

```
Para CADA producto:
- Mostrar datos actuales (category, brand, model, serial, location, assignedTo, email, country)
- Dropdown: Seleccionar destino (Member/Office/Warehouse)
- Mostrar detalles del destino según tipo
```

#### Si destino = "Member"

```
- Dropdown: Seleccionar member destino
- Mostrar: Nombre, Email, País
```

#### Si destino = "Office"

```
- Dropdown: Seleccionar office destino
- Mostrar: Nombre, País
```

#### Si destino = "Warehouse"

```
- Mostrar: Warehouse automático del país origen
- Mostrar: Nombre, País
- Nota: "Warehouse del país de origen"
```

### 5️⃣ Consultar Situación Sensible y Conocimiento del Empleado

```
Dos preguntas OBLIGATORIAS:

1. ¿Es una situación sensible?
   - Checkbox: Sí / No
   - Ejemplo: Despido, reducción de personal, cambio de rol

2. ¿El empleado sabe que se va?
   - Checkbox: Sí / No
   - Ejemplo: Si ya fue comunicado o es sorpresa

Guardar como:
- isSensitiveSituation: boolean
- employeeKnows: boolean
```

### 6️⃣ Detalles Adicionales (Opcional)

```
Textarea: Detalles adicionales (máx 1000 caracteres)
Ejemplo: "Equipo dañado, requiere reparación antes de envío"
```

### 7️⃣ Validar

```
✓ Member origen seleccionado
✓ Mínimo 1 producto
✓ Cada producto tiene destino
✓ Destinos válidos
✓ isSensitiveSituation: respondido
✓ employeeKnows: respondido
✓ additionalDetails: máximo 1000 caracteres
```

### 8️⃣ Enviar Payload

```
POST /quotes con offboarding service
```

---

## 📤 Payload a Enviar

```json
{
  "serviceCategory": "Offboarding",
  "originMember": {
    "memberId": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "countryCode": "US"
  },
  "isSensitiveSituation": true,
  "employeeKnows": false,
  "products": [
    {
      "productId": "507f1f77bcf86cd799439012",
      "productSnapshot": {
        "category": "Laptop",
        "brand": "Apple",
        "model": "MacBook Pro",
        "serialNumber": "ABC123456",
        "location": "Employee",
        "assignedTo": "John Doe",
        "assignedEmail": "john.doe@company.com",
        "countryCode": "US"
      },
      "destination": {
        "type": "Member",
        "memberId": "507f1f77bcf86cd799439013",
        "assignedMember": "Jane Smith",
        "assignedEmail": "jane.smith@company.com",
        "countryCode": "US"
      }
    },
    {
      "productId": "507f1f77bcf86cd799439014",
      "productSnapshot": {
        "category": "Monitor",
        "brand": "Dell",
        "model": "U2720Q",
        "serialNumber": "DEF789012",
        "location": "Employee",
        "assignedTo": "John Doe",
        "assignedEmail": "john.doe@company.com",
        "countryCode": "US"
      },
      "destination": {
        "type": "Office",
        "officeId": "507f1f77bcf86cd799439015",
        "officeName": "New York Office",
        "countryCode": "US"
      }
    }
  ],
  "additionalDetails": "Equipo en buen estado, listo para reasignación"
}
```

---

## 🔗 APIs Necesarias

| Endpoint                                  | Método | Descripción                  |
| ----------------------------------------- | ------ | ---------------------------- |
| `/members/{id}/products?recoverable=true` | GET    | Obtener productos del member |
| `/members?search=...`                     | GET    | Buscar members (destino)     |
| `/offices?search=...`                     | GET    | Buscar offices (destino)     |
| `/warehouses?countryCode=...`             | GET    | Obtener warehouse por país   |

---

## 🎨 Componentes a Crear

1. **OffboardingServiceForm** - Formulario principal
2. **MemberSelector** - Selector de member origen
3. **ProductList** - Lista de productos cargados
4. **DestinationSelector** - Selector de destino por producto
5. **DestinationDetails** - Mostrar detalles dinámicos del destino
6. **AdditionalDetailsInput** - Input para detalles adicionales
7. **ReviewSummary** - Resumen antes de enviar

---

## 💡 Notas Importantes

- **Location origen**: Siempre "Employee" (del member seleccionado)
- **Location destino**: Varía según tipo (Member/Office/Warehouse)
- **Warehouse**: Automático, buscar warehouse del país origen
- **Recoverable**: Solo mostrar productos con recoverable=true
- **Country code**: Mostrar siempre para referencia

---

## ✅ Checklist para Frontend

- [ ] Agregar "Offboarding" al dropdown de servicios
- [ ] Crear componente MemberSelector
- [ ] Crear API call para obtener productos
- [ ] Crear componente ProductList
- [ ] Crear componente DestinationSelector
- [ ] Crear componente DestinationDetails (dinámico)
- [ ] Crear componente SensitiveSituationQuestion (checkbox: isSensitiveSituation)
- [ ] Crear componente EmployeeKnowsQuestion (checkbox: employeeKnows)
- [ ] Crear componente AdditionalDetailsInput
- [ ] Crear validaciones (incluyendo isSensitiveSituation y employeeKnows)
- [ ] Crear componente ReviewSummary
- [ ] Integrar con POST /quotes
- [ ] Testear flujo completo
