# app.py

import json
from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from flask_login import LoginManager, current_user, login_user, logout_user, login_required
from functools import wraps
from config import Config
from models import db, User, Quiz, Question, Option, Submission

# App Initialization
app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Flask-Login Initialization
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Decorator for admin-only routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash("You do not have permission to access this page.", "danger")
            return redirect(url_for('user_dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# -----------------
# AUTH ROUTES
# -----------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username']).first()
        if user is None or not user.check_password(request.form['password']):
            flash('Invalid username or password', 'danger')
            return redirect(url_for('login'))
        login_user(user, remember=True)
        return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == 'POST':
        if User.query.filter_by(username=request.form['username']).first():
            flash('Username already taken', 'warning')
            return redirect(url_for('register'))
        user = User(username=request.form['username'])
        user.set_password(request.form['password'])
        db.session.add(user)
        db.session.commit()
        flash('Congratulations, you are now a registered user!', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

# -----------------
# CORE ROUTES
# -----------------
@app.route('/')
@login_required
def home():
    if current_user.is_admin:
        return redirect(url_for('admin_dashboard'))
    return redirect(url_for('user_dashboard'))

# -----------------
# USER ROUTES
# -----------------
@app.route('/dashboard')
@login_required
def user_dashboard():
    quizzes = Quiz.query.all()
    return render_template('user_dashboard.html', quizzes=quizzes)

@app.route('/quiz/<int:quiz_id>')
@login_required
def user_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    return render_template('user_quiz.html', quiz=quiz)

@app.route('/leaderboard/<int:quiz_id>')
@login_required
def user_leaderboard(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    submissions = Submission.query.filter_by(quiz_id=quiz_id).order_by(Submission.score.desc()).all()
    return render_template('user_leaderboard.html', quiz=quiz, submissions=submissions)

# -----------------
# ADMIN ROUTES
# -----------------
@app.route('/admin')
@login_required
@admin_required
def admin_dashboard():
    return render_template('admin_dashboard.html')

@app.route('/admin/create', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_create_quiz():
    if request.method == 'POST':
        data = request.get_json()
        new_quiz = Quiz(title=data['title'], description=data['description'])
        db.session.add(new_quiz)
        for q_data in data['questions']:
            question = Question(text=q_data['text'], quiz=new_quiz)
            db.session.add(question)
            for o_data in q_data['options']:
                option = Option(text=o_data['text'], is_correct=o_data['is_correct'], question=question)
                db.session.add(option)
        db.session.commit()
        return jsonify({'message': 'Quiz created successfully!', 'quiz_id': new_quiz.id})
    return render_template('admin_create_quiz.html')


@app.route('/admin/edit/<int:quiz_id>', methods=['GET', 'POST'])
@login_required
@admin_required
def admin_edit_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    if request.method == 'POST':
        # Deletion of old questions/options is handled by cascade in models
        quiz.questions.delete() 
        data = request.get_json()
        quiz.title = data['title']
        quiz.description = data['description']
        for q_data in data['questions']:
            question = Question(text=q_data['text'], quiz=quiz)
            db.session.add(question)
            for o_data in q_data['options']:
                option = Option(text=o_data['text'], is_correct=o_data['is_correct'], question=question)
                db.session.add(option)
        db.session.commit()
        return jsonify({'message': 'Quiz updated successfully!', 'quiz_id': quiz.id})
    return render_template('admin_edit_quiz.html', quiz=quiz)

@app.route('/admin/delete_quiz/<int:quiz_id>', methods=['POST'])
@login_required
@admin_required
def delete_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    db.session.delete(quiz)
    db.session.commit()
    flash(f'Quiz "{quiz.title}" has been deleted.', 'success')
    return redirect(url_for('user_dashboard'))

@app.route('/admin/submissions')
@login_required
@admin_required
def admin_submissions():
    submissions = Submission.query.order_by(Submission.timestamp.desc()).all()
    return render_template('admin_submissions.html', submissions=submissions)

@app.route('/admin/analytics')
@login_required
@admin_required
def admin_analytics():
    total_users = User.query.count()
    total_quizzes = Quiz.query.count()
    total_submissions = Submission.query.count()
    return render_template('admin_analytics.html', total_users=total_users, total_quizzes=total_quizzes, total_submissions=total_submissions)

# -----------------
# API ROUTES
# -----------------
@app.route('/api/quiz/<int:quiz_id>')
@login_required
def get_quiz_data(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    questions_data = []
    for q in quiz.questions:
        options = [{'id': opt.id, 'text': opt.text} for opt in q.options]
        questions_data.append({'id': q.id, 'text': q.text, 'options': options})
    return jsonify({
        'title': quiz.title,
        'questions': questions_data
    })

@app.route('/api/submit/<int:quiz_id>', methods=['POST'])
@login_required
def submit_quiz(quiz_id):
    data = request.get_json()
    user_answers = data['answers'] # format: {question_id: option_id}
    
    score = 0
    total = len(user_answers)
    
    for question_id, option_id in user_answers.items():
        option = Option.query.get(option_id)
        if option and option.is_correct:
            score += 1
            
    submission = Submission(score=score, user_id=current_user.id, quiz_id=quiz_id)
    db.session.add(submission)
    db.session.commit()
    
    return jsonify({
        'message': 'Submission successful!',
        'score': score,
        'total': total
    })
    
# -----------------
# CLI COMMANDS
# -----------------
@app.cli.command("init-db")
def init_db_command():
    """Clear existing data and create new tables."""
    db.drop_all()
    db.create_all()
    # Create a default admin user
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', is_admin=True)
        admin.set_password('password')
        db.session.add(admin)
        db.session.commit()
        print('Initialized the database and created admin user.')

if __name__ == '__main__':
    app.run(debug=True)