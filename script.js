// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Hugging Face token
const HF_API_TOKEN = "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";

const uploadArea = document.getElementById('uploadArea');
const resumeFile = document.getElementById('resumeFile');
const fileInfo = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const errorMessage = document.getElementById('errorMessage');

uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  if(e.dataTransfer.files.length) { resumeFile.files = e.dataTransfer.files; handleFileSelect(); }
});
resumeFile.addEventListener('change', handleFileSelect);

function handleFileSelect() {
  const file = resumeFile.files[0];
  if(file){
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `${(file.size/1024).toFixed(2)} KB`;
    fileInfo.classList.add('active');
    analyzeBtn.disabled = false;
    uploadArea.style.display = 'none';
    errorMessage.classList.remove('active');
  }
}

function removeFile() {
  resumeFile.value = '';
  fileInfo.classList.remove('active');
  analyzeBtn.disabled = true;
  uploadArea.style.display = 'block';
  errorMessage.classList.remove('active');
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.add('active');
  loading.classList.remove('active');
  analyzeBtn.disabled = false;
}

async function analyzeResume() {
  const file = resumeFile.files[0];
  if(!file) return;

  loading.classList.add('active');
  analyzeBtn.disabled = true;
  results.classList.remove('active');
  errorMessage.classList.remove('active');

  let resumeText = "";
  try {
    if(file.name.endsWith(".pdf")){
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for(let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        resumeText += content.items.map(item => item.str).join(" ") + "\n";
      }
    } else if(file.name.endsWith(".docx")){
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      resumeText = result.value;
    } else {
      throw new Error("Unsupported file format. Upload PDF or DOCX.");
    }

    if(!resumeText.trim()) throw new Error("Unable to extract text. Resume may be empty or image-based.");

    // Call Hugging Face AI
    const aiFeedback = await analyzeWithHF(resumeText);

    // Display results
    document.getElementById("recommendationsList").innerHTML = `<li>${aiFeedback.replace(/\n/g,"<br>")}</li>`;
    document.getElementById("previewText").textContent = resumeText.substring(0,2000) + (resumeText.length>2000?"...":"");
    results.classList.add("active");

  } catch(err){
    console.error(err);
    showError(err.message);
  } finally {
    loading.classList.remove('active');
    analyzeBtn.disabled = false;
  }
}

// Hugging Face AI request
async function analyzeWithHF(resumeText){
  const prompt = `Analyze this resume professionally for ATS compatibility:
- Give a score out of 100
- Identify missing sections
- Suggest improvements
- Provide recommendations in bullet points

Resume:
${resumeText}`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/bigscience/bloomz-7b1",
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${HF_API_TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({inputs:prompt})
      }
    );

    const data = await response.json();
    if(Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    if(data.generated_text) return data.generated_text;
    return "No feedback returned.";
  } catch(err){
    console.error(err);
    return "Error connecting to AI service.";
  }
}

function resetAnalysis(){
  results.classList.remove('active');
  removeFile();
}
