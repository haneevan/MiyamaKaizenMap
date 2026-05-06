"""
MIYAMA KAIZEN PORTAL - BACKEND CORE
-----------------------------------
SETUP INSTRUCTIONS FOR NEW PC:
1. Install Python 3.9 (Windows 7 compatible) 
2. Open CMD in this folder and run:
   pip install flask flask-sqlalchemy waitress werkzeug

新規PCのセットアップ手順:
1. Python 3.9 をインストール（Windows 7 対応）
2. このフォルダでCMDを開き、以下を実行:
    pip install flask flask-sqlalchemy waitress werkzeug

NOTE: If using a virtual environment (recommended):
   python -m venv venv
   venv\Scripts\activate
   pip install flask flask-sqlalchemy waitress werkzeug

注記: 仮想環境（推奨）を使用する場合:
    python -m venv venv
    venv\Scripts\activate
    pip install flask flask-sqlalchemy waitress werkzeug   
"""

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_sqlalchemy import SQLAlchemy # Library: flask-sqlalchemy (Database ORM)
from werkzeug.security import generate_password_hash, check_password_hash # Library: werkzeug (Password Security)
from datetime import datetime
import os
import json

# ---------------------------------------------------------
# APP INITIALIZATION
# ---------------------------------------------------------
app = Flask(__name__)
app.secret_key = 'miyama_gemba_secret_2026' 

# Database Path Configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'kaizen_portal.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ---------------------------------------------------------
# DATABASE MODELS (Tables)
# ---------------------------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False) # Employee ID
    full_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    # Authority: 1:Staff, 2:Supervisor, 3:Manager, 4:Admin
    access_level = db.Column(db.Integer, default=1)
    
    # Relationships
    reports = db.relationship('KaizenReport', backref='creator', lazy=True, foreign_keys='KaizenReport.created_by')

class KaizenReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    method = db.Column(db.Text, nullable=True) # Proposed improvement method
    benefits = db.Column(db.Text, nullable=True) # Expected benefits
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    floor_id = db.Column(db.String(50))
    category = db.Column(db.String(50)) # production, cost, quality, safety, 5s, others
    photo = db.Column(db.LargeBinary, nullable=True) # Store base64 photo data
    status = db.Column(db.String(20), default='pending') # pending, approved, completed, rejected
    approval_notes = db.Column(db.Text, nullable=True) # Supervisor/manager feedback
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Manager assignment
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ---------------------------------------------------------
# ROUTES (Auth & Navigation)
# ---------------------------------------------------------

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password, password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['full_name'] = user.full_name
            session['access_level'] = user.access_level
            return redirect(url_for('index'))
        
        flash('IDまたはパスワードが正しくありません。')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        full_name = request.form.get('full_name')
        dept = request.form.get('department')
        pw = request.form.get('password')

        if User.query.filter_by(username=username).first():
            flash("この社員番号は既に登録されています。")
            return redirect(url_for('register'))

        # Secure password storage
        hashed_pw = generate_password_hash(pw, method='pbkdf2:sha256')
        
        new_user = User(
            username=username, 
            full_name=full_name, 
            department=dept, 
            password=hashed_pw,
            access_level=1
        )
        db.session.add(new_user)
        db.session.commit()
        
        flash("登録完了！ログインしてください。")
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ---------------------------------------------------------
# API ENDPOINTS (JSON REST)
# ---------------------------------------------------------

@app.route('/api/reports', methods=['POST'])
def submit_kaizen():
    """
    POST /api/reports
    Accept form data and save improvement report to database
    """
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': '認証が必要です'}), 401
    
    data = request.get_json()
    
    # Validate required fields
    required = ['title', 'description', 'category']
    for field in required:
        if not data.get(field):
            return jsonify({'status': 'error', 'message': f'{field} is required'}), 400
    
    try:
        # Create new report
        new_report = KaizenReport(
            title=data.get('title'),
            description=data.get('description'),
            method=data.get('method', ''),
            benefits=data.get('benefits', ''),
            category=data.get('category'),
            floor_id=data.get('floor_id'),
            lat=float(data.get('lat', 0)),
            lng=float(data.get('lng', 0)),
            photo=data.get('photo'),  # Store base64 string as-is
            status='pending',
            created_by=session['user_id']
        )
        
        db.session.add(new_report)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'id': new_report.id,
            'message': '改善提案を送信しました'
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/reports', methods=['GET'])
def list_kaizens():
    """
    GET /api/reports
    Retrieve all improvement reports with optional filters
    Query params: user_id, category, status
    """
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': '認証が必要です'}), 401
    
    try:
        query = KaizenReport.query
        
        # Apply filters
        user_id = request.args.get('user_id')
        if user_id:
            query = query.filter_by(created_by=int(user_id))
        
        category = request.args.get('category')
        if category:
            query = query.filter_by(category=category)
        
        status = request.args.get('status')
        if status:
            query = query.filter_by(status=status)
        
        # Order by newest first
        reports = query.order_by(KaizenReport.date_created.desc()).all()
        
        # Convert to JSON-serializable format
        result = []
        for report in reports:
            creator = User.query.get(report.created_by)
            result.append({
                'id': report.id,
                'title': report.title,
                'description': report.description,
                'method': report.method or '',
                'benefits': report.benefits or '',
                'category': report.category,
                'floor_id': report.floor_id,
                'lat': report.lat,
                'lng': report.lng,
                'photo': report.photo,  # Photo as base64 string
                'status': report.status,
                'approval_notes': report.approval_notes or '',
                'user': creator.full_name if creator else 'Unknown',
                'user_id': creator.id if creator else None,
                'department': creator.department if creator else '',
                'date': report.date_created.strftime('%Y.%m.%d %H:%M') if report.date_created else '',
                'coords': {'lat': report.lat, 'lng': report.lng}
            })
        
        return jsonify({
            'status': 'success',
            'data': result,
            'count': len(result)
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/reports/<int:report_id>', methods=['GET'])
def view_kaizen(report_id):
    """
    GET /api/reports/<id>
    Retrieve single report details
    """
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': '認証が必要です'}), 401
    
    try:
        report = KaizenReport.query.get(report_id)
        if not report:
            return jsonify({'status': 'error', 'message': 'Report not found'}), 404
        
        creator = User.query.get(report.created_by)
        assigned_user = User.query.get(report.assigned_to) if report.assigned_to else None
        
        return jsonify({
            'status': 'success',
            'data': {
                'id': report.id,
                'title': report.title,
                'description': report.description,
                'method': report.method or '',
                'benefits': report.benefits or '',
                'category': report.category,
                'floor_id': report.floor_id,
                'lat': report.lat,
                'lng': report.lng,
                'photo': report.photo,
                'status': report.status,
                'approval_notes': report.approval_notes or '',
                'user': creator.full_name if creator else 'Unknown',
                'user_id': creator.id if creator else None,
                'department': creator.department if creator else '',
                'date': report.date_created.strftime('%Y.%m.%d %H:%M') if report.date_created else '',
                'assigned_to': assigned_user.full_name if assigned_user else None,
                'coords': {'lat': report.lat, 'lng': report.lng}
            }
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/reports/<int:report_id>', methods=['PUT'])
def update_kaizen(report_id):
    """
    PUT /api/reports/<id>
    Update report (only creator or manager can edit)
    """
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': '認証が必要です'}), 401
    
    try:
        report = KaizenReport.query.get(report_id)
        if not report:
            return jsonify({'status': 'error', 'message': 'Report not found'}), 404
        
        # Check permission: only creator or manager+ can edit
        is_creator = report.created_by == session['user_id']
        is_manager = session.get('access_level', 1) >= 3
        
        if not (is_creator or is_manager):
            return jsonify({'status': 'error', 'message': 'Permission denied'}), 403
        
        data = request.get_json()
        
        # Update allowed fields
        if 'title' in data:
            report.title = data['title']
        if 'description' in data:
            report.description = data['description']
        if 'method' in data:
            report.method = data['method']
        if 'benefits' in data:
            report.benefits = data['benefits']
        if 'category' in data:
            report.category = data['category']
        if 'photo' in data:
            report.photo = data['photo']
        if 'approval_notes' in data and is_manager:
            report.approval_notes = data['approval_notes']
        
        report.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'id': report.id,
            'message': '改善提案を更新しました'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

# ---------------------------------------------------------
# SYSTEM STARTUP
# ---------------------------------------------------------
if __name__ == '__main__':
    with app.app_context():
        # Build database tables if they don't exist
        db.create_all() 
        
        # Auto-create the Creator (Admin) account
        if not User.query.filter_by(username='admin').first():
            admin_pw = generate_password_hash('Miyama0', method='pbkdf2:sha256')
            admin = User(username='admin', full_name='System Admin', 
                         department='Admin', password=admin_pw, access_level=4)
            db.session.add(admin)
            db.session.commit()
            print(">>> System initialized: Admin account 'admin' created.")
        
        # Load test data if database is empty
        report_count = db.session.query(KaizenReport).count()
        if report_count == 0:
            print(">>> Database is empty. Loading seed data...")
            from seed import seed_db
            seed_db(db, User, KaizenReport)

    # RUNNING MODE:
    # Set debug=False when deploying to company server
    app.run(debug=True, host='0.0.0.0', port=8080)