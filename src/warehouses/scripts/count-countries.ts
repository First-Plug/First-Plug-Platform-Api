import { countryCodes } from '../../shipments/helpers/countryCodes';

/**
 * Script simple para contar países
 */

function countCountries() {
  const countries = Object.keys(countryCodes);
  console.log(`📊 Total countries in countryCodes: ${countries.length}`);
  
  console.log('\n🌍 Countries by region:');
  
  // Mostrar algunos ejemplos
  console.log('\nFirst 10 countries:');
  countries.slice(0, 10).forEach((country, index) => {
    console.log(`   ${index + 1}. ${country} (${countryCodes[country]})`);
  });
  
  console.log('\nLast 10 countries:');
  countries.slice(-10).forEach((country, index) => {
    console.log(`   ${countries.length - 9 + index}. ${country} (${countryCodes[country]})`);
  });
  
  return countries.length;
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  countCountries();
}

export { countCountries };
