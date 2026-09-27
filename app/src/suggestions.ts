// Offline starter list. Existing inventory augments these suggestions; typing is never restricted.
export const MODELS: Record<string, string[]> = {
  Acura: ['ILX', 'Integra', 'MDX', 'RDX', 'TL', 'TLX', 'TSX'],
  Audi: ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q3', 'Q5', 'Q7', 'Q8', 'S4', 'S5', 'RS5'],
  BMW: ['228i', '328i', '330i', '335i', '340i', '430i', '530i', '535i', '540i', '740i', 'M3', 'M4', 'M5', 'X1', 'X3', 'X5', 'X6', 'X7'],
  Buick: ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal'],
  Cadillac: ['ATS', 'CTS', 'CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6'],
  Chevrolet: ['Camaro', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Impala', 'Malibu', 'Silverado 1500', 'Silverado 2500HD', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax'],
  Chrysler: ['200', '300', 'Pacifica', 'Town & Country'],
  Dodge: ['Challenger', 'Charger', 'Durango', 'Grand Caravan', 'Journey'],
  Ford: ['Bronco', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-250', 'F-350', 'Fiesta', 'Focus', 'Fusion', 'Maverick', 'Mustang', 'Ranger', 'Taurus', 'Transit'],
  Genesis: ['G70', 'G80', 'G90', 'GV70', 'GV80'],
  GMC: ['Acadia', 'Canyon', 'Sierra 1500', 'Sierra 2500HD', 'Terrain', 'Yukon', 'Yukon XL'],
  Honda: ['Accord', 'Civic', 'CR-V', 'CR-V Hybrid', 'Fit', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline'],
  Hyundai: ['Accent', 'Elantra', 'Ioniq', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Veloster', 'Venue'],
  Infiniti: ['G35', 'G37', 'Q50', 'Q60', 'QX50', 'QX60', 'QX80'],
  Jaguar: ['E-PACE', 'F-PACE', 'F-TYPE', 'XE', 'XF', 'XJ'],
  Jeep: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Patriot', 'Renegade', 'Wagoneer', 'Wrangler'],
  Kia: ['Forte', 'K5', 'Optima', 'Rio', 'Sedona', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['ES 350', 'GS 350', 'GX 460', 'IS 250', 'IS 350', 'LS 460', 'LX 570', 'NX 200t', 'NX 300', 'RX 350', 'RX 450h'],
  Lincoln: ['Aviator', 'Continental', 'Corsair', 'MKC', 'MKX', 'MKZ', 'Nautilus', 'Navigator'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-3', 'CX-5', 'CX-9', 'CX-30', 'CX-50', 'MX-5 Miata'],
  'Mercedes-Benz': ['C250', 'C300', 'C43 AMG', 'C63 AMG', 'CLA250', 'CLS550', 'E350', 'E400', 'E450', 'E63 AMG', 'G550', 'G63 AMG', 'GLA250', 'GLC300', 'GLE350', 'GLS450', 'S550', 'S560', 'S580', 'Sprinter'],
  MINI: ['Cooper', 'Clubman', 'Countryman'],
  Mitsubishi: ['Eclipse Cross', 'Lancer', 'Mirage', 'Outlander', 'Outlander Sport'],
  Nissan: ['Altima', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', '370Z'],
  Porsche: ['911', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  Ram: ['1500', '2500', '3500', 'ProMaster'],
  Subaru: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'WRX'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  Toyota: ['4Runner', 'Avalon', 'Camry', 'Corolla', 'Highlander', 'Land Cruiser', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Venza', 'Yaris'],
  Volkswagen: ['Atlas', 'Beetle', 'Golf', 'GTI', 'Jetta', 'Passat', 'Taos', 'Tiguan', 'Touareg'],
  Volvo: ['S60', 'S90', 'V60', 'XC40', 'XC60', 'XC90'],
};
export const makeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mercedes$/, 'mercedesbenz');
export function suggestions(value: string, options: string[]): string[] {
  const query = makeKey(value.trim());
  if (!query) return [];
  const unique = new Map<string, string>();
  for (const option of options) if (!unique.has(makeKey(option))) unique.set(makeKey(option), option);
  return [...unique.values()].filter(o => makeKey(o).startsWith(query) && makeKey(o) !== query).slice(0, 5);
}
