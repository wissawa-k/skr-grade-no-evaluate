"use strict";

const get = (id) => document.getElementById(id);
let semesters = [];

function makeCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function showRecord(record) {
  semesters = record.semesters;
  get("studentName").textContent = record.student.name;
  get("studentId").textContent = record.student.id;
  get("studentClass").textContent = record.student.classroom;
  get("studentNumber").textContent = record.student.number;
  get("evaluationWarning").hidden = !record.teacherEvaluationRequired;
  get("cumulativeGpa").textContent = record.summary.cumulativeGpa;
  get("totalCredits").textContent = record.summary.totalCredits;
  get("semesterCount").textContent = semesters.length;
  get("latestRank").textContent = semesters.at(-1).rank;

  const historyBody = get("historyBody");
  historyBody.textContent = "";
  semesters.forEach((semester) => {
    const row = document.createElement("tr");
    [semester.level, semester.label, semester.gpa, semester.creditsStudied, semester.creditsEarned, semester.rank]
      .forEach((value) => row.appendChild(makeCell(value)));
    historyBody.appendChild(row);
  });

  const selector = get("semesterSelect");
  selector.textContent = "";
  semesters.forEach((semester, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${semester.label} - ${semester.level}`;
    selector.appendChild(option);
  });
  selector.value = semesters.length - 1;
  showSemester(semesters.length - 1);

  get("results").hidden = false;
  get("loginPanel").hidden = true;
  get("message").textContent = "";
  get("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showSemester(index) {
  const semester = semesters[index];
  get("termSummary").textContent = `GPA ${semester.gpa} | ${semester.creditsEarned} credits earned | Rank ${semester.rank}`;
  const body = get("courseBody");
  body.textContent = "";

  semester.courses.forEach((course) => {
    const row = document.createElement("tr");
    const fields = ["รหัส", "ชื่อวิชา", "ประเภท", "หน่วยกิต", "กลางภาค", "ปลายภาค", "รวม", "เกรด", "ครูผู้สอน"];
    fields.forEach((field) => {
      const cell = makeCell(course[field] || "");
      if (field === "เกรด") {
        const grade = Number(course[field]);
        if (grade >= 3.5) cell.className = "grade-high";
        if (grade > 0 && grade < 2) cell.className = "grade-low";
      }
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

get("birthDate").addEventListener("input", (event) => {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  event.target.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean).join("/");
});

get("nationalId").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 13);
});

get("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = get("loginButton");
  const message = get("message");
  button.disabled = true;
  button.textContent = "Connecting to SKR...";
  message.className = "message";
  message.textContent = "Please wait. This may take a few seconds.";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nationalId: get("nationalId").value,
        birthDate: get("birthDate").value
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Login failed.");
    get("loginForm").reset();
    showRecord(payload);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Login and view grades";
  }
});

get("semesterSelect").addEventListener("change", (event) => showSemester(Number(event.target.value)));
