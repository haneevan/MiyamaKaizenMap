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

from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy # Library: flask-sqlalchemy (Database ORM)
from werkzeug.security import generate_password_hash, check_password_hash # Library: werkzeug (Password Security)
import os

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

class KaizenReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    floor_id = db.Column(db.String(50))
    category = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pending') 
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    date_created = db.Column(db.DateTime, default=db.func.current_timestamp())

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

    # RUNNING MODE:
    # Set debug=False when deploying to company server
    app.run(debug=True, host='0.0.0.0', port=8080)