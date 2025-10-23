import { z } from 'zod';

// Regex para validar números de teléfono internacionales (permisivo)
const phoneRegex = /^\+?[0-9\s]*$/;

// Schema para validar códigos de país (ISO 3166-1 alpha-2 + códigos especiales)
const countryCodeSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      // Permitir valores vacíos para compatibilidad
      if (!value || value === '') return true;

      // Códigos especiales internos
      const specialCodes = ['OO', 'FP'];
      if (specialCodes.includes(value)) return true;

      // Códigos ISO 3166-1 alpha-2 (lista básica)
      const isoCodes = [
        'AD',
        'AE',
        'AF',
        'AG',
        'AI',
        'AL',
        'AM',
        'AO',
        'AQ',
        'AR',
        'AS',
        'AT',
        'AU',
        'AW',
        'AX',
        'AZ',
        'BA',
        'BB',
        'BD',
        'BE',
        'BF',
        'BG',
        'BH',
        'BI',
        'BJ',
        'BL',
        'BM',
        'BN',
        'BO',
        'BQ',
        'BR',
        'BS',
        'BT',
        'BV',
        'BW',
        'BY',
        'BZ',
        'CA',
        'CC',
        'CD',
        'CF',
        'CG',
        'CH',
        'CI',
        'CK',
        'CL',
        'CM',
        'CN',
        'CO',
        'CR',
        'CU',
        'CV',
        'CW',
        'CX',
        'CY',
        'CZ',
        'DE',
        'DJ',
        'DK',
        'DM',
        'DO',
        'DZ',
        'EC',
        'EE',
        'EG',
        'EH',
        'ER',
        'ES',
        'ET',
        'FI',
        'FJ',
        'FK',
        'FM',
        'FO',
        'FR',
        'GA',
        'GB',
        'GD',
        'GE',
        'GF',
        'GG',
        'GH',
        'GI',
        'GL',
        'GM',
        'GN',
        'GP',
        'GQ',
        'GR',
        'GS',
        'GT',
        'GU',
        'GW',
        'GY',
        'HK',
        'HM',
        'HN',
        'HR',
        'HT',
        'HU',
        'ID',
        'IE',
        'IL',
        'IM',
        'IN',
        'IO',
        'IQ',
        'IR',
        'IS',
        'IT',
        'JE',
        'JM',
        'JO',
        'JP',
        'KE',
        'KG',
        'KH',
        'KI',
        'KM',
        'KN',
        'KP',
        'KR',
        'KW',
        'KY',
        'KZ',
        'LA',
        'LB',
        'LC',
        'LI',
        'LK',
        'LR',
        'LS',
        'LT',
        'LU',
        'LV',
        'LY',
        'MA',
        'MC',
        'MD',
        'ME',
        'MF',
        'MG',
        'MH',
        'MK',
        'ML',
        'MM',
        'MN',
        'MO',
        'MP',
        'MQ',
        'MR',
        'MS',
        'MT',
        'MU',
        'MV',
        'MW',
        'MX',
        'MY',
        'MZ',
        'NA',
        'NC',
        'NE',
        'NF',
        'NG',
        'NI',
        'NL',
        'NO',
        'NP',
        'NR',
        'NU',
        'NZ',
        'OM',
        'PA',
        'PE',
        'PF',
        'PG',
        'PH',
        'PK',
        'PL',
        'PM',
        'PN',
        'PR',
        'PS',
        'PT',
        'PW',
        'PY',
        'QA',
        'RE',
        'RO',
        'RS',
        'RU',
        'RW',
        'SA',
        'SB',
        'SC',
        'SD',
        'SE',
        'SG',
        'SH',
        'SI',
        'SJ',
        'SK',
        'SL',
        'SM',
        'SN',
        'SO',
        'SR',
        'SS',
        'ST',
        'SV',
        'SX',
        'SY',
        'SZ',
        'TC',
        'TD',
        'TF',
        'TG',
        'TH',
        'TJ',
        'TK',
        'TL',
        'TM',
        'TN',
        'TO',
        'TR',
        'TT',
        'TV',
        'TW',
        'TZ',
        'UA',
        'UG',
        'UM',
        'US',
        'UY',
        'UZ',
        'VA',
        'VC',
        'VE',
        'VG',
        'VI',
        'VN',
        'VU',
        'WF',
        'WS',
        'YE',
        'YT',
        'ZA',
        'ZM',
        'ZW',
      ];

      return isoCodes.includes(value.toUpperCase());
    },
    {
      message:
        'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
    },
  );

// Schema opcional para códigos de país (permite vacío)
const optionalCountryCodeSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => {
      if (!value || value === '') return true;
      return countryCodeSchema.safeParse(value).success;
    },
    {
      message:
        'Country must be a valid ISO 3166-1 alpha-2 code (e.g., AR, BR, US) or special internal code (OO, FP)',
    },
  );

export const CreateOfficeSchemaZod = z.object({
  name: z.string().min(1, { message: 'Office name is required' }).trim(),

  isDefault: z.boolean().optional().default(false),

  email: z
    .string()
    .email({ message: 'Invalid email address' })
    .trim()
    .toLowerCase()
    .optional()
    .or(z.literal('')),

  phone: z
    .string()
    .trim()
    .regex(phoneRegex, {
      message: 'Phone number is invalid',
    })
    .optional()
    .or(z.literal('')),

  country: optionalCountryCodeSchema,

  state: z.string().trim().optional().or(z.literal('')),

  city: z.string().trim().optional().or(z.literal('')),

  zipCode: z.string().trim().optional().or(z.literal('')),

  address: z.string().trim().optional().or(z.literal('')),

  apartment: z.string().trim().optional().or(z.literal('')),
});

export const UpdateOfficeSchemaZod = CreateOfficeSchemaZod.partial();

// Schema para toggle default (solo permite cambiar isDefault)
export const ToggleDefaultOfficeSchemaZod = z.object({
  isDefault: z.boolean(),
});

// Schema para validar datos completos de shipment
export const OfficeShipmentDataSchemaZod = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  country: countryCodeSchema,
  state: z.string().min(1, 'El estado es requerido'),
  city: z.string().min(1, 'La ciudad es requerida'),
  zipCode: z.string().min(1, 'El código postal es requerido'),
  address: z.string().min(1, 'La dirección es requerida'),
});

// Schema para crear oficina con campos requeridos mínimos
export const CreateOfficeRequiredSchemaZod = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  country: countryCodeSchema,
});

// Schema para actualizar oficina (no permite cambiar country si hay shipments activos)
export const UpdateOfficeRestrictedSchemaZod =
  CreateOfficeSchemaZod.partial().omit({
    country: true,
  });
