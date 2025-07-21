console.log('🔥 SCRIPT DE PRUEBA INICIADO');

async function testScript() {
  try {
    console.log('✅ Script funcionando correctamente');
    console.log('📋 Argumentos:', process.argv);
    
    const tenantName = process.argv[2];
    console.log('🎯 Tenant a migrar:', tenantName);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Ejecutando test...');
  const result = await testScript();
  console.log('📊 Resultado:', result);
}

main().catch(console.error);
