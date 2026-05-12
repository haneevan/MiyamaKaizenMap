import os
from flask import Flask, render_template, request, jsonify, url_for

app = Flask(__name__)

# Setup upload folder
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Simple in-memory log
upload_log = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'image' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(file_path)
        
        # Log the data
        log_entry = {"filename": file.filename, "status": "Success"}
        upload_log.append(log_entry)
        
        # Return the URL to display the image
        return jsonify({
            "message": "Upload successful!",
            "url": f"/uploads/{file.filename}",
            "log": upload_log
        })

# Route to serve the uploaded images
from flask import send_from_directory
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(debug=True)