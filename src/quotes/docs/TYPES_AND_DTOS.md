# 📝 QUOTES - Types, Interfaces y DTOs

## 🔷 TypeScript Interfaces

```typescript
export interface ComputerItem {
  category: 'Computer';
  os?: 'macOS' | 'Windows' | 'Linux';
  quantity: number; // ✅ OBLIGATORIO
  brand?: string[];
  model?: string[];
  processor?: string[];
  ram?: string[];
  storage?: string[];
  screenSize?: string[];
  otherSpecifications?: string;
  extendedWarranty?: boolean;
  extendedWarrantyYears?: number; // ✅ Si extendedWarranty === true
  deviceEnrollment?: boolean;
  country: string; // ✅ OBLIGATORIO
  city?: string;
  deliveryDate?: Date;
  comments?: string;
}

export interface Quote {
  _id: ObjectId;
  requestId: string; // QR-{tenantName}-{autoIncrement}
  tenantId: ObjectId;
  tenantName: string;
  userEmail: string;
  userName?: string;
  requestType: 'Comprar productos';
  status: 'Requested'; // Estado de la cotización (auto-seteado en creación)
  products: ComputerItem[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 📦 DTOs (Data Transfer Objects)

```typescript
export class CreateQuoteDTO {
  products: CreateComputerItemDTO[];
}

export class CreateComputerItemDTO {
  category: 'Computer';
  os?: 'macOS' | 'Windows' | 'Linux';
  quantity: number;
  brand?: string[];
  model?: string[];
  processor?: string[];
  ram?: string[];
  storage?: string[];
  screenSize?: string[];
  otherSpecifications?: string;
  extendedWarranty?: boolean;
  extendedWarrantyYears?: number;
  deviceEnrollment?: boolean;
  country: string;
  city?: string;
  deliveryDate?: Date;
  comments?: string;
}

export class QuoteResponseDTO {
  _id: string;
  requestId: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  userName?: string;
  requestType: 'Comprar productos';
  status: 'Requested'; // Estado de la cotización (auto-seteado en creación)
  products: ComputerItemResponseDTO[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class QuoteTableDTO {
  _id: string;
  requestId: string;
  userName?: string;
  userEmail: string;
  productCount: number;
  totalQuantity: number;
  quoteStatus: 'Requested'; // Estado de la cotización
  isActive: boolean; // true = activa, false = cancelada
  createdAt: Date;
  updatedAt: Date;
}

export class UpdateQuoteDTO {
  products?: CreateComputerItemDTO[];
  isDeleted?: boolean;
}
```

---

## 🔗 Relación entre Tipos

```
Frontend (Lovable)
    ↓
CreateComputerItemDTO (Validado con Zod)
    ↓
ComputerItem (Guardado en MongoDB)
    ↓
QuoteResponseDTO (Enviado al frontend)
```

---

## 📁 Ubicación en Proyecto

```
src/quotes/
├── interfaces/
│   └── quote.interface.ts
├── dto/
│   ├── create-quote.dto.ts
│   ├── update-quote.dto.ts
│   ├── quote-response.dto.ts
│   └── quote-table.dto.ts
└── schemas/
    └── quote.schema.ts
```
