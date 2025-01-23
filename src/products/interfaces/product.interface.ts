import {
  AUDIO_BRANDS,
  AUDIO_MODELS,
  COLORS,
  COMPUTER_BRANDS,
  COMPUTER_MODELS,
  GPUS,
  KEYBOARDLENGUAGES,
  MONITOR_BRANDS,
  MONITOR_MODELS,
  OTHER_BRANDS,
  OTHER_MODELS,
  PERIPHERALS_BRANDS,
  PERIPHERALS_MODELS,
  PROCESSORS,
  RAMS,
  SCREENS,
  STORAGE,
} from './attributes.interface';

export const LOCATIONS = ['Employee', 'FP warehouse', 'Our office'] as const;

export type Location = (typeof LOCATIONS)[number];

export const CATEGORIES = [
  'Merchandising',
  'Computer',
  'Monitor',
  'Audio',
  'Peripherals',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STATES = [
  'Available',
  'Delivered',
  'Deprecated',
  'Unavailable',
] as const;

export type Status = (typeof STATES)[number];

export const CONDITION = ['Optimal', 'Defective', 'Unusable'] as const;

export type Condition = (typeof CONDITION)[number];

export const ATTRIBUTES = [
  'brand',
  'model',
  'color',
  'screen',
  'keyboardLanguage',
  'processor',
  'ram',
  'storage',
  'gpu',
] as const;

export type AttributeKey = (typeof ATTRIBUTES)[number];

export type Attribute = {
  key: AttributeKey;
  value: unknown;
};

export const CATEGORY_KEYS: Record<Category, readonly AttributeKey[]> = {
  Merchandising: ['color'],
  Computer: [
    'brand',
    'model',
    'color',
    'screen',
    'keyboardLanguage',
    'processor',
    'ram',
    'storage',
    'gpu',
  ],
  Monitor: ['brand', 'model', 'screen', 'color'],
  Audio: ['brand', 'model', 'color'],
  Peripherals: ['brand', 'model', 'color', 'keyboardLanguage'],
  Other: ['brand', 'color', 'model'],
};

export type ValidationError = {
  message: string;
  path: string[];
};

export type Color = (typeof COLORS)[number];

export type Screen = (typeof SCREENS)[number];

export type KeyboardLenguage = (typeof KEYBOARDLENGUAGES)[number];

export type Proccessor = (typeof PROCESSORS)[number];

export type Ram = (typeof RAMS)[number];

export type Storage = (typeof STORAGE)[number];

export type GPU = (typeof GPUS)[number];

export type ComputerBrand = (typeof COMPUTER_BRANDS)[number];

export type PeripheralsBrand = (typeof PERIPHERALS_BRANDS)[number];

export type AudioBrand = (typeof AUDIO_BRANDS)[number];

export type MonitorBrand = (typeof MONITOR_BRANDS)[number];

export type ComputerModel = (typeof COMPUTER_MODELS)[number];

export type AudioModel = (typeof AUDIO_MODELS)[number];

export type MonitorModel = (typeof MONITOR_MODELS)[number];

export type PeripheralsModel = (typeof PERIPHERALS_MODELS)[number];

export type OtherModel = (typeof OTHER_MODELS)[number];

export type OtherBrand = (typeof OTHER_BRANDS)[number];
