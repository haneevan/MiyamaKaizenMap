"""
MIYAMA KAIZEN PORTAL - TEST DATA SEED SCRIPT
===========================================

This script populates the database with test users and sample improvement reports
for development and testing purposes.

Usage:
    python seed.py
    
    Or import and run in Python shell:
    from seed import seed_db
    from KaizenPortal import app, db
    with app.app_context():
        seed_db(db)
"""

from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

def seed_db(db, User=None, KaizenReport=None):
    """
    Populate database with test data
    Requires: db (SQLAlchemy instance), User model, KaizenReport model
    """
    # Import models if not provided (for standalone execution)
    if User is None or KaizenReport is None:
        from KaizenPortal import User, KaizenReport
    
    print("🌱 Starting seed process...")
    
    # ========================
    # 1. CREATE TEST USERS
    # ========================
    
    test_users = [
        {
            'username': 'staff_alice',
            'full_name': 'Alice Johnson',
            'department': '製造部',
            'password': 'Pass123',
            'access_level': 1
        },
        {
            'username': 'staff_bob',
            'full_name': 'Bob Smith',
            'department': '製造部',
            'password': 'Pass123',
            'access_level': 1
        },
        {
            'username': 'supervisor_tanaka',
            'full_name': '田中 監督',
            'department': '管理部',
            'password': 'Pass123',
            'access_level': 2
        },
        {
            'username': 'manager_suzuki',
            'full_name': '鈴木 マネージャー',
            'department': '第一工場',
            'password': 'Pass123',
            'access_level': 3
        }
    ]
    
    created_users = {}
    for user_data in test_users:
        # Check if user already exists
        existing = User.query.filter_by(username=user_data['username']).first()
        if existing:
            print(f"  ⏭️  User '{user_data['username']}' already exists, skipping...")
            created_users[user_data['username']] = existing
            continue
        
        # Create new user
        hashed_pw = generate_password_hash(user_data['password'], method='pbkdf2:sha256')
        new_user = User(
            username=user_data['username'],
            full_name=user_data['full_name'],
            department=user_data['department'],
            password=hashed_pw,
            access_level=user_data['access_level']
        )
        db.session.add(new_user)
        created_users[user_data['username']] = new_user
        print(f"  ✅ Created user: {user_data['full_name']} ({user_data['username']})")
    
    db.session.commit()
    
    # ========================
    # 2. CREATE SAMPLE REPORTS
    # ========================
    
    # Get admin user
    admin = User.query.filter_by(username='admin').first()
    
    sample_reports = [
        # Production improvements
        {
            'title': 'ラインの段取り時間を短縮',
            'description': '第一工場の自動ラインで段取り時間が長すぎる。金型交換の手順を改善する必要がある。',
            'method': '自動化されたツール交換システムを導入し、手動作業を削減',
            'benefits': '段取り時間を30分から15分に削減可能',
            'category': 'production',
            'floor_id': 'f1_1f',
            'lat': 750.5,
            'lng': 1125.3,
            'status': 'pending',
            'created_by': created_users.get('staff_alice', admin).id
        },
        {
            'title': '作業台の整理整頓システム',
            'description': '毎日の朝礼で材料探しに時間がかかっている。',
            'method': 'QR コードを使用した在庫管理システムを導入',
            'benefits': '部品探索時間を 20 分削減。生産性向上。',
            'category': '5s',
            'floor_id': 'f1_2f_1',
            'lat': 800.0,
            'lng': 1200.0,
            'status': 'approved',
            'created_by': created_users.get('staff_bob', admin).id,
            'approval_notes': '良い提案です。次の月から試験的に導入します。'
        },
        # Cost improvements
        {
            'title': 'エネルギー効率の改善',
            'description': '第二工場のエアコンプレッサーが常に稼働しており、電気代が高い。',
            'method': 'インバータコンプレッサーに交換し、効率を上げる',
            'benefits': '月額電気代を 15% 削減可能（約 50,000 円/月）',
            'category': 'cost',
            'floor_id': 'f2_1f',
            'lat': 600.0,
            'lng': 800.0,
            'status': 'pending',
            'created_by': created_users.get('staff_alice', admin).id
        },
        {
            'title': 'スクラップ材の再利用',
            'description': '毎日、成形ラインから大量のスクラップが出ている。何かに利用できないか？',
            'method': '外部業者と契約し、スクラップをリサイクル',
            'benefits': '月額廃棄物処理費を 20% 削減、追加収益 30,000 円/月',
            'category': 'cost',
            'floor_id': 'f1_3f',
            'lat': 850.0,
            'lng': 900.0,
            'status': 'completed',
            'created_by': created_users.get('supervisor_tanaka', admin).id,
            'approval_notes': '素晴らしい提案でした。実装済みです。'
        },
        # Quality improvements
        {
            'title': '検査工程の自動化',
            'description': '不良品チェックを手動で行っており、見落としが多い。',
            'method': 'AI ビジョンシステムで自動検査',
            'benefits': '不良品検出率を 98% に向上、リサイクル費用削減',
            'category': 'quality',
            'floor_id': 'f1_1f',
            'lat': 700.0,
            'lng': 1050.0,
            'status': 'pending',
            'created_by': created_users.get('staff_bob', admin).id
        },
        {
            'title': 'マニュアル作成の改善',
            'description': '新入社員が作業マニュアルを理解しにくい。',
            'method': 'QR コードで動画マニュアルにリンク',
            'benefits': '教育期間を 1 週間から 3 日に短縮',
            'category': 'quality',
            'floor_id': 'ho_1f',
            'lat': 150.0,
            'lng': 250.0,
            'status': 'pending',
            'created_by': created_users.get('staff_alice', admin).id
        },
        # Safety improvements
        {
            'title': '階段での転倒防止',
            'description': '倉庫の階段が暗く、転倒事故が起きやすい。',
            'method': 'LED 照明を取り付け、滑り止めテープを追加',
            'benefits': '転倒事故をゼロにする',
            'category': 'safety',
            'floor_id': 'wh_2f',
            'lat': 500.0,
            'lng': 1500.0,
            'status': 'approved',
            'created_by': created_users.get('staff_alice', admin).id,
            'approval_notes': 'すぐに実装します。安全第一。'
        },
        {
            'title': 'ヘルメット着用の自動チェック',
            'description': '工場内でヘルメットを脱ぐ人がいる。ルールの遵守を改善したい。',
            'method': 'AI カメラでヘルメット着用状況を監視',
            'benefits': '安全事故を 50% 削減',
            'category': 'safety',
            'floor_id': 'f2_2f',
            'lat': 650.0,
            'lng': 950.0,
            'status': 'pending',
            'created_by': created_users.get('supervisor_tanaka', admin).id
        },
        # Additional reports with various statuses
        {
            'title': 'パッケージング材料の最適化',
            'description': 'パッケージング材料のコストが高い。',
            'method': '別のサプライヤーから仕入れ',
            'benefits': 'コスト 25% 削減',
            'category': 'cost',
            'floor_id': 'f3_1f',
            'lat': 400.0,
            'lng': 600.0,
            'status': 'pending',
            'created_by': created_users.get('staff_bob', admin).id
        },
        {
            'title': 'ロボット導入による自動化',
            'description': '溶接工程を自動化したい。',
            'method': 'ロボットアーム 2 台を導入',
            'benefits': '生産能力 60% 向上、人件費削減',
            'category': 'production',
            'floor_id': 'tf_1f',
            'lat': 900.0,
            'lng': 1800.0,
            'status': 'completed',
            'created_by': created_users.get('manager_suzuki', admin).id,
            'approval_notes': '既に実装完了。大成功です。'
        },
        {
            'title': '定期メンテナンスの自動スケジュール',
            'description': '機械のメンテナンスを忘れることがある。',
            'method': 'クラウドベースのメンテナンス管理システムを導入',
            'benefits': '機械の寿命を 30% 延長、突発的なダウンタイムを削減',
            'category': 'production',
            'floor_id': 'f1_1f',
            'lat': 720.0,
            'lng': 1100.0,
            'status': 'pending',
            'created_by': created_users.get('staff_alice', admin).id
        },
        {
            'title': '休憩室の快適性向上',
            'description': '休憩室が狭く、快適でない。',
            'method': '空調を新しくし、座席数を増やす',
            'benefits': '従業員の満足度向上、定着率改善',
            'category': 'others',
            'floor_id': 'ho_2f',
            'lat': 200.0,
            'lng': 350.0,
            'status': 'pending',
            'created_by': created_users.get('staff_bob', admin).id
        },
        {
            'title': 'ミーティングルームの予約システム',
            'description': 'ミーティングルームの予約が重複することがある。',
            'method': 'Google Calendar でルームリソースを管理',
            'benefits': 'ルーム利用効率 40% 向上',
            'category': '5s',
            'floor_id': 'ho_3f',
            'lat': 250.0,
            'lng': 400.0,
            'status': 'approved',
            'created_by': created_users.get('supervisor_tanaka', admin).id,
            'approval_notes': '良い提案。すぐに導入します。'
        },
        {
            'title': 'インターロック安全装置の強化',
            'description': '非常停止ボタンが遠くにある。近くに設置する必要がある。',
            'method': '各作業エリアに非常停止ボタンを追加',
            'benefits': '緊急対応時間を 50% 短縮',
            'category': 'safety',
            'floor_id': 'f2_3f',
            'lat': 700.0,
            'lng': 1100.0,
            'status': 'approved',
            'created_by': created_users.get('staff_alice', admin).id,
            'approval_notes': '安全性向上に賛成。実装予定。'
        },
        {
            'title': '廃液処理の改善',
            'description': '化学液の廃液処理が不十分で、環境への影響を懸念。',
            'method': '新しい廃液処理装置を導入',
            'benefits': '環境汚染リスク 90% 削減、法令遵守',
            'category': 'quality',
            'floor_id': 'f3_1f',
            'lat': 420.0,
            'lng': 620.0,
            'status': 'pending',
            'created_by': created_users.get('supervisor_tanaka', admin).id
        },
        {
            'title': '従業員教育プログラムの拡充',
            'description': 'スキル向上のための教育が不十分。',
            'method': 'オンライン教育プラットフォームを導入',
            'benefits': '従業員スキル向上、離職率低下',
            'category': 'others',
            'floor_id': 'ho_1f',
            'lat': 180.0,
            'lng': 300.0,
            'status': 'pending',
            'created_by': created_users.get('staff_bob', admin).id
        },
        {
            'title': '受け取り検査の効率化',
            'description': '新しい部品が届いた時、検査に 2 時間かかる。',
            'method': 'サプライヤーの検査データを使用、ランダムサンプリング導入',
            'benefits': '検査時間 50% 削減、納期改善',
            'category': 'production',
            'floor_id': 'wh_1f',
            'lat': 450.0,
            'lng': 1450.0,
            'status': 'completed',
            'created_by': created_users.get('manager_suzuki', admin).id,
            'approval_notes': '実装済み。良い改善です。'
        },
        {
            'title': 'トラッキングシステムの導入',
            'description': '部品在庫の所在が不明な場合がある。',
            'method': 'RFID タグと在庫管理システムを導入',
            'benefits': '部品検索時間ゼロ、在庫精度 99%',
            'category': '5s',
            'floor_id': 'wh_2f',
            'lat': 520.0,
            'lng': 1550.0,
            'status': 'pending',
            'created_by': created_users.get('staff_alice', admin).id
        }
    ]
    
    # Insert sample reports
    for report_data in sample_reports:
        # Check if similar report already exists
        existing = KaizenReport.query.filter_by(
            title=report_data['title']
        ).first()
        if existing:
            print(f"  ⏭️  Report '{report_data['title']}' already exists, skipping...")
            continue
        
        new_report = KaizenReport(**report_data)
        db.session.add(new_report)
        print(f"  ✅ Created report: {report_data['title']}")
    
    db.session.commit()
    
    print("\n✨ Seed complete!")
    print(f"  📊 Users: {User.query.count()}")
    print(f"  📝 Reports: {KaizenReport.query.count()}")


if __name__ == '__main__':
    from KaizenPortal import app, db
    
    with app.app_context():
        seed_db()
