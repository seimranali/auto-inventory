// Change to your currency code (e.g. PKR, USD, JPY, AED)
export const CURRENCY = 'PKR';

// Printed on the sale invoice header — edit to your company's details
export const COMPANY = {
  name: 'Auto Inventory Motors',
  tagline: 'Import · Local Sale · Export',
  address: 'Showroom address, City, Country',
  phone: '+92 300 0000000',
  email: 'sales@example.com',
  terms: [
    'Vehicle is sold on an "as is, where is" basis after inspection by the buyer.',
    'Ownership and documents will be transferred after full payment is received.',
    'Payments once received are non-refundable.',
  ],
};

// Parties (buyers & sellers)
export const PARTY_ROLES = ['Buyer', 'Seller', 'Both'];
export const PARTY_CATEGORIES = ['Individual', 'Company', 'Dealer', 'Auction House', 'Agent'];
export const PARTY_SCOPES = ['Local', 'International'];
export const ID_TYPES = {
  Local: ['CNIC', 'NTN', 'Company Reg', 'Driving Licence'],
  International: ['Passport', 'Company Reg', 'Trade Licence', 'Emirates ID', 'Tax ID / VAT', 'National ID'],
};
export const COUNTRY_OPTIONS = [
  ['Pakistan', 'Asia'], ['Japan', 'Asia'], ['United Arab Emirates', 'Middle East'], ['Saudi Arabia', 'Middle East'], ['Oman', 'Middle East'],
  ['Qatar', 'Middle East'], ['Afghanistan', 'Asia'], ['Sri Lanka', 'Asia'], ['Bangladesh', 'Asia'], ['Mongolia', 'Asia'], ['Thailand', 'Asia'],
  ['Kenya', 'Africa'], ['Tanzania', 'Africa'], ['Uganda', 'Africa'], ['Zambia', 'Africa'], ['Mozambique', 'Africa'], ['South Africa', 'Africa'],
  ['United Kingdom', 'Europe'], ['Russia', 'Europe'], ['Cyprus', 'Europe'], ['New Zealand', 'Oceania'], ['Australia', 'Oceania'],
  ['Jamaica', 'Americas'], ['Chile', 'Americas'], ['United States', 'Americas'], ['Canada', 'Americas'],
].map(([value, group]) => ({ value, label: value, group }));

// Japan: 47 prefectures (都道府県) grouped by region, in the standard JIS order
export const JP_PREFECTURES = [
  ['Hokkaido', '北海道', 'Hokkaido'],
  ['Aomori', '青森県', 'Tohoku'], ['Iwate', '岩手県', 'Tohoku'], ['Miyagi', '宮城県', 'Tohoku'], ['Akita', '秋田県', 'Tohoku'], ['Yamagata', '山形県', 'Tohoku'], ['Fukushima', '福島県', 'Tohoku'],
  ['Ibaraki', '茨城県', 'Kanto'], ['Tochigi', '栃木県', 'Kanto'], ['Gunma', '群馬県', 'Kanto'], ['Saitama', '埼玉県', 'Kanto'], ['Chiba', '千葉県', 'Kanto'], ['Tokyo', '東京都', 'Kanto'], ['Kanagawa', '神奈川県', 'Kanto'],
  ['Niigata', '新潟県', 'Chubu'], ['Toyama', '富山県', 'Chubu'], ['Ishikawa', '石川県', 'Chubu'], ['Fukui', '福井県', 'Chubu'], ['Yamanashi', '山梨県', 'Chubu'], ['Nagano', '長野県', 'Chubu'], ['Gifu', '岐阜県', 'Chubu'], ['Shizuoka', '静岡県', 'Chubu'], ['Aichi', '愛知県', 'Chubu'],
  ['Mie', '三重県', 'Kansai'], ['Shiga', '滋賀県', 'Kansai'], ['Kyoto', '京都府', 'Kansai'], ['Osaka', '大阪府', 'Kansai'], ['Hyogo', '兵庫県', 'Kansai'], ['Nara', '奈良県', 'Kansai'], ['Wakayama', '和歌山県', 'Kansai'],
  ['Tottori', '鳥取県', 'Chugoku'], ['Shimane', '島根県', 'Chugoku'], ['Okayama', '岡山県', 'Chugoku'], ['Hiroshima', '広島県', 'Chugoku'], ['Yamaguchi', '山口県', 'Chugoku'],
  ['Tokushima', '徳島県', 'Shikoku'], ['Kagawa', '香川県', 'Shikoku'], ['Ehime', '愛媛県', 'Shikoku'], ['Kochi', '高知県', 'Shikoku'],
  ['Fukuoka', '福岡県', 'Kyushu & Okinawa'], ['Saga', '佐賀県', 'Kyushu & Okinawa'], ['Nagasaki', '長崎県', 'Kyushu & Okinawa'], ['Kumamoto', '熊本県', 'Kyushu & Okinawa'],
  ['Oita', '大分県', 'Kyushu & Okinawa'], ['Miyazaki', '宮崎県', 'Kyushu & Okinawa'], ['Kagoshima', '鹿児島県', 'Kyushu & Okinawa'], ['Okinawa', '沖縄県', 'Kyushu & Okinawa'],
].map(([value, jp, group]) => ({ value, label: `${value} ${jp}`, group }));

// Japanese ID documents. My Number (個人番号) is deliberately excluded: storing it is restricted by law.
export const JP_ID_TYPES = ['Corporate Number 法人番号', "Driver's License 運転免許証", 'Residence Card 在留カード', 'Passport 旅券', 'Health Insurance Card 保険証'];
export const JP_ACCOUNT_TYPES = [
  { value: 'Ordinary', label: 'Ordinary 普通' }, { value: 'Current', label: 'Current 当座' }, { value: 'Savings', label: 'Savings 貯蓄' },
];
export const JP_PORTS = ['Yokohama', 'Kobe', 'Nagoya', 'Osaka', 'Kawasaki', 'Tokyo', 'Hakata', 'Kitakyushu', 'Toyama (Fushiki)', 'Moji', 'Tomakomai', 'Kisarazu'];

// Accounts
export const EXPENSE_CATEGORIES = ['Rent', 'Salaries & Wages', 'Utilities', 'Fuel', 'Transport & Towing', 'Auction Fees', 'Repairs & Maintenance',
  'Office Supplies', 'Phone & Internet', 'Insurance', 'Taxes & Licences', 'Bank Charges', 'Advertising', 'Meals & Entertainment', 'Other'];
export const EXPENSE_ACCOUNTS = ['Cash', 'Credit Card'];

export const PAYMENT_METHODS =['Cash', 'Bank Transfer', 'Cheque', 'Pay Order', 'Telegraphic Transfer (TT)', 'Letter of Credit (LC)', 'Installments'];

export const STATUSES = ['In Transit', 'In Stock', 'Reserved', 'Sold'];
export const SALE_TYPES = ['Local', 'Export'];
export const PURCHASE_SOURCES = ['Auction', 'Local Dealer', 'Individual', 'Import', 'Trade-in'];
export const CONDITIONS = ['Used', 'New', 'Reconditioned'];
export const FUELS = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'CNG', 'LPG'];
export const TRANSMISSIONS = ['Automatic', 'Manual', 'CVT', 'DCT'];
export const BODY_TYPES = ['Sedan', 'Hatchback', 'SUV', 'Crossover', 'Van', 'Mini Van', 'Pickup', 'Truck', 'Coupe', 'Wagon', 'Bus'];
export const DRIVES = ['2WD', 'FWD', 'RWD', '4WD', 'AWD'];
export const STEERING = ['Right', 'Left'];

// Japanese auction-sheet overall grades, best to worst
export const AUCTION_GRADES = ['S', '6', '5', '4.5', '4', '3.5', '3', '2', '1', 'R', 'RA', '0'];
export const INTERIOR_GRADES = ['A', 'B', 'C', 'D', 'E'];
export const EXTERIOR_GRADES = ['A', 'B', 'C', 'D', 'E'];

// Grouped option sets for <Dropdown>
const gradeGroup = g => (['S', '6', '5'].includes(g) ? 'Excellent' : ['4.5', '4'].includes(g) ? 'Good'
  : ['3.5', '3'].includes(g) ? 'Average' : ['R', 'RA'].includes(g) ? 'Repaired / Accident' : 'Poor / Damaged');
export const AUCTION_GRADE_OPTIONS = AUCTION_GRADES.map(g => ({ value: g, label: g, group: gradeGroup(g), description: undefined }));

const MAKE_ORIGIN = {
  Japanese: ['Toyota', 'Honda', 'Nissan', 'Suzuki', 'Mazda', 'Mitsubishi', 'Subaru', 'Daihatsu', 'Lexus', 'Isuzu', 'Hino', 'Infiniti'],
  Korean: ['Hyundai', 'Kia', 'Genesis'],
  European: ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Porsche', 'Land Rover', 'Volvo', 'Peugeot'],
  Chinese: ['Changan', 'MG', 'Haval', 'Chery', 'BYD', 'Proton'],
  American: ['Ford', 'Chevrolet', 'Jeep', 'Tesla'],
};
export const MAKE_OPTIONS = Object.entries(MAKE_ORIGIN).flatMap(([group, makes]) => makes.map(m => ({ value: m, label: m, group })));

const BODY_GROUP = { Sedan: 'Cars', Hatchback: 'Cars', Coupe: 'Cars', Wagon: 'Cars', SUV: 'SUV & Van', Crossover: 'SUV & Van',
  Van: 'SUV & Van', 'Mini Van': 'SUV & Van', Pickup: 'Commercial', Truck: 'Commercial', Bus: 'Commercial' };
export const BODY_TYPE_OPTIONS = BODY_TYPES.map(b => ({ value: b, label: b, group: BODY_GROUP[b] }));

export const GRADE_HELP = {
  S: 'New / brand new condition', 6: 'Nearly new', 5: 'Excellent, very low mileage', 4.5: 'Very good condition',
  4: 'Good condition, minor marks', 3.5: 'Average, some repairs needed', 3: 'Below average, noticeable damage',
  2: 'Poor condition', 1: 'Very poor / modified', R: 'Repaired accident history', RA: 'Minor repaired accident', 0: 'Damaged / as-is',
};
AUCTION_GRADE_OPTIONS.forEach(o => { o.description = GRADE_HELP[o.value]; });
