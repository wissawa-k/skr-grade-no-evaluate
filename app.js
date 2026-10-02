"use strict";

const get = (id) => document.getElementById(id);
let semesters = [];

function text(node) {
  return node ? node.textContent.replace(/\s+/g, " ").trim() : "";
}

function rows(table) {
  return Array.from(table.querySelectorAll("tr"))
    .map((row) => Array.from(row.querySelectorAll("th, td")).map(text))
    .filter((row) => row.length);
}

function summary(table) {
  const result = {};
  rows(table).forEach((row) => {
    if (row.length >= 2) result[row[0]] = row[1];
  });
  return result;
}

function elementsAfter(elements, reference) {
  return elements.filter((element) =>
    Boolean(reference.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
}

function parseResultFile(source) {
  const documentFromFile = new DOMParser().parseFromString(source, "text/html");
  const studentHeading = Array.from(documentFromFile.querySelectorAll("h4"))
    .find((heading) => text(heading).includes("ข้อมูลนักเรียน"));

  if (!studentHeading) {
    throw new Error("This does not appear to be an SKR result page. Open result.php after logging in, then save it again.");
  }

  const studentCard = studentHeading.closest(".card") || studentHeading.parentElement.parentElement;
  const studentValues = Array.from(studentCard.querySelectorAll("font")).map(text);
  if (studentValues.length < 4) throw new Error("Student information could not be read from this file.");

  const student = {
    id: studentValues[0], name: studentValues[1], classroom: studentValues[2], number: studentValues[3]
  };

  const allTables = Array.from(documentFromFile.querySelectorAll("table"));
  const levelNodes = Array.from(documentFromFile.querySelectorAll("div.alert-primary"));
  const headings = Array.from(documentFromFile.querySelectorAll("h4"))
    .filter((heading) => /ภาคเรียนที่\s*\d+\/\d+/.test(text(heading)));

  const parsedSemesters = headings.map((heading) => {
    const match = text(heading).match(/ภาคเรียนที่\s*(\d+\/\d+)/);
    const followingTables = elementsAfter(allTables, heading);
    if (!match || followingTables.length < 3) return null;

    const courseRows = rows(followingTables[0]);
    if (courseRows.length < 2) return null;
    const columns = courseRows[0];
    const courses = courseRows.slice(1).map((values) => {
      const course = {};
      columns.forEach((column, index) => { course[column] = values[index] || ""; });
      return course;
    });

    const previousLevels = levelNodes.filter((level) =>
      Boolean(level.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
    const learned = summary(followingTables[1]);
    const earned = summary(followingTables[2]);

    return {
      label: match[1],
      level: text(previousLevels.at(-1)),
      gpa: learned["เกรดเฉลี่ย"] || "-",
      creditsStudied: learned["รวมหน่วยกิตที่เรียน"] || "-",
      creditsEarned: earned["รวมหน่วยกิตที่ได้"] || "-",
      rank: earned["ลำดับที่ ห้อง/ระดับชั้น"] || "-",
      courses
    };
  }).filter(Boolean);

  if (!parsedSemesters.length) throw new Error("No semester tables were found in this file.");

  return {
    student,
    semesters: parsedSemesters,
    evaluationRequired: text(documentFromFile.body).includes("ยังไม่ได้ประเมินครูผู้สอน")
  };
}

function makeCell(value, row) {
  const cell = document.createElement(row ? "th" : "td");
  cell.textContent = value;
  return cell;
}

function showRecord(record) {
  semesters = record.semesters;
  get("studentName").textContent = record.student.name;
  get("studentId").textContent = record.student.id;
  get("studentClass").textContent = record.student.classroom;
  get("studentNumber").textContent = record.student.number;
  get("evaluationWarning").hidden = !record.evaluationRequired;

  let totalCredits = 0;
  let weightedPoints = 0;
  semesters.forEach((semester) => {
    const credits = Number(semester.creditsEarned) || 0;
    totalCredits += credits;
    weightedPoints += (Number(semester.gpa) || 0) * credits;
  });
  get("cumulativeGpa").textContent = totalCredits ? (weightedPoints / totalCredits).toFixed(2) : "-";
  get("totalCredits").textContent = totalCredits.toFixed(1);
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
  get("clearButton").disabled = false;
  get("message").className = "message success";
  get("message").textContent = `Loaded ${semesters.length} semesters successfully.`;
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

get("resultFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  get("message").className = "message";
  get("message").textContent = "Reading file...";
  try {
    showRecord(parseResultFile(await file.text()));
  } catch (error) {
    get("results").hidden = true;
    get("clearButton").disabled = true;
    get("message").textContent = error.message;
  }
});

get("semesterSelect").addEventListener("change", (event) => showSemester(Number(event.target.value)));

get("clearButton").addEventListener("click", () => {
  semesters = [];
  get("resultFile").value = "";
  get("results").hidden = true;
  get("clearButton").disabled = true;
  get("message").className = "message";
  get("message").textContent = "Results cleared.";
});
