// English source text → Japanese. Missing keys fall back to English.
// Car-trade terms follow common Japanese dealer / auction usage.
const JA = {
  // ---- App shell ----
  'Auto Inventory': 'オートインベントリー',
  Dashboard: 'ダッシュボード', Inventory: '在庫一覧', Buying: '仕入れ', 'Sell Vehicle': '車両販売', Parties: '取引先',
  Reports: 'レポート', Settings: '設定', 'Available Vehicles': '在庫車両', 'Profit & Margin': '利益・利益率', 'IN / OUT Vehicles': '入出庫車両',
  Company: '会社情報', Users: 'ユーザー', 'User Roles': '権限', 'My Profile': 'マイプロフィール', 'Sign out': 'ログアウト',
  'Collapse sidebar': 'サイドバーを閉じる', 'Expand sidebar': 'サイドバーを開く',
  'All rights reserved.': 'All rights reserved.', 'Powered by': 'Powered by',
  'No access': 'アクセス権がありません',
  "Your role doesn't include this page. Ask an administrator if you need access.": 'このページを表示する権限がありません。管理者にお問い合わせください。',

  // ---- Common actions ----
  Save: '保存', Cancel: 'キャンセル', Edit: '編集', Delete: '削除', Print: '印刷', Close: '閉じる', Clear: 'クリア', Apply: '適用',
  Remove: '削除', Back: '戻る', Next: '次へ', Previous: '前へ', Search: '検索', 'Search…': '検索…', Filter: '絞り込み', Sort: '並べ替え',
  'Export CSV': 'CSV出力', 'Print Invoice': '請求書を印刷', Invoice: '請求書', 'Edit Sale': '販売を編集', 'Save Vehicle': '車両を保存',
  'Save & Print Invoice': '保存して請求書を印刷', 'Save Changes': '変更を保存', 'Save Party': '取引先を保存', 'Save User': 'ユーザーを保存',
  'Save Details': '保存', 'Change Password': 'パスワード変更', '+ Buying': '+ 仕入れ', '+ Add': '+ 追加', '+ New': '+ 新規',
  '+ Add Party': '+ 取引先を追加', '+ Add User': '+ ユーザーを追加', 'Complete →': '入力する →', 'View all': 'すべて表示',
  'Profit report': '利益レポート', 'Reset filters': '条件をリセット', 'Expand all': 'すべて展開', 'Collapse all': 'すべて折りたたむ',
  'Group by…': 'グループ化…', 'Remove grouping': 'グループ解除', 'Remove filter': '条件を削除', 'Saving…': '保存中…', 'Loading…': '読み込み中…',
  'Set as cover': 'カバーに設定', 'Delete photo': '写真を削除', 'Set cover': 'カバーに設定',
  Today: '今日', 'Show': '表示', 'Hide': '隠す', Yes: 'はい', No: 'いいえ',

  // ---- Status / types ----
  'In Stock': '在庫', 'In Transit': '輸送中', Reserved: '商談中', Sold: '売約済', Available: '在庫あり',
  Local: '国内', Export: '輸出', International: '海外', 'Local & Export': '国内・輸出', All: 'すべて',
  Buyer: '購入者', Seller: '仕入先', Both: '両方', Buyers: '購入者', Sellers: '仕入先',
  Individual: '個人', Dealer: '業者', 'Auction House': 'オークション会場', Agent: '代理店',
  Active: '有効', Inactive: '無効', Admin: '管理者', Manager: 'マネージャー', Sales: '営業', Viewer: '閲覧者',
  Used: '中古', New: '新車', Reconditioned: '整備済',
  Auction: 'オークション', 'Local Dealer': '国内業者', Import: '輸入', 'Trade-in': '下取り',
  Petrol: 'ガソリン', Diesel: 'ディーゼル', Hybrid: 'ハイブリッド', Electric: '電気', Automatic: 'AT', Manual: 'MT',
  Sedan: 'セダン', Hatchback: 'ハッチバック', SUV: 'SUV', Van: 'バン', 'Mini Van': 'ミニバン', Pickup: 'ピックアップ', Truck: 'トラック', Wagon: 'ワゴン',
  Cash: '現金', 'Bank Transfer': '銀行振込', Cheque: '小切手', Installments: '分割払い',
  IN: '入庫', OUT: '出庫', Paid: '支払済',

  // ---- Vehicle fields ----
  Vehicle: '車両', Vehicles: '車両', 'Stock #': '在庫番号', 'Stock No *': '在庫番号 *', Make: 'メーカー', 'Make *': 'メーカー *',
  Model: '車種', 'Model *': '車種 *', Variant: 'グレード', 'Variant / Grade': 'グレード', Year: '年式', 'Manufacture Year': '年式',
  'Reg. Year': '登録年', 'Registration Year': '登録年', 'Reg. No': '登録番号', 'Registration No': '登録番号',
  Chassis: '車台番号', 'Chassis / VIN': '車台番号', 'Chassis / VIN No': '車台番号', 'Engine No': 'エンジン番号',
  Color: '色', Mileage: '走行距離', 'Mileage (km)': '走行距離 (km)', Engine: '排気量', 'Engine (cc)': '排気量 (cc)', CC: '排気量',
  Fuel: '燃料', Transmission: 'ミッション', 'Trans.': 'ミッション', Body: 'ボディ', 'Body Type': 'ボディタイプ', Drive: '駆動',
  Steering: 'ハンドル', Seats: '定員', Doors: 'ドア数', Condition: '状態', 'Features / Options': '装備・オプション', Features: '装備',
  Location: '保管場所', 'Location / Yard': '保管場所', Status: 'ステータス', Grade: '評価点', 'Auction Grade': 'オークション評価点',
  'Overall Grade': '総合評価点', 'Interior Grade': '内装評価', 'Exterior Grade': '外装評価', 'Auction House': 'オークション会場',
  'Lot No': '出品番号', 'Auction Date': '開催日', 'Auction Sheet & Grading': 'オークションシート・評価',
  'Auction Sheet Remarks / Damage Notes': '検査員報告・キズ情報', 'Auction Sheet': 'オークションシート',
  Identification: '車両識別', Specifications: '仕様', 'Internal Notes': '社内メモ', Notes: 'メモ',
  'Vehicle Information': '車両情報', 'Vehicle Images': '車両画像', 'Vehicle Price': '仕入価格', 'Status & Ask Price': 'ステータス・販売希望価格',
  Overview: '概要', 'Purchase & Costs': '仕入・原価', Sale: '販売',

  // ---- Purchase / cost ----
  Purchase: '仕入', 'Purchase Date': '仕入日', Purchased: '仕入日', 'Purchase Price': '仕入価格', 'Purchase price': '仕入価格',
  'Purchase Source': '仕入元区分', Source: '仕入区分', 'Purchase Month': '仕入月',
  'Freight / Shipping': '陸送・輸送費', 'Freight / shipping': '陸送・輸送費', 'Duty & Taxes': '関税・税金', 'Duty & taxes': '関税・税金',
  'Repair / Recondition': '修理・整備費', 'Repair / recondition': '修理・整備費', 'Other Costs': 'その他費用', 'Other costs': 'その他費用',
  'Total Cost': '総原価', 'Total cost': '総原価', 'Total landed cost': '総原価（諸費用込）', Cost: '原価',
  'Asking Price': '販売希望価格', Asking: '希望価格', 'Asking price': '販売希望価格', 'Seller (Party)': '仕入先',
  'Supplier / Auction': '仕入先・会場', 'Agent / Supplier': '代行業者', 'Won at auction': 'オークション落札',
  'Bought at auction (IN)': 'オークション仕入（入庫）', 'Purchased (IN)': '仕入（入庫）', 'Added to inventory': '在庫登録', 'Awaiting sale': '販売待ち',

  // ---- Sale ----
  'Sale Type': '販売区分', 'Sale Type *': '販売区分 *', 'Sale Date': '販売日', 'Sale Date *': '販売日 *', Sold: '売約済',
  'Sale Price': '販売価格', 'Sale Price *': '販売価格 *', 'Sale Expenses': '販売経費', 'Sale Exp.': '販売経費', 'Sale expenses': '販売経費',
  'Sold for': '販売価格', 'Buyer Name': '購入者名', 'Buyer *': '購入者 *', 'Buyer Contact': '購入者連絡先', 'Buyer ID': '購入者ID',
  'Name on Invoice': '請求書宛名', 'Phone / Email': '電話・メール', Destination: '仕向地', 'Destination Country': '仕向国', 'Destination Port': '仕向港',
  'Shipping Ref': 'B/L番号', 'Shipping Ref / B/L No': 'B/L番号', 'Payment Method': '支払方法', 'Amount Received': '入金額', Received: '入金額',
  Balance: '残高', 'Balance Due': '未収金', Payment: '入金状況', 'Invoice No': '請求書番号', 'Remarks (printed on invoice)': '備考（請求書に記載）',
  '1. Vehicle': '1. 車両', '2. Sale Details': '2. 販売情報', '3. Buyer': '3. 購入者', '4. Payment': '4. 入金',
  'Select available vehicle': '在庫車両を選択', 'Record the sale, then print the invoice': '販売を登録して請求書を印刷します',
  'Days to Sell': '販売までの日数', 'Days in Stock': '在庫日数', Days: '日数', Aging: '在庫期間',

  // ---- Money / KPI ----
  Profit: '利益', Margin: '利益率', 'Margin %': '利益率 %', Revenue: '売上', 'Net Profit': '純利益', 'Profit Margin': '利益率',
  'Expected Profit': '見込利益', 'Avg / Vehicle': '1台あたり平均', 'Total Business': '取引総額', 'Total Sold': '販売台数',
  'Available Stock': '在庫台数', 'Vehicles Sold': '販売台数', 'Pending Payments': '未収金', 'Stock Value': '在庫金額',
  'Stock Value (Cost)': '在庫金額（原価）', 'Avg Days in Stock': '平均在庫日数', 'Avg Days to Sell': '平均販売日数',
  'Vehicles IN': '入庫台数', 'Vehicles OUT': '出庫台数', 'Net Stock Change': '在庫増減', 'Net Cash Flow': '純キャッシュフロー', 'Net Change': '増減',
  'IN this month': '今月の入庫', 'OUT this month': '今月の出庫', 'Profit this month': '今月の利益',

  // ---- Charts / panels ----
  'Vehicles IN vs OUT': '入庫・出庫台数', 'Monthly Profit': '月別利益', 'Sales Mix': '販売構成', 'Stock by Make': 'メーカー別在庫',
  'Aging Stock': '長期在庫', 'Recent Sales': '最近の販売', 'Last 6 months': '過去6か月', 'Oldest unsold': '在庫日数の長い順',
  'IN (bought)': '入庫（仕入）', 'OUT (sold)': '出庫（販売）', 'Stock Aging': '在庫期間分析', 'Stock Value by Make': 'メーカー別在庫金額',
  'By Location': '保管場所別', 'Summary by Make': 'メーカー別集計', 'Detailed List': '明細', 'Share of Stock': '在庫構成比',
  'Revenue Breakdown': '売上内訳', 'Profit by Month': '月別利益', 'Margin by Month': '月別利益率', 'Local vs Export': '国内・輸出比較',
  'Most Profitable': '高利益車両', 'Loss-Making Sales': '赤字販売', 'Lowest Profit': '低利益車両', 'Profit by Make': 'メーカー別利益',
  'Vehicle-wise': '車両別', 'By Sale Type': '販売区分別', 'By Make': 'メーカー別', 'By Month': '月別', 'Vehicle cost': '車両原価',
  'Vehicles IN vs OUT by Month': '月別入出庫台数', 'Value IN vs OUT by Month': '月別入出庫金額', 'IN by Purchase Source': '仕入区分別入庫',
  'OUT by Sale Type': '販売区分別出庫', 'Monthly Summary': '月次集計', 'IN Value (Cost)': '入庫金額（原価）', 'OUT Value (Sales)': '出庫金額（売上）',
  'IN Value': '入庫金額', 'OUT Value': '出庫金額', Movement: '入出庫', 'Source / Type': '区分', 'Supplier / Buyer': '仕入先・購入者',
  'IN value (cost)': '入庫金額（原価）', 'OUT value (sales)': '出庫金額（売上）', Month: '月', Date: '日付', Type: '種別',
  'Sales received minus purchases (incl. costs)': '販売入金 − 仕入額（諸費用込）', Timeline: '履歴', Activity: '取引履歴',

  // ---- Report titles ----
  'Available Vehicles Report': '在庫車両レポート', 'Profit & Margin Report': '利益・利益率レポート', 'IN / OUT Vehicles Report': '入出庫レポート',
  'Unsold stock: In Transit, In Stock and Reserved': '未販売在庫（輸送中・在庫・商談中）', 'All Available': 'すべての在庫', 'All Sales': 'すべての販売',

  // ---- Inventory page ----
  'All makes': 'すべてのメーカー', 'Search stock #, chassis, make, model, buyer, lot…': '在庫番号・車台番号・メーカー・車種・購入者・出品番号で検索…',
  'No vehicles match these filters.': '条件に一致する車両はありません。',

  // ---- Dates ----
  'All Time': '全期間', 'Last 7 Days': '過去7日', 'This Month': '今月', 'Last Month': '先月', 'Last 3 Months': '過去3か月',
  'This Year': '今年', 'Last Year': '昨年', 'Pick a start date': '開始日を選択',

  // ---- Data grid ----
  'Clear column filters': '列の絞り込みを解除', '{n} records': '{n} 件', '{n} of {total} records': '{total} 件中 {n} 件',
  'Showing {from}–{to} of {total}': '{total} 件中 {from}–{to} 件を表示', 'Grouped by': 'グループ', Start: '開始',
  'From {date} — pick an end date': '{date} から — 終了日を選択', 'Search or type new…': '検索または新規入力…',
  'Nothing to show yet.': 'まだデータがありません。', 'No data': 'データなし', Language: '言語',
  'Rows per page': '表示件数', Total: '合計', 'No records found.': 'データがありません。', 'Sort ascending': '昇順', 'Sort descending': '降順',
  'Clear sort': '並べ替え解除', 'Contains…': '含む…', 'No matches': '該当なし', '— Select —': '— 選択 —',

  // ---- Parties ----
  'Buyers and sellers — local and international': '購入者・仕入先（国内・海外）', 'Add Party': '取引先を追加',
  'Party Type *': '取引区分 *', Category: '業種', 'Full Name *': '氏名 *', 'Display Name *': '表示名 *', 'Registered Company Name': '登記上の会社名',
  'Contact Person': '担当者', 'Contact person': '担当者', 'Contact Designation': '役職', Phone: '電話番号', 'Phone *': '電話番号 *',
  'Alternate Phone': '予備電話番号', 'Alt. phone': '予備電話番号', Email: 'メール', Website: 'ウェブサイト', 'ID Type': '本人確認書類', 'ID Number': '書類番号',
  Country: '国', 'Country *': '国 *', City: '市区町村', Address: '住所', 'Street Address': '番地', 'Postal Code': '郵便番号', 'Postal code': '郵便番号',
  'Default Port': '通常の仕向港', 'Default port': '通常の仕向港', 'Trading Currency': '取引通貨', Currency: '通貨', 'Credit Limit': '与信限度額', 'Credit limit': '与信限度額',
  'Bank Name': '銀行名', Bank: '銀行', 'Account Title': '口座名義', 'Account title': '口座名義', 'Account Number': '口座番号', 'Account no': '口座番号', Account: '口座',
  'Identity & Type': '基本情報', Contact: '連絡先', 'Tax & Banking': '税務・振込先', 'Notes & Status': 'メモ・状態', Banking: '振込先',
  'Identity & Address': '本人確認・住所', 'Bought From Them': '仕入台数', 'Sold To Them': '販売台数', 'Profit From Them': '販売利益',
  'Profit on Their Vehicles': '仕入車両の利益', 'Still in Stock': '在庫中', 'Bought From': '仕入', 'Sold To': '販売', 'Last Deal': '最終取引',
  'Owed by Buyers': '購入者の未収金', Code: 'コード', Name: '名前',

  // ---- Company / users ----
  'Company Profile': '会社情報', 'Invoice Header Preview': '請求書ヘッダーのプレビュー', Tagline: 'キャッチコピー', 'Invoice Prefix': '請求書番号の接頭辞',
  'Terms & Conditions (one per line)': '取引条件（1行に1項目）', 'English Name': '英語表記', FAX: 'FAX',
  'Decides what “Local” means for buyers and sellers': '取引先の「国内」の基準になります', 'Printed on export invoices': '輸出用請求書に記載',
  Role: '権限', 'Role *': '権限 *', 'Last Sign-in': '最終ログイン', Added: '登録日', 'Permission Matrix': '権限一覧',
  'What each role can do. Assign roles on the Users page.': '各権限でできる操作です。権限はユーザー画面で割り当てます。',
  'Your Details': 'ユーザー情報', 'Current Password': '現在のパスワード', 'New Password': '新しいパスワード', 'Confirm New Password': '新しいパスワード（確認）',
  'At least 8 characters': '8文字以上',

  // ---- Login ----
  'Sign in': 'ログイン', 'Signing in…': 'ログイン中…', Password: 'パスワード',
  'Welcome back. Sign in to manage your inventory.': 'ログインして在庫を管理しましょう。',
  'Forgot your password? Ask your administrator to reset it.': 'パスワードを忘れた場合は管理者にリセットを依頼してください。',
  'Incorrect email or password': 'メールアドレスまたはパスワードが正しくありません',
  'Enter your email and password': 'メールアドレスとパスワードを入力してください',
  'Buy, stock and sell vehicles — locally and for export — with every cost, auction grade and profit in one place.':
    '国内販売から輸出まで、仕入・在庫・販売を一元管理。原価、オークション評価点、利益をひと目で。',
  'Full vehicle records with auction sheets & photos': 'オークションシートと写真付きの車両台帳',
  'Profit, margin and stock-aging reports': '利益・利益率・在庫期間レポート',
  'Every vehicle IN and OUT, tracked': 'すべての入庫・出庫を記録',

  // ---- Search ----
  'Search vehicles, chassis, invoices, parties…': '車両・車台番号・請求書・取引先を検索…', 'Recent searches': '最近の検索', 'Quick actions': 'クイック操作',
  'See all vehicles matching': '在庫一覧で検索', 'No results for “{q}”.': '「{q}」の検索結果はありません。',
  Invoices: '請求書', Pages: 'ページ', 'Keep typing…': '入力を続けてください…', navigate: '移動', open: '開く', close: '閉じる', 'Go to ↵': '移動 ↵',
};

export default JA;
