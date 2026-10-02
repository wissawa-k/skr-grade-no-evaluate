import os
import re
from datetime import datetime

from bs4 import BeautifulSoup
from curl_cffi import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix


BASE_URL = "https://grade.skr.ac.th"
ROOT = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")


def clean_text(node):
    return " ".join(node.get_text(" ", strip=True).split())


def table_rows(table):
    output = []
    for row in table.find_all("tr"):
        cells = [clean_text(cell) for cell in row.find_all(["th", "td"])]
        if cells:
            output.append(cells)
    return output


def summary_values(table):
    return {row[0]: row[1] for row in table_rows(table) if len(row) >= 2}


def parse_result(html):
    soup = BeautifulSoup(html, "html.parser")
    student_heading = next(
        (heading for heading in soup.find_all("h4") if "ข้อมูลนักเรียน" in clean_text(heading)),
        None,
    )
    if not student_heading:
        raise ValueError("Login was not accepted. Check the ID and birth date.")

    student_card = student_heading.find_parent("div", class_="card")
    student_values = [clean_text(node) for node in student_card.find_all("font")]
    if len(student_values) < 4:
        raise ValueError("Student information could not be read.")

    student = {
        "id": student_values[0],
        "name": student_values[1],
        "classroom": student_values[2],
        "number": student_values[3],
    }

    headings = [
        heading
        for heading in soup.find_all("h4")
        if re.search(r"ภาคเรียนที่\s*\d+/\d+", clean_text(heading))
    ]
    semesters = []
    for heading in headings:
        label = re.search(r"ภาคเรียนที่\s*(\d+/\d+)", clean_text(heading))
        course_table = heading.find_next("table")
        learned_table = course_table.find_next("table") if course_table else None
        earned_table = learned_table.find_next("table") if learned_table else None
        if not label or not all([course_table, learned_table, earned_table]):
            continue

        raw_courses = table_rows(course_table)
        if len(raw_courses) < 2:
            continue
        columns = raw_courses[0]
        courses = []
        for values in raw_courses[1:]:
            padded = values + [""] * (len(columns) - len(values))
            courses.append(dict(zip(columns, padded)))

        learned = summary_values(learned_table)
        earned = summary_values(earned_table)
        level_node = heading.find_previous("div", class_="alert-primary")
        semesters.append(
            {
                "label": label.group(1),
                "level": clean_text(level_node) if level_node else "",
                "gpa": learned.get("เกรดเฉลี่ย", "-"),
                "creditsStudied": learned.get("รวมหน่วยกิตที่เรียน", "-"),
                "creditsEarned": earned.get("รวมหน่วยกิตที่ได้", "-"),
                "rank": earned.get("ลำดับที่ ห้อง/ระดับชั้น", "-"),
                "courses": courses,
            }
        )

    if not semesters:
        raise ValueError("No semester results were found.")

    total_credits = sum(float(item["creditsEarned"]) for item in semesters)
    weighted_gpa = sum(
        float(item["gpa"]) * float(item["creditsEarned"]) for item in semesters
    ) / total_credits

    return {
        "student": student,
        "semesters": semesters,
        "summary": {
            "totalCredits": f"{total_credits:.1f}",
            "cumulativeGpa": f"{weighted_gpa:.2f}",
        },
        "teacherEvaluationRequired": "ยังไม่ได้ประเมินครูผู้สอน" in soup.get_text(),
        "retrievedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def upstream_request(session, method, url, **kwargs):
    """Retry once because the school server occasionally responds very slowly."""
    last_error = None
    for _attempt in range(2):
        try:
            response = session.request(method, url, timeout=45, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestsError as error:
            last_error = error
            response = getattr(error, "response", None)
            if response is not None and response.status_code in {401, 403, 429}:
                raise
    raise last_error


def fetch_results(national_id, birth_date):
    session_options = {"impersonate": os.getenv("SKR_BROWSER", "chrome")}
    if os.getenv("SKR_HTTP_PROXY"):
        session_options["proxy"] = os.environ["SKR_HTTP_PROXY"]
    session = requests.Session(**session_options)
    session.headers.update({"Accept-Language": "th-TH,th;q=0.9,en;q=0.8"})
    clearance = os.getenv("SKR_CF_CLEARANCE")
    if clearance:
        session.cookies.set("cf_clearance", clearance, domain="grade.skr.ac.th", path="/")

    upstream_request(session, "GET", f"{BASE_URL}/index.php")
    upstream_request(
        session,
        "POST",
        f"{BASE_URL}/login.php",
        data={
            "nationid_student": national_id,
            "birtday_student": birth_date,
            "submit": " ",
        },
        headers={"Origin": BASE_URL, "Referer": f"{BASE_URL}/index.php"},
    )
    result = upstream_request(
        session,
        "GET",
        f"{BASE_URL}/result.php",
        headers={"Referer": f"{BASE_URL}/login.php"},
    )
    return parse_result(result.text)


@app.after_request
def secure_response(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:filename>")
def static_file(filename):
    if filename not in {"app.js", "style.css"}:
        return jsonify(error="Not found"), 404
    return send_from_directory(ROOT, filename)


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/api/login")
@limiter.limit("5 per minute; 20 per hour")
def login():
    payload = request.get_json(silent=True) or {}
    national_id = str(payload.get("nationalId", "")).strip()
    birth_date = str(payload.get("birthDate", "")).strip()
    if not re.fullmatch(r"\d{13}", national_id):
        return jsonify(error="National ID must contain exactly 13 digits."), 400
    if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", birth_date):
        return jsonify(error="Birth date must use DD/MM/YYYY with the Buddhist year."), 400

    try:
        return jsonify(fetch_results(national_id, birth_date))
    except ValueError as error:
        return jsonify(error=str(error)), 401
    except requests.RequestsError as error:
        status = getattr(error.response, "status_code", None)
        if status == 403:
            return jsonify(error="SKR or Cloudflare blocked the server request."), 502
        return jsonify(error="The SKR server could not be reached. Please try again."), 502


@app.errorhandler(429)
def rate_limited(_error):
    return jsonify(error="Too many login attempts. Please wait and try again."), 429


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=False)
