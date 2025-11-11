# Changelog - Global Product Synchronization Fixes

## 📅 Date: 2025-09-30 - 2025-10-01

## 🎯 Summary

Fixed critical issues with global product synchronization system, including product duplication, missing memberData, incorrect warehouse assignment, and tenantId schema type mismatch.

---

## 🐛 Issues Fixed

### 1. Product Duplication in Global Collection ✅

**Problem:**

- When assigning a product from "Our office" to a member, two documents were created in the global collection
- Both had the same `originalProductId` but different `_id` values
- One with `sourceCollection: "products"`, another with `sourceCollection: "members"`

**Root Cause:**

- Existing documents had `tenantId` as **String**
- New sync code used `tenantId` as **ObjectId**
- Query didn't match existing document, created duplicate instead of updating

**Solution:**

- Enhanced tenantId resolution logic to always convert to ObjectId
- Added proper upsert strategy with correct query keys
- Created cleanup script to fix existing duplicates

**Files Changed:**

- `src/products/services/global-product-sync.service.ts`

---

### 2. Missing memberData in Global Collection ✅

**Problem:**

- When assigning a product to a member, `memberData` was not being saved in the global collection
- The field was passed correctly but not persisted to MongoDB

**Root Cause:**

- Schema for `AssignedMemberData` had all fields as `required: true`
- Mongoose was rejecting the subdocument due to validation issues

**Solution:**

- Changed all fields in `AssignedMemberData` schema to `required: false`
- This allows the subdocument to be saved even if some fields are missing

**Files Changed:**

- `src/products/schemas/global-product.schema.ts`

---

### 3. memberData Not Cleared When Returning to Warehouse ✅

**Problem:**

- When returning a product from member to warehouse, `memberData` was not being cleared
- Old member data remained in the document

**Root Cause:**

- Passing `undefined` to MongoDB doesn't remove the field
- Need to explicitly set to `null` to clear the field

**Solution:**

- Modified update data to convert `undefined` to `null` for `memberData` and `fpWarehouse`
- This ensures MongoDB removes the field when it should be cleared

**Code:**

```typescript
const updateData = {
  // ... other fields
  fpWarehouse: params.fpWarehouse !== undefined ? params.fpWarehouse : null,
  memberData: params.memberData !== undefined ? params.memberData : null,
};
```

**Files Changed:**

- `src/products/services/global-product-sync.service.ts`

---

### 4. Wrong Warehouse Assigned (Argentina instead of Brazil) ✅

**Problem:**

- When returning a product to "FP warehouse", it was assigned to Argentina warehouse
- Should have been assigned to Brazil warehouse based on member's country

**Root Cause:**

- System was using `product.lastAssigned` which had incorrect/outdated email
- Member lookup failed, defaulted to Argentina

**Solution:**

- Modified `assignWarehouseIfNeeded()` to accept optional `memberEmail` parameter
- `moveToProductsCollection()` now passes `member.email` directly as source of truth
- Priority order: provided memberEmail → lastAssigned → assignedEmail → default Argentina

**Files Changed:**

- `src/assignments/assignments.service.ts`

---

### 5. Missing tenantName in Sync Call ✅

**Problem:**

- Synchronization was being skipped because `tenantName` was undefined
- Log showed: `⚠️ Sync skipped - tenantName: undefined`

**Root Cause:**

- `handleProductUnassignment()` was called without passing `tenantName` parameter

**Solution:**

- Modified call to `handleProductUnassignment()` to include `tenantName` parameter

**Files Changed:**

- `src/assignments/assignments.service.ts`

---

### 6. tenantId Schema Type Mismatch ✅

**Problem:**

- Even after fixing the conversion logic, new documents were still being created with `tenantId` as String
- Mongoose was converting ObjectId to String when saving

**Root Cause:**

- GlobalProduct schema had `tenantId` defined as `string` instead of `MongooseSchema.Types.ObjectId`
- Mongoose automatically converts values to match the schema type

**Solution:**

- Changed schema definition from `tenantId: string` to `tenantId: MongooseSchema.Types.ObjectId`
- Now Mongoose preserves the ObjectId type when saving

**Code:**

```typescript
// BEFORE
@Prop({ required: true, index: true })
tenantId: string;

// AFTER
@Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
tenantId: MongooseSchema.Types.ObjectId;
```

**Files Changed:**

- `src/products/schemas/global-product.schema.ts`

---

## 🔧 Technical Changes

### Schema Changes

**File:** `src/products/schemas/global-product.schema.ts`

```typescript
// BEFORE
@Schema({ _id: false })
export class AssignedMemberData {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  memberId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  memberEmail: string;

  @Prop({ required: true })
  memberName: string;
  // ...
}

// AFTER
@Schema({ _id: false })
export class AssignedMemberData {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  memberId: MongooseSchema.Types.ObjectId;

  @Prop({ required: false })
  memberEmail: string;

  @Prop({ required: false })
  memberName: string;
  // ...
}
```

### Service Changes

**File:** `src/products/services/global-product-sync.service.ts`

1. **TenantId Resolution:**

   - Always converts string tenantName to ObjectId
   - Queries tenant collection to get ObjectId

2. **Field Cleanup:**

   - Converts `undefined` to `null` for `memberData` and `fpWarehouse`
   - Ensures fields are properly removed when needed

3. **Removed Debug Logs:**
   - Cleaned up excessive logging added during debugging
   - Kept only essential logs for production

**File:** `src/assignments/assignments.service.ts`

1. **Warehouse Assignment:**

   - Added optional `memberEmail` parameter to `assignWarehouseIfNeeded()`
   - Passes `member.email` directly from `moveToProductsCollection()`
   - Improved country resolution logic

2. **Sync Call Fixes:**

   - Added `tenantName` parameter to `handleProductUnassignment()` call
   - Ensures synchronization always executes

3. **Removed Debug Logs:**
   - Cleaned up excessive logging added during debugging

---

## 🧪 Testing Results

### Test Case 1: Assign Product to Member ✅

**Steps:**

1. Assign product from "Our office" to member "A A"

**Expected Results:**

- ✅ Product updates in global collection (no duplicate)
- ✅ `sourceCollection: 'members'`
- ✅ `memberData` populated with member details
- ✅ `location: 'Employee'`
- ✅ `tenantId` is ObjectId

**Actual Results:** All passed ✅

---

### Test Case 2: Return Product to FP Warehouse ✅

**Steps:**

1. Return product from member "A A" to "FP warehouse" with shipment

**Expected Results:**

- ✅ Product updates in global collection (no duplicate)
- ✅ `sourceCollection: 'products'`
- ✅ `fpWarehouse` populated with Brazil warehouse data
- ✅ `memberData: null` (cleared)
- ✅ `lastAssigned: 'aaa@email.com'` (preserved)
- ✅ `assignedEmail: ''` (cleared)
- ✅ `assignedMember: ''` (cleared)

**Actual Results:** All passed ✅

---

## 📦 New Tools

### Cleanup Script

**File:** `scripts/cleanup-duplicate-global-products.ts`

**Purpose:** Clean up duplicate products in global collection

**Features:**

- Finds all duplicate groups (same tenantName + originalProductId)
- Keeps the most recently synced product
- Converts tenantId to ObjectId if needed
- Deletes older duplicates
- Provides detailed logging

**Usage:**

```bash
npm run cleanup:global-products
```

---

## 📚 Documentation

### New Documentation Files

1. **`docs/GLOBAL-PRODUCT-SYNC.md`**

   - Complete guide to global product synchronization
   - Architecture overview
   - Schema documentation
   - Synchronization points
   - Common issues and solutions
   - Best practices
   - Testing checklist

2. **`docs/CHANGELOG-GLOBAL-SYNC.md`** (this file)
   - Detailed changelog of all fixes
   - Technical changes
   - Testing results

---

## 🚀 Deployment Notes

### Pre-Deployment

1. **Review Changes:**

   - Review all code changes in this PR
   - Ensure tests pass

2. **Backup Database:**
   - Backup global collection before deployment
   - Backup tenant databases

### Post-Deployment

1. **Run Cleanup Script:**

   ```bash
   npm run cleanup:global-products
   ```

2. **Verify Results:**

   - Check that duplicates are removed
   - Verify tenantId is ObjectId for all products
   - Monitor logs for sync errors

3. **Test Flows:**
   - Test product assignment to member
   - Test product return to warehouse
   - Verify memberData and fpWarehouse are correct

---

## 🔍 Monitoring

### Metrics to Monitor

1. **Duplicate Count:**

   - Should be 0 after cleanup
   - Monitor for new duplicates

2. **Sync Errors:**

   - Check logs for sync failures
   - Investigate any errors immediately

3. **Data Consistency:**
   - Verify memberData is populated for Employee location
   - Verify fpWarehouse is populated for FP warehouse location
   - Verify fields are cleared when appropriate

---

## 👥 Contributors

- Mercedes (Developer)
- Augment Agent (AI Assistant)

---

## 📝 Notes

- All changes are backward compatible
- No breaking changes to API
- Existing data will be fixed by cleanup script
- Future syncs will work correctly with new code
