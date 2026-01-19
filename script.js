async function analyzeResume() {
  const file = document.getElementById("resumeFile").files[0];
  const resultsCard = document.getElementById("results");
  const scoreCircle = document.getElementById("scoreCircle");
  const scoreDetails = document.getElementById("scoreDetails");

  if (!file) {
    alert("Please upload a resume file.");
    return;
  }

  let resumeText = "";

  // PDF processing
  if (file.name.endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      resumeText += content.items.map(item => item.str).join(" ");
    }
  }

  // DOCX processing
  if (file.name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    resumeText = result.value;
  }

  resumeText = resumeText.toLowerCase();

  // ATS Scoring (basic: keyword, length, sections)
  const keywords = resumeText.match(/\b[a-z]{3,}\b/g) || [];
  const uniqueKeywords = [...new Set(keywords)];
  const matched = uniqueKeywords.length;

  const lengthScore = resumeText.length > 1500 ? 20 : 10;
  const sectionScore =
    resumeText.includes("experience") &&
    resumeText.includes("skills") &&
    resumeText.includes("education") ? 30 : 15;

  const atsScore = Math.min(100, matched / uniqueKeywords.length * 50 + lengthScore + sectionScore);

  // Animate Score
  let displayedScore = 0;
  resultsCard.style.display = "block";
  scoreDetails.innerHTML = "";
  const interval = setInterval(() => {
    if (displayedScore >= atsScore) {
      clearInterval(interval);
    } else {
      displayedScore++;
      scoreCircle.textContent = displayedScore + "%";
    }
  }, 15);

  // Show detailed results
  scoreDetails.innerHTML = `
    <p><b>Resume Length:</b> ${lengthScore === 20 ? "Good" : "Too Short"}</p>
    <p><b>Sections:</b> ${sectionScore === 30 ? "Complete" : "Incomplete"}</p>
    <hr>
    <p><b>Resume Preview:</b></p>
    <textarea readonly>${resumeText}</textarea>
  `;
}

// Drag and drop support
const uploadSection = document.getElementById("uploadSection");
uploadSection.addEventListener("dragover", e => {
  e.preventDefault();
  uploadSection.style.background = "rgba(0,123,255,0.1)";
});
uploadSection.addEventListener("dragleave", e => {
  e.preventDefault();
  uploadSection.style.background = "transparent";
});
uploadSection.addEventListener("drop", e => {
  e.preventDefault();
  uploadSection.style.background = "transparent";
  const fileInput = document.getElementById("resumeFile");
  fileInput.files = e.dataTransfer.files;
});
document.getElementById("checkBtn").addEventListener("click", analyzeResume);
