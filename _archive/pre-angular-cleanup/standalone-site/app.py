from flask import Flask, render_template_string
import os

app = Flask(__name__)

# Read the HTML file
with open('success-portal.html', 'r') as f:
    html_content = f.read()

@app.route('/')
def index():
    return html_content

@app.route('/health')
def health():
    return {'status': 'healthy'}, 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
