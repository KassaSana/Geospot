// Pet, avatar and background images ship with the app.
// Accounts made before that saved Cloudinary URLs for them, so those URLs map to the local copies.

const PETS = {
  'pet-01': require('./assets/pets/pet-01.png'),
  'pet-02': require('./assets/pets/pet-02.png'),
  'pet-03': require('./assets/pets/pet-03.png'),
  'pet-04': require('./assets/pets/pet-04.png'),
  'pet-05': require('./assets/pets/pet-05.png'),
  'pet-06': require('./assets/pets/pet-06.png'),
  'pet-07': require('./assets/pets/pet-07.png'),
  'pet-08': require('./assets/pets/pet-08.png'),
  'pet-09': require('./assets/pets/pet-09.png'),
  'pet-10': require('./assets/pets/pet-10.png'),
  'pet-11': require('./assets/pets/pet-11.png'),
  'pet-12': require('./assets/pets/pet-12.png'),
  'pet-13': require('./assets/pets/pet-13.png'),
  'pet-14': require('./assets/pets/pet-14.png'),
  'pet-15': require('./assets/pets/pet-15.png'),
  'pet-16': require('./assets/pets/pet-16.png'),
};

export const PET_IDS = Object.keys(PETS);
export const DEFAULT_AVATAR = require('./assets/default-avatar.png');
export const PET_BACKGROUND = require('./assets/pet-background.jpg');

const LEGACY_DEFAULT_AVATAR = 'jxz9tcyulimodvceq47f';
const LEGACY_PETS = {
  kispd3yrq5srohe7igiq: 'pet-01',
  ge9k5tou73ewuklcqm50: 'pet-02',
  febrt8lvztd9bdvcevvj: 'pet-03',
  vuq0uiogmwpwphu3ojjv: 'pet-04',
  as5jwm7hmqfjspkwa3ng: 'pet-05',
  d8igeytxubnh7uzxtloy: 'pet-06',
  cd0bu5tv2hjpdnkhqpt0: 'pet-07',
  eetdplixjfmwc9x3rswt: 'pet-08',
  o0jznyskonwlv760motq: 'pet-09',
  gjtdrsiqb2ayh1fgypp7: 'pet-10',
  mbz3e9xlteajf4c4amet: 'pet-11',
  bppokd0ezyxaszydnsij: 'pet-12',
  iaki2kcykalwspdupf3u: 'pet-13',
  gsljngkr400tywz3ailf: 'pet-14',
  fedgeubk3m8yr8qjqbac: 'pet-15',
  grrisvojafjgzctdpxu5: 'pet-16',
};

// "https://res.cloudinary.com/dbmpdoet6/image/upload/v123/abc.png" -> "abc"
const legacyImageId = (url) => url?.match(/res\.cloudinary\.com\/dbmpdoet6\/.*\/([a-z0-9]+)\.png$/)?.[1];

// Image source for a saved pet: a pet id, or a Cloudinary URL from an older account
export function petImage(pet) {
  const id = PETS[pet] ? pet : LEGACY_PETS[legacyImageId(pet)];
  return PETS[id] ?? PETS['pet-01'];
}

// Image source for a profile picture URL, falling back to the default avatar
export function avatarImage(url) {
  if (!url || legacyImageId(url) === LEGACY_DEFAULT_AVATAR) {
    return DEFAULT_AVATAR;
  }
  return { uri: url };
}
