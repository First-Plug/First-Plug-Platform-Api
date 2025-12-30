import { Quote } from '../interfaces/quote.interface';
import { countryCodes } from 'src/shipments/helpers/countryCodes';

/**
 * Helper para acceder a propiedades de forma segura
 */
const getProperty = (obj: any, key: string): any => {
  return obj?.[key];
};

/**
 * Convierte código de país a nombre
 */
const convertCountryCodeToName = (countryCode: string): string => {
  if (!countryCode) return '';

  // Casos especiales que no se convierten
  if (countryCode === 'Our office' || countryCode === 'FP warehouse') {
    return countryCode;
  }

  // Si ya es un nombre (no código de 2 letras), devolverlo tal como está
  if (countryCode.length !== 2 || !/^[A-Z]{2}$/.test(countryCode)) {
    return countryCode;
  }

  // Crear mapa inverso: código -> nombre
  const codeToName = Object.entries(countryCodes).reduce(
    (acc, [name, code]) => {
      acc[code] = name;
      return acc;
    },
    {} as Record<string, string>,
  );

  return codeToName[countryCode] || countryCode;
};

/**
 * Formatea fecha a formato DD/MM/YYYY (solo días, sin hora)
 */
const formatDateToDay = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Helper para mostrar snapshot de producto
 */
const buildProductSnapshotBlock = (snapshot: any): any[] => {
  const blocks: any[] = [];

  // Mostrar categoría si existe
  if (snapshot.category) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Category:* ${snapshot.category}`,
      },
    });
  }

  // Construir identificación del producto: Brand + Model + Name
  const brandModelName: string[] = [];
  if (snapshot.brand) brandModelName.push(snapshot.brand);
  if (snapshot.model) brandModelName.push(snapshot.model);
  if (snapshot.name) brandModelName.push(snapshot.name);

  if (brandModelName.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
      },
    });
  }

  // Serial Number
  if (snapshot.serialNumber) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Serial Number:* ${snapshot.serialNumber}`,
      },
    });
  }

  // Location + Country
  if (snapshot.location || snapshot.countryCode) {
    let locationText = '';
    if (snapshot.location && snapshot.assignedTo && snapshot.countryCode) {
      locationText = `${snapshot.location} + ${snapshot.assignedTo} + ${convertCountryCodeToName(snapshot.countryCode)}`;
    } else if (snapshot.location && snapshot.countryCode) {
      locationText = `${snapshot.location} + ${convertCountryCodeToName(snapshot.countryCode)}`;
    } else if (snapshot.location) {
      locationText = snapshot.location;
    }

    if (locationText) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Location:* ${locationText}`,
        },
      });
    }
  }

  return blocks;
};

/**
 * Construye bloques de Slack para servicios
 * Soporta IT Support y Enrollment
 * @param services - Array de servicios
 * @param startItemNumber - Número de item inicial (para numeración secuencial con productos)
 */
const buildServiceBlocks = (
  services: any[],
  startItemNumber: number = 1,
): any[] => {
  if (!services || services.length === 0) return [];

  let itemCounter = startItemNumber;
  return services.flatMap((service: any) => {
    const blocks: any[] = [];

    // Encabezado del servicio
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Item ${itemCounter}: ${service.serviceCategory}*`,
      },
    });
    itemCounter++;

    // IT Support Service
    if (service.serviceCategory === 'IT Support') {
      const specs: string[] = [];

      // Información del producto
      if (service.productSnapshot) {
        if (service.productSnapshot.category) {
          specs.push(`*Category:* ${service.productSnapshot.category}`);
        }

        const brandModelName: string[] = [];
        if (service.productSnapshot.brand)
          brandModelName.push(service.productSnapshot.brand);
        if (service.productSnapshot.model)
          brandModelName.push(service.productSnapshot.model);
        if (service.productSnapshot.name)
          brandModelName.push(service.productSnapshot.name);

        if (brandModelName.length > 0) {
          specs.push(`*Brand + Model + Name:* ${brandModelName.join(' + ')}`);
        }

        if (service.productSnapshot.serialNumber) {
          specs.push(
            `*Serial Number:* ${service.productSnapshot.serialNumber}`,
          );
        }

        if (
          service.productSnapshot.location ||
          service.productSnapshot.countryCode
        ) {
          let locationText = '';
          if (
            service.productSnapshot.location &&
            service.productSnapshot.countryCode
          ) {
            const countryName = convertCountryCodeToName(
              service.productSnapshot.countryCode,
            );
            locationText = `${service.productSnapshot.location} + ${countryName}`;
          } else if (service.productSnapshot.location) {
            locationText = service.productSnapshot.location;
          } else if (service.productSnapshot.countryCode) {
            locationText = convertCountryCodeToName(
              service.productSnapshot.countryCode,
            );
          }

          if (locationText) {
            specs.push(`*Location:* ${locationText}`);
          }
        }
      }

      // Issues
      if (service.issues && service.issues.length > 0) {
        specs.push(`*Issues:* ${service.issues.join(', ')}`);
      }

      // Description
      if (service.description) {
        specs.push(`*Description:* ${service.description}`);
      }

      // Issue start date
      if (service.issueStartDate) {
        const [year, month, day] = service.issueStartDate.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        specs.push(`*Started:* ${formattedDate}`);
      }

      // Impact level
      if (service.impactLevel) {
        specs.push(`*Impact Level:* ${service.impactLevel}`);
      }

      if (specs.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: specs.join('\n'),
          },
        });
      }
    }
    // Enrollment Service
    else if (service.serviceCategory === 'Enrollment') {
      // Contar total de computadoras
      const totalComputers = (service.enrolledDevices || []).filter(
        (device: any) => device.category === 'Computer',
      ).length;

      // Contar dispositivos por tipo (Mac vs Windows)
      const macCount = (service.enrolledDevices || []).filter(
        (device: any) =>
          device.category === 'Computer' &&
          device.brand &&
          device.brand.toLowerCase().includes('apple'),
      ).length;
      const windowsCount = (service.enrolledDevices || []).filter(
        (device: any) =>
          device.category === 'Computer' &&
          device.brand &&
          !device.brand.toLowerCase().includes('apple'),
      ).length;

      // Summary block
      const summarySpecs: string[] = [];
      summarySpecs.push(`*Total quantity of computers:* ${totalComputers}`);

      const deviceSummary: string[] = [];
      if (macCount > 0) deviceSummary.push(`${macCount} Mac`);
      if (windowsCount > 0) deviceSummary.push(`${windowsCount} Windows`);

      if (deviceSummary.length > 0) {
        summarySpecs.push(`*Device Types:* ${deviceSummary.join(', ')}`);
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summarySpecs.join('\n'),
        },
      });

      // Detalles de cada dispositivo
      if (service.enrolledDevices && service.enrolledDevices.length > 0) {
        service.enrolledDevices.forEach((device: any, deviceIndex: number) => {
          const deviceSpecs: string[] = [];

          deviceSpecs.push(`*Computer ${deviceIndex + 1}:*`);

          // Brand + Model + Name
          const brandModelName: string[] = [];
          if (device.brand) brandModelName.push(device.brand);
          if (device.model) brandModelName.push(device.model);
          if (device.name) brandModelName.push(device.name);

          if (brandModelName.length > 0) {
            deviceSpecs.push(
              `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
            );
          }

          // Serial Number
          if (device.serialNumber) {
            deviceSpecs.push(`*Serial Number:* ${device.serialNumber}`);
          }

          // Location + Country
          if (device.location || device.countryCode) {
            let locationText = '';
            if (device.location && device.countryCode) {
              const countryName = convertCountryCodeToName(device.countryCode);
              locationText = `${device.location} + ${countryName}`;
            } else if (device.location) {
              locationText = device.location;
            } else if (device.countryCode) {
              locationText = convertCountryCodeToName(device.countryCode);
            }

            if (locationText) {
              deviceSpecs.push(`*Location:* ${locationText}`);
            }
          }

          if (deviceSpecs.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: deviceSpecs.join('\n'),
              },
            });
          }
        });
      }

      // Additional info
      if (service.additionalDetails) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Additional info:* ${service.additionalDetails}`,
          },
        });
      }
    }
    // Data Wipe Service
    else if (service.serviceCategory === 'Data Wipe') {
      // Contar total de assets
      const totalAssets = (service.assets || []).length;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total quantity of assets:* ${totalAssets}`,
        },
      });

      // Detalles de cada asset
      if (service.assets && service.assets.length > 0) {
        service.assets.forEach((asset: any, assetIndex: number) => {
          const assetSpecs: string[] = [];

          assetSpecs.push(
            `*Product ${assetIndex + 1}: ${asset.productSnapshot?.category || 'Unknown'}*`,
          );

          // Requested date
          if (asset.desirableDate) {
            const [year, month, day] = asset.desirableDate.split('-');
            const formattedDate = `${day}/${month}/${year}`;
            assetSpecs.push(`*Requested date:* ${formattedDate}`);
          }

          // Serial Number
          if (asset.productSnapshot?.serialNumber) {
            assetSpecs.push(
              `*Serial Number:* ${asset.productSnapshot.serialNumber}`,
            );
          }

          // Brand + Model + Name
          const brandModelName: string[] = [];
          if (asset.productSnapshot?.brand)
            brandModelName.push(asset.productSnapshot.brand);
          if (asset.productSnapshot?.model)
            brandModelName.push(asset.productSnapshot.model);
          if (asset.productSnapshot?.name)
            brandModelName.push(asset.productSnapshot.name);

          if (brandModelName.length > 0) {
            assetSpecs.push(
              `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
            );
          }

          // Current Location
          if (asset.currentLocation) {
            let locationText = '';

            if (asset.currentLocation === 'Employee' && asset.currentMember) {
              const countryName = convertCountryCodeToName(
                asset.currentMember.countryCode || '',
              );
              locationText = `${asset.currentMember.assignedMember || 'Unknown'} + ${countryName}`;
            } else if (
              asset.currentLocation === 'Our office' &&
              asset.currentOffice
            ) {
              const countryName = convertCountryCodeToName(
                asset.currentOffice.countryCode || '',
              );
              locationText = `${asset.currentOffice.officeName || 'Unknown'} + ${countryName}`;
            } else if (
              asset.currentLocation === 'FP warehouse' &&
              asset.currentWarehouse
            ) {
              const countryName = convertCountryCodeToName(
                asset.currentWarehouse.countryCode || '',
              );
              locationText = `${asset.currentWarehouse.warehouseName || 'FP warehouse'} + ${countryName}`;
            }

            if (locationText) {
              assetSpecs.push(`*Location:* ${locationText}`);
            }
          }

          // Destination
          if (asset.destination && asset.destination.destinationType) {
            let destinationText = '';

            if (
              asset.destination.destinationType === 'Employee' &&
              asset.destination.member
            ) {
              const countryName = convertCountryCodeToName(
                asset.destination.member.countryCode || '',
              );
              destinationText = `${asset.destination.member.assignedMember || 'Unknown'} + ${countryName}`;
            } else if (
              asset.destination.destinationType === 'Our office' &&
              asset.destination.office
            ) {
              const countryName = convertCountryCodeToName(
                asset.destination.office.countryCode || '',
              );
              destinationText = `${asset.destination.office.officeName || 'Unknown'} + ${countryName}`;
            } else if (
              asset.destination.destinationType === 'FP warehouse' &&
              asset.destination.warehouse
            ) {
              const countryName = convertCountryCodeToName(
                asset.destination.warehouse.countryCode || '',
              );
              destinationText = `${asset.destination.warehouse.warehouseName || 'FP warehouse'} + ${countryName}`;
            }

            if (destinationText) {
              assetSpecs.push(`*Destination:* ${destinationText}`);
            }
          }

          if (assetSpecs.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: assetSpecs.join('\n'),
              },
            });
          }
        });
      }

      // Additional info
      if (service.additionalDetails) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Additional info:* ${service.additionalDetails}`,
          },
        });
      }
    }
    // Destruction and Recycling Service
    else if (service.serviceCategory === 'Destruction and Recycling') {
      // Total quantity of assets
      const totalAssets = (service.products || []).length;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total quantity of assets:* ${totalAssets}`,
        },
      });

      // Detalles de cada producto a destruir
      if (service.products && service.products.length > 0) {
        service.products.forEach((product: any, productIndex: number) => {
          const productSpecs: string[] = [];

          productSpecs.push(
            `*Product ${productIndex + 1}:* ${product.productSnapshot?.category || 'Unknown'}`,
          );

          // Brand + Model + Name
          const brandModelName: string[] = [];
          if (product.productSnapshot?.brand)
            brandModelName.push(product.productSnapshot.brand);
          if (product.productSnapshot?.model)
            brandModelName.push(product.productSnapshot.model);
          if (product.productSnapshot?.name)
            brandModelName.push(product.productSnapshot.name);

          if (brandModelName.length > 0) {
            productSpecs.push(
              `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
            );
          }

          // Serial Number
          if (product.productSnapshot?.serialNumber) {
            productSpecs.push(
              `*Serial Number:* ${product.productSnapshot.serialNumber}`,
            );
          }

          // Location + Country
          if (
            product.productSnapshot?.location ||
            product.productSnapshot?.countryCode
          ) {
            let locationText = '';
            if (
              product.productSnapshot?.location &&
              product.productSnapshot?.countryCode
            ) {
              const countryName = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
              locationText = `${product.productSnapshot.location} + ${countryName}`;
            } else if (product.productSnapshot?.location) {
              locationText = product.productSnapshot.location;
            } else if (product.productSnapshot?.countryCode) {
              locationText = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
            }

            if (locationText) {
              productSpecs.push(`*Location:* ${locationText}`);
            }
          }

          if (productSpecs.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: productSpecs.join('\n'),
              },
            });
          }
        });
      }

      // Certificate requirement and Comments
      const certSpecs: string[] = [];
      if (service.requiresCertificate !== undefined) {
        certSpecs.push(
          `*Requires Certificate:* ${service.requiresCertificate ? 'Yes' : 'No'}`,
        );
      }

      if (service.comments) {
        certSpecs.push(`*Comments:* ${service.comments}`);
      }

      if (certSpecs.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: certSpecs.join('\n'),
          },
        });
      }
    }
    // Buyback Service
    else if (service.serviceCategory === 'Buyback') {
      // Total quantity of assets
      const totalAssets = (service.products || []).length;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total quantity of assets:* ${totalAssets}`,
        },
      });

      // Detalles de cada producto a comprar
      if (service.products && service.products.length > 0) {
        service.products.forEach((product: any, productIndex: number) => {
          const productSpecs: string[] = [];

          productSpecs.push(
            `*Product ${productIndex + 1}:* ${product.productSnapshot?.category || 'Unknown'}`,
          );

          // Serial Number
          if (product.productSnapshot?.serialNumber) {
            productSpecs.push(
              `*Serial Number:* ${product.productSnapshot.serialNumber}`,
            );
          }

          // Location + Country + Name (Employee/Office/Warehouse)
          if (
            product.productSnapshot?.location ||
            product.productSnapshot?.countryCode
          ) {
            let locationText = '';
            if (
              product.productSnapshot?.location &&
              product.productSnapshot?.countryCode
            ) {
              const countryName = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
              locationText = `${product.productSnapshot.location} + ${countryName}`;
            } else if (product.productSnapshot?.location) {
              locationText = product.productSnapshot.location;
            } else if (product.productSnapshot?.countryCode) {
              locationText = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
            }

            // Add assignedTo name if available
            if (product.productSnapshot?.assignedTo) {
              locationText += ` (${product.productSnapshot.assignedTo})`;
            }

            if (locationText) {
              productSpecs.push(`*Location:* ${locationText}`);
            }
          }

          // Brand + Model + Name (solo para Computer)
          if (product.productSnapshot?.category === 'Computer') {
            const brandModelName: string[] = [];
            if (product.productSnapshot?.brand)
              brandModelName.push(product.productSnapshot.brand);
            if (product.productSnapshot?.model)
              brandModelName.push(product.productSnapshot.model);
            if (product.productSnapshot?.name)
              brandModelName.push(product.productSnapshot.name);

            if (brandModelName.length > 0) {
              productSpecs.push(
                `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
              );
            }

            // OS (solo para Computer)
            if (product.productSnapshot?.os) {
              productSpecs.push(`*OS:* ${product.productSnapshot.os}`);
            }

            // Processor (solo para Computer)
            if (product.productSnapshot?.processor) {
              productSpecs.push(
                `*Processor:* ${product.productSnapshot.processor}`,
              );
            }

            // RAM (solo para Computer)
            if (product.productSnapshot?.ram) {
              productSpecs.push(`*RAM:* ${product.productSnapshot.ram}`);
            }

            // Storage (solo para Computer)
            if (product.productSnapshot?.storage) {
              productSpecs.push(
                `*Storage:* ${product.productSnapshot.storage}`,
              );
            }

            // Screen size (solo para Computer)
            if (product.productSnapshot?.screenSize) {
              productSpecs.push(
                `*Screen size:* ${product.productSnapshot.screenSize}`,
              );
            }
          } else {
            // Para Other: Brand + Model + Name
            const brandModelName: string[] = [];
            if (product.productSnapshot?.brand)
              brandModelName.push(product.productSnapshot.brand);
            if (product.productSnapshot?.model)
              brandModelName.push(product.productSnapshot.model);
            if (product.productSnapshot?.name)
              brandModelName.push(product.productSnapshot.name);

            if (brandModelName.length > 0) {
              productSpecs.push(
                `*Brand + Model + Name:* ${brandModelName.join(' + ')}`,
              );
            }
          }

          // Product Condition
          if (product.productSnapshot?.productCondition) {
            productSpecs.push(
              `*Product Condition:* ${product.productSnapshot.productCondition}`,
            );
          }

          // Additional info
          if (product.productSnapshot?.additionalInfo) {
            productSpecs.push(
              `*Additional info:* ${product.productSnapshot.additionalInfo}`,
            );
          }

          // Buyback Details
          if (product.buybackDetails) {
            const details = product.buybackDetails;

            // Funcionamiento general
            if (details.generalFunctionality) {
              productSpecs.push(
                `*Funcionamiento general:* ${details.generalFunctionality}`,
              );
            }

            // Ciclos de batería
            if (
              details.batteryCycles !== undefined &&
              details.batteryCycles !== null
            ) {
              productSpecs.push(
                `*Ciclos de batería:* ${details.batteryCycles}`,
              );
            }

            // Detalles estéticos
            if (details.aestheticDetails) {
              productSpecs.push(
                `*Detalles estéticos:* ${details.aestheticDetails}`,
              );
            }

            // Tiene cargador
            if (
              details.hasCharger !== undefined &&
              details.hasCharger !== null
            ) {
              productSpecs.push(
                `*Tiene cargador:* ${details.hasCharger ? 'Yes' : 'No'}`,
              );
            }

            // Cargador funciona
            if (
              details.chargerWorks !== undefined &&
              details.chargerWorks !== null
            ) {
              productSpecs.push(
                `*Cargador funciona:* ${details.chargerWorks ? 'Yes' : 'No'}`,
              );
            }

            // Otros comentarios
            if (details.additionalComments) {
              productSpecs.push(
                `*Otros comentarios:* ${details.additionalComments}`,
              );
            }
          }

          if (productSpecs.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: productSpecs.join('\n'),
              },
            });
          }
        });
      }

      // Additional info
      if (service.additionalInfo) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Additional info:* ${service.additionalInfo}`,
          },
        });
      }
    }
    // Donate Service
    else if (service.serviceCategory === 'Donate') {
      // Total quantity of assets
      const totalAssets = (service.products || []).length;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Total quantity of assets:* ${totalAssets}`,
        },
      });

      // Detalles de cada producto a donar
      if (service.products && service.products.length > 0) {
        service.products.forEach((product: any, productIndex: number) => {
          const specs: string[] = [];

          // Product header
          specs.push(
            `*Product ${productIndex + 1}:* ${product.productSnapshot?.category || 'Unknown'}`,
          );

          // Brand + Model + Name
          const brandModelName: string[] = [];
          if (product.productSnapshot?.brand)
            brandModelName.push(product.productSnapshot.brand);
          if (product.productSnapshot?.model)
            brandModelName.push(product.productSnapshot.model);
          if (product.productSnapshot?.name)
            brandModelName.push(product.productSnapshot.name);

          if (brandModelName.length > 0) {
            specs.push(`*Brand + Model + Name:* ${brandModelName.join(' + ')}`);
          }

          // Serial Number
          if (product.productSnapshot?.serialNumber) {
            specs.push(
              `*Serial Number:* ${product.productSnapshot.serialNumber}`,
            );
          }

          // Location + Country
          if (
            product.productSnapshot?.location ||
            product.productSnapshot?.countryCode
          ) {
            let locationText = '';
            if (
              product.productSnapshot?.location &&
              product.productSnapshot?.countryCode
            ) {
              const countryName = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
              locationText = `${product.productSnapshot.location} + ${countryName}`;
            } else if (product.productSnapshot?.location) {
              locationText = product.productSnapshot.location;
            } else if (product.productSnapshot?.countryCode) {
              locationText = convertCountryCodeToName(
                product.productSnapshot.countryCode,
              );
            }

            if (locationText) {
              specs.push(`*Location:* ${locationText}`);
            }
          }

          // Needs Data Wipe (solo si category es Computer o Other)
          if (
            product.productSnapshot?.category === 'Computer' ||
            product.productSnapshot?.category === 'Other'
          ) {
            if (product.needsDataWipe !== undefined) {
              specs.push(
                `*Needs Data Wipe:* ${product.needsDataWipe ? 'Yes' : 'No'}`,
              );
            }
          }

          // Needs Cleaning
          if (product.needsCleaning !== undefined) {
            specs.push(
              `*Needs Cleaning:* ${product.needsCleaning ? 'Yes' : 'No'}`,
            );
          }

          // Comments
          if (product.comments) {
            specs.push(`*Comments:* ${product.comments}`);
          }

          // Agregar todos los specs en un solo bloque
          if (specs.length > 0) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: specs.join('\n'),
              },
            });
          }
        });
      }

      // Additional details
      if (service.additionalDetails) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Additional details:* ${service.additionalDetails}`,
          },
        });
      }
    }

    blocks.push({
      type: 'divider',
    });

    return blocks;
  });
};

/**
 * Construye el mensaje de Slack para una quote según el formato especificado
 * Soporta múltiples categorías de productos con campos específicos para cada una
 * @param quote - Documento de quote
 * @param actionType - Tipo de acción: 'New' (crear), 'Updated' (actualizar), 'Cancelled' (cancelar)
 */
export const CreateQuoteMessageToSlack = (
  quote: Quote,
  actionType: 'New' | 'Updated' | 'Cancelled' = 'New',
) => {
  // Contador global de items (productos + servicios)
  let itemCounter = 1;

  // Construir bloques de detalles para cada producto
  const productBlocks = quote.products.flatMap((product: any) => {
    const blocks: any[] = [];
    const currentItemNumber = itemCounter++;

    // Encabezado del producto
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Item ${currentItemNumber}: x${product.quantity} ${product.category}*`,
      },
    });

    // Información de entrega
    const deliveryInfo: string[] = [];
    if (product.deliveryDate)
      deliveryInfo.push(
        `*Required Delivery Date:* ${formatDateToDay(product.deliveryDate)}`,
      );
    if (product.country || product.city) {
      const countryName = convertCountryCodeToName(product.country);
      const location = [countryName, product.city].filter(Boolean).join(', ');
      deliveryInfo.push(`*Location:* ${location}`);
    }
    if (product.comments)
      deliveryInfo.push(`*Additional quote comments:* ${product.comments}`);

    if (deliveryInfo.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: deliveryInfo.join('\n'),
        },
      });
    }

    // Especificaciones según categoría
    const specs: string[] = [];

    // Computer
    if (product.category === 'Computer') {
      if (product.os) specs.push(`*OS:* ${product.os}`);
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.processor && product.processor.length > 0)
        specs.push(`*Processor:* ${product.processor.join(', ')}`);
      if (product.ram && product.ram.length > 0)
        specs.push(`*RAM:* ${product.ram.join(', ')}`);
      if (product.storage && product.storage.length > 0)
        specs.push(`*Storage:* ${product.storage.join(', ')}`);
      if (product.screenSize && product.screenSize.length > 0)
        specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
      if (product.extendedWarranty)
        specs.push(
          `*Extended warranty and extra years:* ${product.extendedWarrantyYears} años`,
        );
      if (product.deviceEnrollment)
        specs.push(`*Device Enrollment (ABM/Intune/MDM setup):* Sí`);
    }
    // Monitor
    else if (product.category === 'Monitor') {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.screenSize && product.screenSize.length > 0)
        specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
      if (product.screenTechnology)
        specs.push(`*Screen Technology:* ${product.screenTechnology}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Audio
    else if (product.category === 'Audio') {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Peripherals
    else if (product.category === 'Peripherals') {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Merchandising
    else if (product.category === 'Merchandising') {
      const description = getProperty(product, 'description');
      if (description) specs.push(`*Description:* ${description}`);
      const additionalRequirements = getProperty(
        product,
        'additionalRequirements',
      );
      if (additionalRequirements)
        specs.push(`*Additional requirements:* ${additionalRequirements}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Phone
    else if (product.category === 'Phone') {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Furniture
    else if (product.category === 'Furniture') {
      if (product.furnitureType)
        specs.push(`*Furniture Type:* ${product.furnitureType}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Tablet
    else if (product.category === 'Tablet') {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.screenSize && product.screenSize.length > 0)
        specs.push(`*Screen size:* ${product.screenSize.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }
    // Other
    else {
      if (product.brand && product.brand.length > 0)
        specs.push(`*Brand:* ${product.brand.join(', ')}`);
      if (product.model && product.model.length > 0)
        specs.push(`*Model:* ${product.model.join(', ')}`);
      if (product.otherSpecifications)
        specs.push(`*Other specifications:* ${product.otherSpecifications}`);
    }

    if (specs.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: specs.join('\n'),
        },
      });
    }

    blocks.push({
      type: 'divider',
    });

    return blocks;
  });

  // Construir bloques de servicios (con numeración secuencial después de productos)
  const serviceBlocks = buildServiceBlocks(quote.services, itemCounter);

  // Calcular total de items solicitados (productos + servicios)
  const totalItems =
    (quote.products?.length || 0) + (quote.services?.length || 0);

  // Construir campos de resumen
  const summaryFields: any[] = [
    {
      type: 'mrkdwn',
      text: `*Type:*\n${actionType}`,
    },
    {
      type: 'mrkdwn',
      text: `*Tenant:*\n${quote.tenantName}`,
    },
    {
      type: 'mrkdwn',
      text: `*Items requested:*\n${totalItems}`,
    },
  ];

  // Agregar usuario
  summaryFields.push(
    {
      type: 'mrkdwn',
      text: `*userName:*\n${quote.userName || quote.userEmail}`,
    },
    {
      type: 'mrkdwn',
      text: `*usermail:*\n${quote.userEmail}`,
    },
  );

  // Determinar icono y título según el tipo de acción
  const headerIcon = actionType === 'Cancelled' ? '❌' : '📋';
  const headerTitle =
    actionType === 'Cancelled'
      ? `Cancelación del pedido de cotización n°: ${quote.requestId}`
      : `Pedido de cotización n°: ${quote.requestId}`;

  const message = {
    text: `${headerIcon} ${headerTitle}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${headerIcon} ${headerTitle}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: summaryFields,
      },
      {
        type: 'divider',
      },
      // Agregar bloques de productos (sin último divider)
      ...(productBlocks.length > 0 ? productBlocks.slice(0, -1) : []),
      // Agregar bloques de servicios (sin último divider)
      ...(serviceBlocks.length > 0 ? serviceBlocks.slice(0, -1) : []),
    ],
  };

  return message;
};
