// Resets the database to a professional Japanese demo dataset.
// Usage (from /backend; the dev server may keep running):  node scripts/demo-data.mjs
//
// DELETES all vehicles, photos and parties, replaces the company profile, and adds demo users.
// Existing user accounts (e.g. your admin login) are kept.
// Everything here is fictional: company/party names, phone, 法人番号, registration and bank numbers
// use placeholder zeros. Real auction venues appear only as the venue name on a vehicle.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const { db, cleanVehicle, cleanParty, insertParty, assignInvoiceNo, UPLOAD_DIR } = await import('../lib/db.js');

const hash = pw => { const s = crypto.randomBytes(16).toString('hex'); return `${s}:${crypto.scryptSync(pw, s, 64).toString('hex')}`; };

// ---------------------------------------------------------------- company
const COMPANY = {
  name: '株式会社ハルカゼ自動車', name_kana: 'カブシキガイシャハルカゼジドウシャ', name_en: 'Harukaze Motors Co., Ltd.',
  tagline: 'Japanese used vehicles · Domestic sales & worldwide export', representative: '代表取締役 春風 大輔',
  country: 'Japan', postal_code: '231-0002', prefecture: 'Kanagawa', city: '横浜市中区', address: '海岸通1-2-3', building: 'ハルカゼビル 3F',
  phone: '045-000-0000', fax: '045-000-0001', email: 'sales@harukaze-motors.example', website: 'harukaze-motors.example',
  corporate_number: '0000000000000', invoice_reg_no: 'T0000000000000',
  antique_license: '第452000000000号', antique_license_authority: '神奈川県公安委員会', auction_memberships: 'USS 00000\nTAA 00000\nCAA 00000',
  bank_name: '横浜銀行', bank_branch: '本店', bank_branch_code: '100', account_type: 'Ordinary', account_no: '0000000',
  account_title: 'カ）ハルカゼジドウシャ', swift: 'HAMAJPJT',
  currency: 'JPY', invoice_prefix: 'HK', ntn: null,
  terms: [
    '車両は現状有姿での販売となります。 / Vehicles are sold on an "as is" basis.',
    'Payment in full by telegraphic transfer before shipment (export) or before delivery (domestic).',
    '名義変更・輸出抹消書類はご入金確認後に発行します。 / Documents are released after payment is confirmed.',
    'Prices for export are FOB Japan port unless stated otherwise.',
  ].join('\n'),
};

// ---------------------------------------------------------------- parties (all fictional)
const JP = { scope: 'Local', country: 'Japan', currency: 'JPY' };
const PARTIES = {
  // Sellers (Japan)
  toto: { ...JP, role: 'Seller', category: 'Agent', name: '株式会社東都オークション代行', name_kana: 'カブシキガイシャトウトオークションダイコウ', contact_person: '高橋 誠', designation: '営業課長',
    phone: '03-0000-1201', email: 'bid@toto-agent.example', postal_code: '135-0061', prefecture: 'Tokyo', city: '江東区', address: '豊洲3-0-0', corporate_number: '0000000000001',
    invoice_reg_no: 'T0000000000001', antique_license: '第301000000001号', antique_license_authority: '東京都公安委員会', auction_member_no: 'USS 00101 / TAA 00102',
    bank_name: 'みずほ銀行', bank_branch: '豊洲支店', bank_branch_code: '000', account_type: 'Current', account_no: '0000001', account_title: 'カ）トウトオークションダイコウ',
    notes: 'Bids on our behalf at USS, TAA and CAA. Fee ¥11,000 per car + auction fee.' },
  minato: { ...JP, role: 'Seller', category: 'Dealer', name: '有限会社みなと自動車商会', name_kana: 'ユウゲンガイシャミナトジドウシャショウカイ', contact_person: '伊藤 隆',
    phone: '045-000-2202', email: 'info@minato-jidosha.example', postal_code: '220-0012', prefecture: 'Kanagawa', city: '横浜市西区', address: 'みなとみらい2-0-0',
    corporate_number: '0000000000002', invoice_reg_no: 'T0000000000002', antique_license: '第452000000002号', antique_license_authority: '神奈川県公安委員会',
    bank_name: '横浜銀行', bank_branch: 'みなとみらい支店', bank_branch_code: '000', account_type: 'Ordinary', account_no: '0000002', account_title: 'ユ）ミナトジドウシャショウカイ' },
  hokushin: { ...JP, role: 'Seller', category: 'Company', name: '株式会社北辰リース', name_kana: 'カブシキガイシャホクシンリース', contact_person: '渡辺 由美', designation: '車両管理部',
    phone: '048-000-3303', email: 'fleet@hokushin-lease.example', postal_code: '330-0854', prefecture: 'Saitama', city: 'さいたま市大宮区', address: '桜木町1-0-0',
    corporate_number: '0000000000003', invoice_reg_no: 'T0000000000003', notes: 'Off-lease fleet vehicles, full service history.' },
  sakura: { ...JP, role: 'Both', category: 'Dealer', name: '株式会社さくら中古車センター', name_kana: 'カブシキガイシャサクラチュウコシャセンター', contact_person: '中島 浩二',
    phone: '06-0000-4404', email: 'trade@sakura-ucc.example', postal_code: '559-0034', prefecture: 'Osaka', city: '大阪市住之江区', address: '南港北1-0-0',
    corporate_number: '0000000000004', invoice_reg_no: 'T0000000000004', antique_license: '第621000000004号', antique_license_authority: '大阪府公安委員会', port: 'Osaka',
    bank_name: '三井住友銀行', bank_branch: '南港支店', bank_branch_code: '000', account_type: 'Ordinary', account_no: '0000004', account_title: 'カ）サクラチュウコシャセンター' },
  tanaka: { ...JP, role: 'Seller', category: 'Individual', name: '田中 健一', name_kana: 'タナカ ケンイチ', phone: '090-0000-5505',
    postal_code: '158-0094', prefecture: 'Tokyo', city: '世田谷区', address: '玉川2-0-0', id_type: "Driver's License 運転免許証", id_no: '000000005505', notes: 'Trade-in against a new purchase.' },
  // Buyers (Japan)
  green: { ...JP, role: 'Buyer', category: 'Dealer', name: '株式会社グリーンモータース', name_kana: 'カブシキガイシャグリーンモータース', contact_person: '加藤 大樹', designation: '仕入担当',
    phone: '052-000-6606', email: 'purchase@green-motors.example', postal_code: '455-0032', prefecture: 'Aichi', city: '名古屋市港区', address: '入船1-0-0',
    corporate_number: '0000000000006', invoice_reg_no: 'T0000000000006', antique_license: '第541000000006号', antique_license_authority: '愛知県公安委員会', credit_limit: 5000000 },
  hokuto: { ...JP, role: 'Buyer', category: 'Dealer', name: '有限会社カーステーション北斗', name_kana: 'ユウゲンガイシャカーステーションホクト', contact_person: '佐々木 亮',
    phone: '011-000-7707', email: 'info@cs-hokuto.example', postal_code: '060-0001', prefecture: 'Hokkaido', city: '札幌市中央区', address: '北一条西1-0-0',
    corporate_number: '0000000000007', invoice_reg_no: 'T0000000000007', antique_license: '第101000000007号', antique_license_authority: '北海道公安委員会', credit_limit: 3000000,
    notes: 'Prefers 4WD / AWD for Hokkaido winter market.' },
  rideshare: { ...JP, role: 'Buyer', category: 'Company', name: '株式会社ライドシェア九州', name_kana: 'カブシキガイシャライドシェアキュウシュウ', contact_person: '松本 恵',
    phone: '092-000-8808', email: 'fleet@rideshare-kyushu.example', postal_code: '812-0011', prefecture: 'Fukuoka', city: '福岡市博多区', address: '博多駅前2-0-0',
    corporate_number: '0000000000008', invoice_reg_no: 'T0000000000008', credit_limit: 8000000 },
  yamabiko: { ...JP, role: 'Buyer', category: 'Company', name: '株式会社やまびこ運送', name_kana: 'カブシキガイシャヤマビコウンソウ', contact_person: '小川 修',
    phone: '027-000-9909', email: 'office@yamabiko-unso.example', postal_code: '371-0024', prefecture: 'Gunma', city: '前橋市', address: '表町1-0-0',
    corporate_number: '0000000000009', invoice_reg_no: 'T0000000000009' },
  suzuki: { ...JP, role: 'Buyer', category: 'Individual', name: '鈴木 美咲', name_kana: 'スズキ ミサキ', phone: '080-0000-1010', email: 'misaki.s@mail.example',
    postal_code: '810-0001', prefecture: 'Fukuoka', city: '福岡市中央区', address: '天神3-0-0', id_type: "Driver's License 運転免許証", id_no: '000000001010' },
  sato: { ...JP, role: 'Buyer', category: 'Individual', name: '佐藤 翔太', name_kana: 'サトウ ショウタ', phone: '090-0000-1111',
    postal_code: '160-0022', prefecture: 'Tokyo', city: '新宿区', address: '新宿4-0-0', building: 'パークハイツ 502', id_type: "Driver's License 運転免許証", id_no: '000000001111' },
  // Buyers (international)
  mombasa: { role: 'Buyer', category: 'Company', scope: 'International', country: 'Kenya', city: 'Mombasa', port: 'Mombasa', currency: 'USD', name: 'Mombasa Motor Traders Ltd',
    contact_person: 'James Otieno', designation: 'Director', phone: '+254 700 000 001', whatsapp: '+254 700 000 001', email: 'imports@mombasa-motors.example',
    id_type: 'Company Reg', id_no: 'PVT-0000001', address: 'Moi Avenue, Plot 00', bank_name: 'Example Bank Kenya', swift: 'EXMPKENA', credit_limit: 10000000,
    notes: 'KEBS pre-shipment inspection required. Max 8 years old for Kenya.' },
  dar: { role: 'Buyer', category: 'Dealer', scope: 'International', country: 'Tanzania', city: 'Dar es Salaam', port: 'Dar es Salaam', currency: 'USD', name: 'Dar Auto Imports Co.',
    contact_person: 'Halima Mushi', phone: '+255 700 000 002', whatsapp: '+255 700 000 002', email: 'halima@dar-auto.example', id_type: 'Trade Licence', id_no: 'TL-0000002' },
  alnoor: { role: 'Buyer', category: 'Company', scope: 'International', country: 'United Arab Emirates', state: 'Dubai', city: 'Dubai', port: 'Jebel Ali', currency: 'USD',
    name: 'Al Noor Cars Trading LLC', contact_person: 'Omar Haddad', designation: 'Purchasing Manager', phone: '+971 50 000 0003', email: 'omar@alnoor-cars.example',
    id_type: 'Trade Licence', id_no: 'DED-0000003', bank_name: 'Example Bank UAE', iban: 'AE000000000000000000003', swift: 'EXMPAEAD', credit_limit: 15000000 },
  lahore: { role: 'Buyer', category: 'Dealer', scope: 'International', country: 'Pakistan', state: 'Sindh', city: 'Karachi', port: 'Karachi', currency: 'USD',
    name: 'Indus Auto Hub (Pvt) Ltd', contact_person: 'Bilal Ahmed', phone: '+92 300 0000004', whatsapp: '+92 300 0000004', email: 'bilal@indus-auto.example', ntn: '0000004-0' },
  colombo: { role: 'Buyer', category: 'Company', scope: 'International', country: 'Sri Lanka', city: 'Colombo', port: 'Colombo', currency: 'USD',
    name: 'Colombo Prime Vehicles (Pvt) Ltd', contact_person: 'Nuwan Perera', phone: '+94 77 000 0005', email: 'nuwan@colomboprime.example', id_type: 'Company Reg', id_no: 'PV-0000005' },
  andes: { role: 'Buyer', category: 'Company', scope: 'International', country: 'Chile', city: 'Iquique', port: 'Iquique', currency: 'USD',
    name: 'Andes Import SpA', contact_person: 'Camila Rojas', phone: '+56 9 0000 0006', email: 'camila@andesimport.example', ntn: '00.000.006-K' },
  kiwi: { role: 'Buyer', category: 'Dealer', scope: 'International', country: 'New Zealand', city: 'Auckland', port: 'Auckland', currency: 'NZD',
    name: 'Kiwi Car Importers Ltd', contact_person: 'Sarah Mitchell', phone: '+64 21 000 0007', email: 'sarah@kiwicar.example', id_type: 'Company Reg', id_no: 'NZ-0000007',
    notes: 'Requires MPI biosecurity cleaning and JEVIC inspection.' },
  mongol: { role: 'Buyer', category: 'Company', scope: 'International', country: 'Mongolia', city: 'Ulaanbaatar', port: 'Tianjin (transit)', currency: 'USD',
    name: 'Ulaanbaatar Motors LLC', contact_person: 'Bat-Erdene Tsogt', phone: '+976 9900 0008', email: 'bat@ub-motors.example', id_type: 'Company Reg', id_no: 'MN-0000008' },
};

// ---------------------------------------------------------------- vehicles
// [stock, make, model, variant, year, chassis, color, km, cc, fuel, trans, body, drive, seats,
//  grade, interior, venue, lot, bought, price, repair, sellerKey, status, asking, sale]
// sale = [type, date, price, expense, buyerKey, paidRatio, payment]
const V = [
  ['HK-2605-001', 'Toyota', 'Prius', 'S Safety Plus', 2017, 'ZVW50-0000101', 'Pearl White', 58400, 1800, 'Hybrid', 'CVT', 'Hatchback', 'FWD', 5, '4.5', 'B', 'USS Tokyo', '10234', '2026-05-07', 980000, 0, 'toto', 'Sold', null, ['Export', '2026-06-04', 1240000, 52000, 'mombasa', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2605-002', 'Toyota', 'Aqua', 'G', 2016, 'NHP10-0000102', 'Silver Metallic', 71200, 1500, 'Hybrid', 'CVT', 'Hatchback', 'FWD', 5, '4', 'B', 'TAA Kinki', '30511', '2026-05-09', 520000, 18000, 'toto', 'Sold', null, ['Export', '2026-06-11', 690000, 48000, 'dar', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2605-003', 'Toyota', 'Land Cruiser Prado', 'TX L Package 7-seat', 2018, 'TRJ150W-0000103', 'Black', 64800, 2700, 'Petrol', 'Automatic', 'SUV', '4WD', 7, '4.5', 'A', 'USS Nagoya', '51207', '2026-05-12', 3650000, 25000, 'toto', 'Sold', null, ['Export', '2026-06-20', 4280000, 88000, 'alnoor', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2605-004', 'Toyota', 'Hiace', 'Super GL Dark Prime II', 2019, 'GDH201V-0000104', 'White', 88300, 2800, 'Diesel', 'Automatic', 'Van', '2WD', 5, '4', 'B', 'USS Yokohama', '22018', '2026-05-15', 2780000, 30000, 'hokushin', 'Sold', null, ['Local', '2026-06-08', 3190000, 33000, 'yamabiko', 1, 'Bank Transfer']],
  ['HK-2605-005', 'Honda', 'Fit', 'Hybrid L Honda Sensing', 2018, 'GP5-0000105', 'Premium Blue', 44100, 1500, 'Hybrid', 'DCT', 'Hatchback', 'FWD', 5, '4.5', 'A', 'CAA Chubu', '11402', '2026-05-18', 860000, 0, 'toto', 'Sold', null, ['Local', '2026-06-15', 1080000, 22000, 'suzuki', 1, 'Bank Transfer']],
  ['HK-2605-006', 'Nissan', 'X-Trail', '20Xi Hybrid 4WD', 2018, 'HNT32-0000106', 'Brilliant Silver', 76500, 2000, 'Hybrid', 'CVT', 'SUV', '4WD', 5, '3.5', 'C', 'USS Tokyo', '18866', '2026-05-22', 1420000, 65000, 'toto', 'Sold', null, ['Local', '2026-07-03', 1720000, 26000, 'hokuto', 1, 'Bank Transfer']],
  ['HK-2606-007', 'Mazda', 'CX-5', 'XD L Package', 2018, 'KF2P-0000107', 'Soul Red Crystal', 62000, 2200, 'Diesel', 'Automatic', 'SUV', '2WD', 5, '4', 'B', 'HAA Kobe', '40355', '2026-06-02', 1580000, 22000, 'sakura', 'Sold', null, ['Export', '2026-07-09', 1890000, 61000, 'colombo', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2606-008', 'Toyota', 'Alphard', '2.5S C Package', 2018, 'AGH30W-0000108', 'Black', 69800, 2500, 'Petrol', 'CVT', 'Mini Van', '2WD', 7, '4.5', 'A', 'USS Nagoya', '52740', '2026-06-05', 3380000, 0, 'toto', 'Sold', null, ['Export', '2026-07-18', 3920000, 92000, 'alnoor', 0.7, 'Telegraphic Transfer (TT)']],
  ['HK-2606-009', 'Honda', 'Vezel', 'Hybrid Z Honda Sensing', 2019, 'RU3-0000109', 'Crystal Black Pearl', 38700, 1500, 'Hybrid', 'DCT', 'Crossover', 'FWD', 5, '5', 'A', 'TAA Kinki', '31890', '2026-06-09', 1690000, 0, 'toto', 'Sold', null, ['Local', '2026-07-01', 1980000, 24000, 'green', 1, 'Bank Transfer']],
  ['HK-2606-010', 'Suzuki', 'Jimny', 'XC', 2020, 'JB64W-0000110', 'Jungle Green', 21500, 660, 'Petrol', 'Automatic', 'SUV', '4WD', 4, '5', 'A', 'USS Tokyo', '19920', '2026-06-12', 1740000, 0, 'tanaka', 'Sold', null, ['Local', '2026-06-27', 2050000, 18000, 'sato', 1, 'Bank Transfer']],
  ['HK-2606-011', 'Mitsubishi', 'Delica D:5', 'G Power Package', 2017, 'CV1W-0000111', 'Warm White Pearl', 92400, 2200, 'Diesel', 'Automatic', 'Mini Van', '4WD', 8, '3.5', 'B', 'CAA Chubu', '12088', '2026-06-16', 1890000, 85000, 'minato', 'Sold', null, ['Export', '2026-08-06', 2080000, 70000, 'mongol', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2606-012', 'Lexus', 'RX450h', 'Version L', 2017, 'GYL25W-0000112', 'Sonic Titanium', 81200, 3500, 'Hybrid', 'CVT', 'SUV', 'AWD', 5, '4', 'B', 'USS Yokohama', '23345', '2026-06-22', 2950000, 48000, 'toto', 'Sold', null, ['Export', '2026-08-12', 3180000, 95000, 'lahore', 0.5, 'Letter of Credit (LC)']],
  ['HK-2607-013', 'Toyota', 'Corolla Fielder', 'Hybrid G W×B', 2018, 'NKE165G-0000113', 'White Pearl', 66300, 1500, 'Hybrid', 'CVT', 'Wagon', 'FWD', 5, '4', 'B', 'USS Tokyo', '14567', '2026-07-03', 920000, 15000, 'toto', 'Sold', null, ['Export', '2026-08-01', 1160000, 50000, 'dar', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2607-014', 'Nissan', 'Note', 'e-Power Medalist', 2019, 'HE12-0000114', 'Garnet Red', 34200, 1200, 'Hybrid', 'Automatic', 'Hatchback', 'FWD', 5, '4.5', 'A', 'TAA Kinki', '33012', '2026-07-07', 980000, 0, 'toto', 'Sold', null, ['Local', '2026-08-03', 1210000, 20000, 'rideshare', 1, 'Bank Transfer']],
  ['HK-2607-015', 'Subaru', 'Forester', 'X-Break EyeSight', 2018, 'SJ5-0000115', 'Crystal White Pearl', 59800, 2000, 'Petrol', 'CVT', 'SUV', 'AWD', 5, '4', 'B', 'USS Nagoya', '53188', '2026-07-10', 1460000, 28000, 'sakura', 'Sold', null, ['Local', '2026-08-22', 1720000, 25000, 'hokuto', 0.6, 'Bank Transfer']],
  ['HK-2607-016', 'Toyota', 'Hilux', 'Z 4WD Double Cab', 2019, 'GUN125-0000116', 'Super White II', 47600, 2400, 'Diesel', 'Automatic', 'Pickup', '4WD', 5, '4.5', 'A', 'CAA Chubu', '13511', '2026-07-14', 3120000, 0, 'toto', 'Sold', null, ['Export', '2026-08-28', 3560000, 90000, 'mombasa', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2607-017', 'Mazda', 'Demio', 'XD Touring', 2017, 'DJ5FS-0000117', 'Machine Grey', 83900, 1500, 'Diesel', 'Automatic', 'Hatchback', 'FWD', 5, 'R', 'C', 'HAA Kobe', '41022', '2026-07-18', 390000, 120000, 'sakura', 'Sold', null, ['Export', '2026-09-04', 480000, 42000, 'andes', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2608-018', 'Toyota', 'Harrier', 'Z Leather Package', 2020, 'MXUA80-0000118', 'Precious Black Pearl', 29800, 2000, 'Petrol', 'CVT', 'SUV', '2WD', 5, '5', 'A', 'USS Tokyo', '16789', '2026-08-04', 3480000, 0, 'toto', 'Sold', null, ['Export', '2026-09-15', 3980000, 98000, 'kiwi', 1, 'Telegraphic Transfer (TT)']],
  ['HK-2608-019', 'Honda', 'Freed', 'Hybrid G Honda Sensing', 2017, 'GB7-0000119', 'Platinum White Pearl', 73400, 1500, 'Hybrid', 'DCT', 'Mini Van', 'FWD', 6, '4', 'B', 'USS Yokohama', '24480', '2026-08-08', 940000, 24000, 'hokushin', 'Sold', null, ['Local', '2026-09-10', 1150000, 22000, 'rideshare', 1, 'Bank Transfer']],
  ['HK-2608-020', 'Toyota', 'Crown', 'RS Advance Hybrid', 2019, 'AZSH20-0000120', 'Precious Galaxy', 41200, 2500, 'Hybrid', 'CVT', 'Sedan', '2WD', 5, '4.5', 'A', 'USS Nagoya', '54012', '2026-08-12', 2860000, 0, 'toto', 'Sold', null, ['Local', '2026-09-24', 3080000, 28000, 'green', 0.5, 'Bank Transfer']],
  ['HK-2608-021', 'Isuzu', 'Elf', '2t Flat Deck NKR85', 2016, 'NKR85A-0000121', 'White', 148000, 3000, 'Diesel', 'Manual', 'Truck', '2WD', 3, '3.5', 'C', 'TAA Kinki', '34501', '2026-08-18', 1620000, 140000, 'minato', 'Sold', null, ['Local', '2026-09-30', 1680000, 30000, 'yamabiko', 1, 'Bank Transfer']],
  ['HK-2609-022', 'Toyota', 'Land Cruiser', 'ZX 4WD', 2019, 'URJ202W-0000122', 'White Pearl', 52300, 4600, 'Petrol', 'Automatic', 'SUV', '4WD', 8, '4.5', 'A', 'USS Tokyo', '17222', '2026-09-03', 6980000, 0, 'toto', 'Sold', null, ['Export', '2026-10-09', 7650000, 140000, 'alnoor', 0.5, 'Telegraphic Transfer (TT)']],
  ['HK-2609-023', 'Toyota', 'Noah', 'Si W×B', 2018, 'ZRR80W-0000123', 'Black', 68100, 2000, 'Petrol', 'CVT', 'Mini Van', '2WD', 7, '4', 'B', 'CAA Chubu', '14920', '2026-09-08', 1580000, 26000, 'toto', 'Sold', null, ['Export', '2026-10-14', 1840000, 66000, 'colombo', 1, 'Telegraphic Transfer (TT)']],
  // Unsold stock
  ['HK-2609-024', 'Daihatsu', 'Tanto', 'Custom RS Top Edition', 2019, 'LA650S-0000124', 'Pearl White III', 31800, 660, 'Petrol', 'CVT', 'Hatchback', 'FWD', 4, '4.5', 'A', 'USS Yokohama', '25511', '2026-09-12', 980000, 0, 'tanaka', 'Reserved', 1190000],
  ['HK-2609-025', 'Nissan', 'Serena', 'e-Power Highway Star V', 2018, 'HFC27-0000125', 'Brilliant White Pearl', 57900, 1200, 'Hybrid', 'Automatic', 'Mini Van', 'FWD', 8, '4', 'B', 'USS Tokyo', '18050', '2026-09-18', 1720000, 32000, 'toto', 'In Stock', 2060000],
  ['HK-2610-026', 'Honda', 'N-BOX', 'Custom G-L Honda Sensing', 2020, 'JF3-0000126', 'Premium Sunlight White', 24600, 660, 'Petrol', 'CVT', 'Hatchback', 'FWD', 4, '5', 'A', 'TAA Kinki', '35118', '2026-10-02', 1280000, 0, 'toto', 'In Stock', 1480000],
  ['HK-2610-027', 'Suzuki', 'Swift', 'RS Safety Package', 2018, 'ZC83S-0000127', 'Speedy Blue', 49300, 1200, 'Petrol', 'CVT', 'Hatchback', 'FWD', 5, '4', 'B', 'HAA Kobe', '42288', '2026-10-06', 620000, 18000, 'sakura', 'In Stock', 780000],
  ['HK-2610-028', 'Toyota', 'Alphard', '2.5S C Package', 2019, 'AGH30W-0000128', 'White Pearl', 54200, 2500, 'Petrol', 'CVT', 'Mini Van', '2WD', 7, '4.5', 'A', 'USS Nagoya', '55102', '2026-10-15', 3720000, 0, 'toto', 'Reserved', 4290000],
  ['HK-2610-029', 'Toyota', 'Prius', 'A Premium', 2019, 'ZVW51-0000129', 'Emotional Red II', 36800, 1800, 'Hybrid', 'CVT', 'Hatchback', 'FWD', 5, '4.5', 'A', 'USS Tokyo', '19603', '2026-10-21', 1490000, 0, 'toto', 'In Transit', 1790000],
  ['HK-2610-030', 'Mitsubishi', 'Outlander PHEV', 'G Premium Package', 2018, 'GG2W-0000130', 'Ruby Black Pearl', 61500, 2000, 'Hybrid', 'Automatic', 'SUV', '4WD', 5, '4', 'B', 'CAA Chubu', '15377', '2026-10-24', 1680000, 0, 'toto', 'In Transit', 2010000],
];

const FEATURES = {
  Hybrid: 'Navigation, back camera, smart key, LED headlights, cruise control, ETC',
  SUV: 'Navigation, 360° camera, leather seats, sunroof, power tailgate, ETC',
  'Mini Van': 'Twin power sliding doors, rear entertainment, navigation, back camera, ETC',
  default: 'Navigation, back camera, smart key, ETC, alloy wheels',
};
const REMARKS = ['Clean, no remarks', 'A1 small scratch rear bumper', 'U1 small dent left rear door, A1 front bumper', 'W1 wave right front fender, A2 bonnet',
  'Interior: minor seat wear (B)', 'XX replaced windscreen chip', 'Repaired: right quarter panel (R grade)'];

// ---------------------------------------------------------------- reset & load
const yen = n => Math.round(n / 1000) * 1000;

db.transaction(() => {
  db.prepare('DELETE FROM vehicle_images').run();
  db.prepare('DELETE FROM vehicles').run();
  db.prepare('DELETE FROM parties').run();

  // Company (columns that exist on this install)
  const cols = new Set(db.prepare('PRAGMA table_info(company)').all().map(c => c.name));
  const entries = Object.entries(COMPANY).filter(([k]) => cols.has(k));
  db.prepare(`UPDATE company SET ${entries.map(([k]) => `${k}=?`).join(',')}, updated_at=datetime('now') WHERE id=1`).run(...entries.map(([, v]) => v));

  // Parties
  const ids = {};
  for (const [key, p] of Object.entries(PARTIES)) ids[key] = insertParty(cleanParty(p));
  const party = key => db.prepare('SELECT * FROM parties WHERE id = ?').get(ids[key]);

  // Vehicles
  const insert = data => {
    const id = crypto.randomUUID();
    const cols2 = Object.keys(data);
    db.prepare(`INSERT INTO vehicles (id, ${cols2.join(',')}, created_at) VALUES (?, ${cols2.map(() => '?').join(',')}, ?)`)
      .run(id, ...cols2.map(c => data[c]), `${data.purchase_date} 09:00:00`);
    assignInvoiceNo(id);
  };

  V.forEach((r, i) => {
    const [stock_no, make, model, variant, year, chassis_no, color, mileage, engine_cc, fuel, transmission, body_type, drive, seats,
      auction_grade, interior_grade, venue, lot_no, purchase_date, purchase_price, repair_cost, sellerKey, status, asking, sale] = r;
    const seller = party(sellerKey);
    const viaAuction = seller.category === 'Agent';
    const v = {
      stock_no, make, model, variant, year, reg_year: year, chassis_no, engine_no: `${chassis_no.split('-')[0].replace(/[A-Z]+$/, '')}-E${String(100000 + i * 7919).slice(-6)}`,
      color, mileage, engine_cc, fuel, transmission, body_type, drive, seats, doors: body_type === 'Truck' ? 2 : body_type === 'Pickup' ? 4 : 5,
      steering: 'Right', condition: 'Used', features: FEATURES[fuel] && body_type !== 'SUV' && body_type !== 'Mini Van' ? FEATURES[fuel] : FEATURES[body_type] || FEATURES.default,
      purchase_date, purchase_source: viaAuction ? 'Auction' : sellerKey === 'tanaka' ? 'Trade-in' : 'Local Dealer',
      supplier: seller.name, seller_party_id: seller.id,
      auction_house: viaAuction ? venue : null, lot_no: viaAuction ? lot_no : null, auction_date: viaAuction ? purchase_date : null,
      auction_grade: viaAuction || sellerKey === 'sakura' ? auction_grade : null,
      interior_grade: viaAuction || sellerKey === 'sakura' ? interior_grade : null,
      exterior_grade: viaAuction ? (auction_grade === 'R' ? 'C' : interior_grade) : null,
      auction_remarks: viaAuction ? (auction_grade === 'R' ? REMARKS[6] : REMARKS[i % 6]) : null,
      purchase_price,
      freight_cost: yen(12000 + (i % 5) * 4000),                         // 陸送 auction → yard
      duty_tax: yen(9000 + (engine_cc > 2500 ? 9000 : engine_cc > 1500 ? 5000 : 2000)), // リサイクル料金 etc.
      repair_cost,
      other_cost: viaAuction ? 11000 + 11000 : 5000,                       // auction + agent fees
      status, location: status === 'In Transit' ? `陸送中 (${venue} → 横浜ヤード)` : '横浜ヤード',
      asking_price: asking ?? (sale ? sale[2] : null),
      notes: i % 7 === 3 ? 'Service records available. Two keys.' : null,
    };
    if (sale) {
      const [sale_type, sale_date, sale_price, sale_expense, buyerKey, paid, payment_method] = sale;
      const b = party(buyerKey);
      const intl = b.scope === 'International';
      Object.assign(v, {
        sale_type, sale_date, sale_price, sale_expense, payment_method, buyer_party_id: b.id,
        buyer_name: b.name, buyer_contact: [b.phone, b.email].filter(Boolean).join(' · '),
        buyer_id_no: b.corporate_number ? `法人番号: ${b.corporate_number}` : [b.id_type, b.id_no].filter(Boolean).join(': ') || null,
        buyer_address: intl ? [b.address, b.city, b.country].filter(Boolean).join(', ')
          : [b.postal_code && `〒${b.postal_code}`, b.prefecture, b.city, b.address, b.building].filter(Boolean).join(' '),
        destination_country: intl ? b.country : null, port: intl ? b.port : null,
        shipping_ref: intl ? `HKBL${sale_date.replace(/-/g, '').slice(2)}${String(i).padStart(2, '0')}` : null,
        amount_received: yen(sale_price * paid),
        sale_notes: intl ? 'FOB Yokohama. JEVIC pre-shipment inspection included.' : '名義変更手続き代行込み',
      });
    }
    insert(cleanVehicle(v));
  });

  // Demo users (password: demo1234) — skipped if the email already exists
  const users = [
    ['山本 拓也', 'manager@harukaze.example', 'Manager'],
    ['中村 さくら', 'sales@harukaze.example', 'Sales'],
    ['小林 誠', 'viewer@harukaze.example', 'Viewer'],
  ];
  for (const [name, email, role] of users) {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) continue;
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), name, email, hash('demo1234'), role);
  }
})();

// Uploaded files belonged to the deleted vehicles
let removed = 0;
for (const f of fs.readdirSync(UPLOAD_DIR)) { fs.unlinkSync(path.join(UPLOAD_DIR, f)); removed++; }

const n = q => db.prepare(q).get().n;
console.log(`Demo data loaded:
  company   ${COMPANY.name} / ${COMPANY.name_en}
  parties   ${n('SELECT COUNT(*) n FROM parties')} (${n("SELECT COUNT(*) n FROM parties WHERE scope='Local'")} Japan, ${n("SELECT COUNT(*) n FROM parties WHERE scope='International'")} international)
  vehicles  ${n('SELECT COUNT(*) n FROM vehicles')} (${n("SELECT COUNT(*) n FROM vehicles WHERE status='Sold'")} sold, ${n("SELECT COUNT(*) n FROM vehicles WHERE status<>'Sold'")} in stock)
  files     ${removed} old uploads removed
  users     demo logins: manager@ / sales@ / viewer@harukaze.example  (password demo1234)`);
