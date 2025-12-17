# 📋 Fase 3: Validación Zod en Controller

## 🎯 Objetivo

Aplicar validaciones Zod en los endpoints del controller para garantizar que los datos recibidos sean válidos antes de procesarlos.

---

## ✅ Estado Actual

### **Validaciones Zod (YA EXISTEN)**

- ✅ `CreateQuoteSchema` - Valida estructura de productos
- ✅ `UpdateQuoteSchema` - Valida actualización de productos
- ✅ `ComputerItemSchema` - Valida cada producto individual
- ✅ `ProductDataSchema` - Valida datos del producto

### **Controller (SIN VALIDACIÓN)**

- ❌ POST /quotes - No valida CreateQuoteDto
- ❌ PATCH /quotes/:id - No valida UpdateQuoteDto
- ❌ GET /quotes/:id - No valida ID format
- ❌ DELETE /quotes/:id - No valida ID format

---

## 📝 Tareas de Fase 3

### **Tarea 1: Validar POST /quotes**

```typescript
@Post()
async create(
  @Body() createQuoteDto: CreateQuoteDto,
  @Req() req: any,
): Promise<QuoteResponseDto> {
  // ✅ AGREGAR: Validar con Zod
  const validated = CreateQuoteSchema.parse(createQuoteDto);

  // Procesar con datos validados
  const quote = await this.quotesCoordinator.createQuoteWithCoordination(
    validated,
    ...
  );
  return this.mapToResponseDto(quote);
}
```

### **Tarea 2: Validar PATCH /quotes/:id**

```typescript
@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() updateQuoteDto: UpdateQuoteDto,
  @Req() req: any,
): Promise<QuoteResponseDto> {
  // ✅ AGREGAR: Validar ID
  this.validateObjectId(id);

  // ✅ AGREGAR: Validar DTO
  const validated = UpdateQuoteSchema.parse(updateQuoteDto);

  const quote = await this.quotesCoordinator.quotesService.update(
    id,
    validated,
    ...
  );
  return this.mapToResponseDto(quote);
}
```

### **Tarea 3: Validar GET /quotes/:id**

```typescript
@Get(':id')
async findById(
  @Param('id') id: string,
  @Req() req: any,
): Promise<QuoteResponseDto> {
  // ✅ AGREGAR: Validar ID format
  this.validateObjectId(id);

  const quote = await this.quotesCoordinator.quotesService.findById(
    id,
    ...
  );
  return this.mapToResponseDto(quote);
}
```

### **Tarea 4: Validar DELETE /quotes/:id**

```typescript
@Delete(':id')
async delete(
  @Param('id') id: string,
  @Req() req: any,
): Promise<void> {
  // ✅ AGREGAR: Validar ID format
  this.validateObjectId(id);

  await this.quotesCoordinator.cancelQuoteWithCoordination(
    id,
    ...
  );
}
```

### **Tarea 5: Agregar Método Helper**

```typescript
private validateObjectId(id: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(`Invalid ID format: ${id}`);
  }
}
```

### **Tarea 6: Manejo de Errores Zod**

```typescript
// Crear un pipe o interceptor para manejar errores de Zod
// Convertir ZodError a respuesta HTTP clara
```

---

## 🔧 Cambios Necesarios

### **Imports a Agregar**

```typescript
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateQuoteSchema, UpdateQuoteSchema } from './validations';
import { ZodError } from 'zod';
```

### **Manejo de Errores**

```typescript
try {
  const validated = CreateQuoteSchema.parse(createQuoteDto);
  // Procesar...
} catch (error) {
  if (error instanceof ZodError) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  throw error;
}
```

---

## 📊 Checklist

- [x] Tarea 1: Validar POST /quotes
- [x] Tarea 2: Validar PATCH /quotes/:id
- [x] Tarea 3: Validar GET /quotes/:id
- [x] Tarea 4: Validar DELETE /quotes/:id
- [x] Tarea 5: Agregar método validateObjectId
- [x] Tarea 6: Manejo de errores Zod
- [ ] Tests: Verificar validaciones funcionan
- [ ] Documentación: Actualizar ejemplos

---

## 🚀 Próximos Pasos Después de Fase 3

1. **Fase 4: Tests Unitarios**

   - Tests para validaciones
   - Tests para endpoints
   - Tests para manejo de errores

2. **Fase 5: Documentación Swagger**

   - Decoradores @ApiOperation
   - Decoradores @ApiResponse
   - Ejemplos de requests/responses

3. **Fase 6: Mejoras Futuras**
   - Filtros avanzados
   - Paginación
   - Búsqueda por requestId
