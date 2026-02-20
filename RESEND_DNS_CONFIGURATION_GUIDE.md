# 🔧 Guía Completa: Configuración DNS de Resend en Google Domains

## ❌ Problemas en tu Instructivo Actual

Tu instructivo tiene **3 problemas principales**:

### 1. **Falta Especificar Cuántos Registros DNS**
Tu instructivo dice "3 registros DNS" pero **Resend requiere MÍNIMO 2 registros**:
- **SPF** (TXT record)
- **DKIM** (TXT record)

Algunos casos requieren un **3er registro** (MX o CNAME para return path), pero no siempre.

### 2. **No Explica Dónde Agregar los Registros en Google Domains**
Google Domains (ahora Squarespace) tiene una interfaz específica que no mencionas.

### 3. **No Menciona Tiempos de Propagación Correctos**
Dice "24-48 horas" pero debería ser:
- **SPF/DKIM**: 15-30 minutos (generalmente)
- **Propagación global**: hasta 48 horas en casos raros

---

## ✅ Instructivo Correcto Paso a Paso

### **Paso 1: Obtener Registros DNS de Resend**

1. Ve a [Resend Dashboard](https://resend.com/domains)
2. Haz clic en **"Add Domain"**
3. Escribe: `firstplug.co`
4. Haz clic en **"Add"**
5. **Copia los registros DNS** que aparecen (verás 2-3 registros)

**Registros que verás:**
```
SPF:  v=spf1 include:resend.com ~all
DKIM: [long-key-value]
```

---

### **Paso 2: Agregar Registros en Google Domains/Squarespace**

1. Ve a [Google Domains](https://domains.google.com) o [Squarespace Domains](https://domains.squarespace.com)
2. Selecciona tu dominio `firstplug.co`
3. Busca **"DNS"** o **"DNS Settings"**
4. Busca la sección **"Custom Records"** o **"Add Record"**

**Para cada registro de Resend:**

#### **Agregar SPF:**
- **Type**: TXT
- **Name**: @ (o dejar vacío)
- **Value**: `v=spf1 include:resend.com ~all`
- Haz clic en **"Save"**

#### **Agregar DKIM:**
- **Type**: TXT
- **Name**: `[resend-key-name]._domainkey` (Resend te lo proporciona)
- **Value**: `[el-valor-largo-que-te-da-resend]`
- Haz clic en **"Save"**

---

### **Paso 3: Verificar en Resend**

1. Vuelve a [Resend Dashboard](https://resend.com/domains)
2. Haz clic en **"Verify DNS Records"**
3. Espera 5-15 minutos (no 24-48 horas)
4. Verás ✅ **"Verified"** cuando esté listo

---

## ⚠️ Problemas Comunes y Soluciones

### **Problema: "Domain verification failed"**

**Causas:**
1. Registros DNS copiados incorrectamente
2. Espacios en blanco extra en los valores
3. Tipo de registro incorrecto (TXT vs CNAME)
4. Dominio no propagado aún

**Soluciones:**
```bash
# Verifica que los registros estén en DNS
nslookup -type=TXT firstplug.co
nslookup -type=TXT [resend-key]._domainkey.firstplug.co
```

### **Problema: "SPF record already exists"**

Si ya tienes un SPF record, **NO lo reemplaces**. Combina:

**Antes:**
```
v=spf1 include:google.com ~all
```

**Después:**
```
v=spf1 include:google.com include:resend.com ~all
```

---

## 🎯 Checklist Final

- [ ] Registros DNS copiados exactamente de Resend
- [ ] SPF agregado como TXT record
- [ ] DKIM agregado como TXT record
- [ ] Valores sin espacios en blanco extra
- [ ] Esperaste 5-15 minutos
- [ ] Hiciste clic en "Verify DNS Records" en Resend
- [ ] Estado muestra ✅ "Verified"
- [ ] .env actualizado: `EMAIL_FROM=noreply@firstplug.co`

---

## 📝 Actualizar tu .env

```env
# Cuando esté verificado:
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@firstplug.co
EMAIL_FROM_NAME=FirstPlug
EMAIL_TEST_RECIPIENT=tu-email@gmail.com  # Para testing local
```

---

## 🚀 Próximos Pasos

Una vez verificado, puedes:
1. Enviar emails a cualquier dirección (no solo resend.dev)
2. Usar el dominio en producción
3. Habilitar tracking de opens/clicks si lo deseas

