import { countryCodes } from '../../shipments/helpers/countryCodes';

// PEGA AQUÍ LA LISTA DEL FRONTEND
const frontendCountries: Record<string, string> = {
  // Cuando tengas la lista del frontend, pégala aquí
  // Por ejemplo:
  // "Argentina": "AR",
  // "Brasil": "BR",
  // etc...
};

/**
 * Script para comparar países del backend vs frontend
 * y encontrar los que faltan, manejando duplicados inteligentemente
 */

function compareCountries() {
  console.log('🔍 Comparing backend vs frontend countries...\n');

  // Obtener listas
  const backendCountries = Object.keys(countryCodes);
  const frontendCountriesList = Object.keys(frontendCountries);

  console.log(`📊 Backend countries: ${backendCountries.length}`);
  console.log(`📊 Frontend countries: ${frontendCountriesList.length}\n`);

  // Crear mapas por código de país para detectar duplicados
  const backendByCodes = new Map<string, string[]>();
  const frontendByCodes = new Map<string, string[]>();

  // Agrupar backend por códigos
  backendCountries.forEach((country) => {
    const code = countryCodes[country];
    if (!backendByCodes.has(code)) {
      backendByCodes.set(code, []);
    }
    backendByCodes.get(code)!.push(country);
  });

  // Agrupar frontend por códigos
  frontendCountriesList.forEach((country) => {
    const code = frontendCountries[country];
    if (!frontendByCodes.has(code)) {
      frontendByCodes.set(code, []);
    }
    frontendByCodes.get(code)!.push(country);
  });

  console.log('🔍 ANÁLISIS POR CÓDIGOS DE PAÍS:\n');

  // Códigos que están en frontend pero no en backend
  const missingCodesInBackend = Array.from(frontendByCodes.keys()).filter(
    (code) => !backendByCodes.has(code),
  );

  // Códigos que están en backend pero no en frontend
  const missingCodesInFrontend = Array.from(backendByCodes.keys()).filter(
    (code) => !frontendByCodes.has(code),
  );

  console.log(
    `❌ CÓDIGOS FALTANTES EN BACKEND (${missingCodesInBackend.length}):`,
  );
  missingCodesInBackend.forEach((code) => {
    const countries = frontendByCodes.get(code)!;
    console.log(`   ${code}: ${countries.join(', ')}`);
  });

  console.log(
    `\n❌ CÓDIGOS FALTANTES EN FRONTEND (${missingCodesInFrontend.length}):`,
  );
  missingCodesInFrontend.forEach((code) => {
    const countries = backendByCodes.get(code)!;
    console.log(`   ${code}: ${countries.join(', ')}`);
  });

  console.log('\n🔍 ANÁLISIS DE DUPLICADOS:\n');

  console.log('📋 BACKEND - Códigos con múltiples nombres:');
  Array.from(backendByCodes.entries())
    .filter(([_, countries]) => countries.length > 1)
    .forEach(([code, countries]) => {
      console.log(`   ${code}: ${countries.join(', ')}`);
    });

  console.log('\n📋 FRONTEND - Códigos con múltiples nombres:');
  Array.from(frontendByCodes.entries())
    .filter(([_, countries]) => countries.length > 1)
    .forEach(([code, countries]) => {
      console.log(`   ${code}: ${countries.join(', ')}`);
    });

  console.log('\n🔍 PAÍSES ÚNICOS PARA WAREHOUSES:\n');

  // Para warehouses, usar solo un país por código
  const uniqueCountriesForWarehouses = new Map<string, string>();

  // Priorizar versiones en inglés sin acentos
  const priorityOrder = (country: string): number => {
    if (
      country.includes('á') ||
      country.includes('é') ||
      country.includes('í') ||
      country.includes('ó') ||
      country.includes('ú') ||
      country.includes('ñ')
    )
      return 3;
    if (country === 'Brasil' || country === 'México' || country === 'Perú')
      return 2;
    if (country === 'USA' || country === 'UK') return 1;
    return 0;
  };

  // Combinar todos los códigos únicos
  const allUniqueCodes = new Set([
    ...Array.from(backendByCodes.keys()),
    ...Array.from(frontendByCodes.keys()),
  ]);

  allUniqueCodes.forEach((code) => {
    const backendOptions = backendByCodes.get(code) || [];
    const frontendOptions = frontendByCodes.get(code) || [];
    const allOptions = [...backendOptions, ...frontendOptions];

    // Elegir la mejor opción (inglés sin acentos)
    const bestOption = allOptions.sort(
      (a, b) => priorityOrder(a) - priorityOrder(b),
    )[0];
    uniqueCountriesForWarehouses.set(code, bestOption);
  });

  console.log(
    `📦 Países únicos para crear warehouses: ${uniqueCountriesForWarehouses.size}`,
  );
  console.log('Ejemplos:');
  Array.from(uniqueCountriesForWarehouses.entries())
    .slice(0, 10)
    .forEach(([code, country]) => {
      console.log(`   ${code}: ${country}`);
    });

  console.log(`\n📈 RESUMEN:`);
  console.log(`   - Códigos únicos totales: ${allUniqueCodes.size}`);
  console.log(
    `   - Códigos faltantes en backend: ${missingCodesInBackend.length}`,
  );
  console.log(
    `   - Códigos faltantes en frontend: ${missingCodesInFrontend.length}`,
  );
  console.log(`   - Warehouses a crear: ${uniqueCountriesForWarehouses.size}`);

  return {
    missingCodesInBackend,
    missingCodesInFrontend,
    uniqueCountriesForWarehouses: Array.from(
      uniqueCountriesForWarehouses.entries(),
    ),
    totalUniqueCodes: allUniqueCodes.size,
  };
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  compareCountries();
}

export { compareCountries };
