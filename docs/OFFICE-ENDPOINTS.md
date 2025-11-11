CRUD office

## GET

http://localhost:3001/api/offices

trae esta respuesta
[
{
"_id": "68ee86ccf8b8458b41565da2",
"name": "Oficina Córdoba Centro",
"isDefault": true,
"email": "cordoba@empresa.com",
"phone": "+543514567891",
"country": "AR",
"state": "Córdoba",
"city": "Córdoba Capital",
"zipCode": "5000",
"address": "Av. Colón 123",
"apartment": "",
"tenantId": "67e6cb38b4c6d3af1edd99ef",
"isActive": true,
"isDeleted": false,
"deletedAt": null,
"createdAt": "2025-10-14T17:22:20.285Z",
"updatedAt": "2025-10-14T17:25:20.885Z",
"__v": 0,
"hasAssignedProducts": false,
"hasActiveShipments": false
},
{
"deletedAt": null,
"_id": "687e7e601d43bf08d8f26046",
"name": "Oficina Principal",
"email": "office@mechi-test.com",
"phone": "+5411",
"country": "GT",
"city": "ciudad guatemala",
"state": "capital federal",
"zipCode": "1234",
"address": "buenos aires st 456",
"apartment": "",
"tenantId": "67e6cb38b4c6d3af1edd99ef",
"isDefault": false,
"isActive": true,
"isDeleted": false,
"createdAt": "2025-07-21T17:52:32.199Z",
"updatedAt": "2025-10-14T17:25:20.821Z",
"hasAssignedProducts": true,
"hasActiveShipments": true
}
]

### POST

http://localhost:3001/api/offices

Payload
{
"name": "Oficina principal",
"country": "AR",
"state": "Córdoba",
"city": "Córdoba",
"zipCode": "5000",
"address": "Av. Colón 123",
"email": "cordoba@empresa.com",
"phone": "+543514567890"
}

prohibicion, el nombre no puede estar repetido

## PATCH

http://localhost:3001/api/offices/{office id}

Payload
{
"name": "Oficina Córdoba Centro",
"city": "Córdoba Capital",
"phone": "+543514567891"
}

## DELETE

http://localhost:3001/api/offices/{office id}

restriccion
{
"message": "No se puede eliminar la oficina porque tiene productos asignados.",
"error": "Bad Request",
"statusCode": 400
}

{
"message": "Cannot delete default office. Please set another office as default first.",
"error": "Bad Request",
"statusCode": 400
}

## PATCH office toggle default

http://localhost:3001/api/offices/{office id}/toggle-default

Payload
{
"name": "Oficina Córdoba Centro",
"city": "Córdoba Capital",
"phone": "+543514567891"
}
