// Attributes generics
export const COLORS = [
  'Space Grey',
  'Silver',
  'Midnight',
  'Starlight',
  'Gold',
  'Space Black',
  'Black',
  'White',
  'Blue',
  'Yellow',
  'Red',
  'Green',
  'Natural Titanium',
  'Pink',
  'Purple',
  'Other',
  '',
] as const;

export const SCREENS = [
  '13',
  '14',
  '15',
  '16',
  '17',
  '19',
  '20',
  '21',
  '22',
  '24',
  '27',
  '32',
  '34',
  '40',
  '49',
  '',
] as const;

export const PROCESSORS = [
  'AMD Ryzen 3',
  'AMD Ryzen 5',
  'AMD Ryzen 7',
  'AMD Ryzen 9',
  'Intel Core i3',
  'Intel Core i5',
  'Intel Core i7',
  'Intel Core i9',
  'Intel Core Ultra 3',
  'Intel Core Ultra 5',
  'Intel Core Ultra 7',
  'Intel Core Ultra 9',
  'M1',
  'M1 Max',
  'M1 Pro',
  'M2',
  'M2 Max',
  'M2 Pro',
  'M3',
  'M3 Max',
  'M3 Pro',
  'M4',
  'M4 Max',
  'M4 Pro',
  'Other',
  '',
] as const;

export const RAMS = [
  '4GB',
  '6GB',
  '8GB',
  '12GB',
  '16GB',
  '18GB',
  '20GB',
  '24GB',
  '32GB',
  '36GB',
  '40GB',
  '46GB',
  '48GB',
  '64GB',
  '96GB',
  '128GB',
  '',
] as const;

export const GPUS = [
  'GeForce RTX 4080',
  'GeForce RTX 3080 Ti',
  'GeForce RTX 4070',
  'GeForce RTX 4060',
  'GeForce RTX 3070 Ti',
  'GeForce RTX 3080',
  'RTX A5000',
  'RTX A5500',
  'GeForce RTX 2080 Super',
  'GeForce RTX 4050',
  'GeForce RTX 3070',
  'GeForce RTX 2070 Super',
  'RTX A3000',
  'GeForce RTX 3060',
  'RTX A2000',
  'GeForce RTX 3050 Ti',
  'GeForce RTX 3050 6GB',
  'GeForce RTX 3050 4GB',
  'GeForce RTX 3050',
  'RTX A1000',
  'GeForce GTX 1650 Ti',
  'Quadro T1200',
  'T1200',
  'GeForce RTX 2050',
  'Quadro T600',
  'GeForce GTX 1050 3GB',
  'T550',
  'Quadro T500',
  'Other',
  '',
] as const;

export const STORAGE = [
  '256GB',
  '512GB',
  '1TB',
  '2TB',
  '3TB',
  '4TB',
  '5TB',
  '6TB',
  '7TB',
  '8TB',
  '',
] as const;

export const KEYBOARDLENGUAGES = ['English', 'Spanish', 'Other', ''] as const;

// Attributes by brand

export const COMPUTER_BRANDS = [
  'Acer',
  'Apple',
  'Asus',
  'Dell',
  'HP',
  'Lenovo',
  'MSI',
  'Microsoft',
  'Other',
] as const;

export const PERIPHERALS_BRANDS = [
  'Baseus',
  'Satechi',
  'Sony',
  'Logitech',
  'Microsoft',
  'Other',
] as const;

export const AUDIO_BRANDS = [
  'Apple',
  'Sony',
  'Logitech',
  'Microsoft',
  'JBL',
  'Other',
] as const;

export const MONITOR_BRANDS = [
  'Samsung',
  'LG',
  'Dell',
  'Microsoft',
  'Other',
] as const;

export const OTHER_BRANDS = [
  'Acer',
  'Apple',
  'Asus',
  'MSI',
  'Dell',
  'HP',
  'Lenovo',
  'LG',
  'Samsung',
  'Apple',
  'Logitech',
  'Microsoft',
  'Sony',
  'Baseus',
  'Satechi',
  'Sony',
  'JBL',
  'Other',
] as const;

// Attributes by model

export const COMPUTER_MODELS = [
  'Aero Pavilion',
  'Aspire',
  'Chromebook',
  'ConceptD',
  'Creator',
  'Creator Pro',
  'Crosshair',
  'Cyborg',
  'Dragonfly Pro',
  'Enduro Urban',
  'Envy',
  'IdeaPad Serie 1',
  'IdeaPad Serie 3',
  'IdeaPad Serie 5',
  'IdeaPad Serie Flex',
  'IdeaPad Serie S',
  'IdeaPad Slim',
  'Inspiron Serie 3000',
  'Inspiron Serie 5000',
  'Inspiron Serie 7000',
  'Laptop',
  'Latitude Serie 3000',
  'Latitude Serie 5000',
  'Latitude Serie 7000',
  'Latitude Serie 9000',
  'Lenovo V',
  'MacBook Air',
  'MacBook Pro',
  'Modern',
  'Nitro',
  'Omen',
  'Pavilion',
  'Predator',
  'Prestige',
  'ProArt Studiobook',
  'Raider',
  'ROG Zephyrus',
  'Serie V',
  'Spectre',
  'Spin',
  'Stealth',
  'Summit',
  'Surface',
  'Swift',
  'ThinkBook',
  'ThinkBook Serie P',
  'ThinkBook Serie Plus',
  'ThinkBook Serie S',
  'ThinkBook Serie Yoga',
  'ThinkPad',
  'ThinkPad Serie E',
  'ThinkPad Serie L',
  'ThinkPad Serie P',
  'ThinkPad Serie T',
  'ThinkPad Serie X',
  'ThinkPad Serie Yoga',
  'ThinkPad Serie Z',
  'TravelMate',
  'Vector',
  'Victus',
  'Vivobook',
  'Vostro Serie 3000',
  'Vostro Serie 5000',
  'Vostro Serie 7000',
  'XPS Serie 3000',
  'XPS Serie 5000',
  'XPS Serie 7000',
  'XPS Serie 9000',
  'Yoga Serie 2 en 1',
  'Yoga Serie Book',
  'Yoga Serie Pro',
  'Yoga Serie Slim',
  'Zenbook',
  'Other',
] as const;

export const AUDIO_MODELS = [
  'AirPods 2nd Gen',
  'AirPods 3nd Gen',
  'AirPods Max',
  'AirPods Pro 1st Gen',
  'AirPods Pro 2nd Gen',
  'H111',
  'H151',
  'H340',
  'H390',
  'H540',
  'Headphones CH720N inalambrico con cancelacion de sonido',
  'Headphones CH520 inalambrico',
  'Headphones INZONE H3 con cable',
  'Headphones INZONE H3 inalambrico',
  'Headphones RF400 inalambrico',
  'Headphones ZH110 con cable',
  'Headphones ZH110AP con cable',
  'Headphones ZH110NC con cable y cancelacion de sonido',
  'Headphones ZH310AP con cable',
  'Zone 300',
  'Zone 750',
  'Zone 900',
  'Zone 950',
  'Zone Learn',
  'Zone Vibe 100',
  'Zone Vibe 125',
  'Other',
] as const;

export const MONITOR_MODELS = [
  'Bussines Monitor',
  'FHD Monitor',
  'High Resolution Monitor',
  'Lifestyle Monitor',
  'OLED Gaming Monitor',
  'QHD Monitor',
  'Smart Monitor',
  'UltraFine Monitor',
  'UltraGear Monitor',
  'UltraWide Monitor',
  'Other',
] as const;

export const PERIPHERALS_MODELS = [
  'C1 Mouse con cable USB-C',
  'Cable cargador USB-C a USB-C ',
  'Cable Thunderbolt 4',
  'Craft Teclado Bluetooth',
  'Case',
  'Docking Station',
  'HUB Thunderbolt 4 Slim',
  'HUB USB-C 10 en 1',
  'HUB USB-C 11 en 1',
  'HUB USB-C 3 en 1',
  'HUB USB-C 4 en 1',
  'HUB USB-C 5 en 1',
  'HUB USB-C 6 en 1',
  'HUB USB-C 7 en 1',
  'HUB USB-C 8 en 1',
  'HUB USB-C 9 en 1',
  'HDMI',
  'K120 Teclado con cable',
  'K270 Teclado inalambrico',
  'K380 Teclado Bluetooth',
  'K380S Pebble Keys Teclado Bluetooth',
  'K400 Plus Teclado inalambrico',
  'K585 Slim Teclado Bluetooth',
  'K750 para Mac Teclado inalambrico',
  'K780 Teclado Bluetooth',
  'K845 Teclado mecanico con cable',
  'K950 Signature Slim Teclado Bluetooth',
  'M1 Mouse Inalambrico',
  'M100 Mouse con cable',
  'M170 Mouse inalambrico',
  'M185 Mouse inalambrico',
  'M187 Mouse inalambrico',
  'M190 Mouse inalambrico',
  'M220 Mouse inalambrico',
  'M240 Mouse Bluetooth',
  'M310 Mouse inalambrico',
  'M317 Mouse inalambrico',
  'M325S Mouse inalambrico',
  'M330 Mouse inalambrico',
  'M500S Mouse con cable avanzado',
  'M510 Mouse inalambrico',
  'M550 Signature Mouse Bluetooth',
  'M650 Signature Mouse Bluetooth',
  'M705 Marathon Mouse inalambrico',
  'M720 Triathlon Mouse Bluetooth',
  'M750 Signature Mouse Bluetooth',
  'MX Ergo Mouse Bluetooth',
  'MX Keys Mini Teclado Bluetooth',
  'MX Keys Teclado Bluetooth',
  'MX Mechanical Mini Teclado Bluetooth',
  'MX Mechanical Teclado Bluetooth',
  'MX3 Anywhere para Mac Mouse Bluetooth',
  'MX3S Anywhere Mouse Bluetooth',
  'MX3S Master Mouse Bluetooth',
  'MX3S Master para Mac Mouse Bluetooth',
  'Pebble M350 Mouse inalambrico',
  'Pop Keys Teclado Bluetooth',
  'Slim W1 Teclado con cable',
  'Slim W2 Teclado con cable',
  'Slim W3 Teclado con cable',
  'Slim X1 Teclado Bluetooth',
  'Slim X2 Teclado Bluetooth',
  'Slim X3 Teclado Bluetooth',
  'SM1 Slim Teclado Mecanico Bluetooth',
  'Waterproof Laptop Case',
  'Other',
] as const;

export const OTHER_MODELS = [
  'AirPods 2nd Gen',
  'AirPods 3nd Gen',
  'AirPods Max',
  'AirPods Pro 1st Gen',
  'AirPods Pro 2nd Gen',
  'Aero Pavilion',
  'Aspire',
  'Bussines Monitor',
  'C1 Mouse con cable USB-C',
  'Cable Thunderbolt 4',
  'Cable cargador USB-C a USB-C',
  'Case',
  'Chromebook',
  'ConceptD',
  'Craft Teclado Bluetooth',
  'Creator',
  'Creator Pro',
  'Crosshair',
  'Cyborg',
  'Docking Station',
  'Dragonfly Pro',
  'Enduro Urban',
  'Envy',
  'FHD Monitor',
  'H111',
  'H151',
  'H340',
  'H390',
  'H540',
  'HDMI',
  'HUB Thunderbolt 4 Slim',
  'HUB USB-C 10 en 1',
  'HUB USB-C 11 en 1',
  'HUB USB-C 3 en 1',
  'HUB USB-C 4 en 1',
  'HUB USB-C 5 en 1',
  'HUB USB-C 6 en 1',
  'HUB USB-C 7 en 1',
  'HUB USB-C 8 en 1',
  'HUB USB-C 9 en 1',
  'High Resolution Monitor',
  'Headphones CH520 inalambrico',
  'Headphones CH720N inalambrico con cancelacion de sonido',
  'Headphones INZONE H3 con cable',
  'Headphones INZONE H3 inalambrico',
  'Headphones RF400 inalambrico',
  'Headphones ZH110 con cable',
  'Headphones ZH110AP con cable',
  'Headphones ZH110NC con cable y cancelacion de sonido',
  'Headphones ZH310AP con cable',
  'IdeaPad Serie 1',
  'IdeaPad Serie 3',
  'IdeaPad Serie 5',
  'IdeaPad Serie Flex',
  'IdeaPad Serie S',
  'IdeaPad Slim',
  'Inspiron Serie 3000',
  'Inspiron Serie 5000',
  'Inspiron Serie 7000',
  'iPad 10th Gen',
  'iPad 9th Gen',
  'iPad Air 5th Gen M1',
  'iPad Air 6th Gen M2',
  'iPad Mini 6th Gen',
  'iPad Pro 5th Gen M4',
  'iPad Pro 7th Gen M4',
  'iPhone 11',
  'iPhone 13',
  'iPhone 14',
  'iPhone 14 Plus',
  'iPhone 15',
  'iPhone 15 Plus',
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',
  'K120 Teclado con cable',
  'K270 Teclado inalambrico',
  'K380 Teclado Bluetooth',
  'K380S Pebble Keys Teclado Bluetooth',
  'K400 Plus Teclado inalambrico',
  'K585 Slim Teclado Bluetooth',
  'K750 para Mac Teclado inalambrico',
  'K780 Teclado Bluetooth',
  'K845 Teclado mecanico con cable',
  'K950 Signature Slim Teclado Bluetooth',
  'Laptop',
  'Latitude Serie 3000',
  'Latitude Serie 5000',
  'Latitude Serie 7000',
  'Latitude Serie 9000',
  'Lenovo V',
  'Lifestyle Monitor',
  'M1 Mouse Inalambrico',
  'M100 Mouse con cable',
  'M170 Mouse inalambrico',
  'M185 Mouse inalambrico',
  'M187 Mouse inalambrico',
  'M190 Mouse inalambrico',
  'M220 Mouse inalambrico',
  'M240 Mouse Bluetooth',
  'M310 Mouse inalambrico',
  'M317 Mouse inalambrico',
  'M325S Mouse inalambrico',
  'M330 Mouse inalambrico',
  'M500S Mouse con cable avanzado',
  'M510 Mouse inalambrico',
  'M550 Signature Mouse Bluetooth',
  'M650 Signature Mouse Bluetooth',
  'M705 Marathon Mouse inalambrico',
  'M720 Triathlon Mouse Bluetooth',
  'M750 Signature Mouse Bluetooth',
  'MacBook Air',
  'MacBook Pro',
  'Magic Keyboard Folio for iPad 10th Gen',
  'Magic Keyboard for iPad Air M2',
  'Magic Keyboard for iPad Pro M4',
  'Modern',
  'MX Ergo Mouse Bluetooth',
  'MX Keys Mini Teclado Bluetooth',
  'MX Keys Teclado Bluetooth',
  'MX Mechanical Mini Teclado Bluetooth',
  'MX Mechanical Teclado Bluetooth',
  'MX3 Anywhere para Mac Mouse Bluetooth',
  'MX3S Anywhere Mouse Bluetooth',
  'MX3S Master Mouse Bluetooth',
  'MX3S Master para Mac Mouse Bluetooth',
  'Nitro',
  'OLED Gaming Monitor',
  'Omen',
  'Pavilion',
  'Pebble M350 Mouse inalambrico',
  'Pencil 1',
  'Pencil 2',
  'Pencil Pro',
  'Pencil USB-C',
  'Pop Keys Teclado Bluetooth',
  'Predator',
  'Prestige',
  'ProArt Studiobook',
  'QHD Monitor',
  'Raider',
  'ROG Zephyrus',
  'Serie V',
  'Slim W1 Teclado con cable',
  'Slim W2 Teclado con cable',
  'Slim W3 Teclado con cable',
  'Slim X1 Teclado Bluetooth',
  'Slim X2 Teclado Bluetooth',
  'Slim X3 Teclado Bluetooth',
  'SM1 Slim Teclado Mecanico Bluetooth',
  'Smart Monitor',
  'Spectre',
  'Spin',
  'Stealth',
  'Summit',
  'Surface',
  'Swift',
  'ThinkBook',
  'ThinkBook Serie P',
  'ThinkBook Serie Plus',
  'ThinkBook Serie S',
  'ThinkBook Serie Yoga',
  'ThinkPad',
  'ThinkPad Serie E',
  'ThinkPad Serie L',
  'ThinkPad Serie P',
  'ThinkPad Serie T',
  'ThinkPad Serie X',
  'ThinkPad Serie Yoga',
  'ThinkPad Serie Z',
  'TravelMate',
  'UltraFine Monitor',
  'UltraGear Monitor',
  'UltraWide Monitor',
  'Vector',
  'Victus',
  'Vivobook',
  'Vostro Serie 3000',
  'Vostro Serie 5000',
  'Vostro Serie 7000',
  'Waterproof Laptop Case',
  'XPS Serie 3000',
  'XPS Serie 5000',
  'XPS Serie 7000',
  'XPS Serie 9000',
  'Yoga Serie 2 en 1',
  'Yoga Serie Book',
  'Yoga Serie Pro',
  'Yoga Serie Slim',
  'Zenbook',
  'Zone 300',
  'Zone 750',
  'Zone 900',
  'Zone 950',
  'Zone Learn',
  'Zone Vibe 100',
  'Zone Vibe 125',
  'Other',
] as const;
