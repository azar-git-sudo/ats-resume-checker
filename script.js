// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const uploadArea = document.getElementById('uploadArea');
const resumeFile = document.getElementById('resumeFile');
const fileInfo = document.getElementById('fileInfo');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const errorMessage = document.getElementById('errorMessage');

// Drag and drop
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => { uploadArea.classList.remove('dragover'); });
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length>0){ resumeFile.files = files; handleFileSelect(); }
});

resumeFile.addEventListener('change', handleFileSelect);

function handleFileSelect() {
  const file = resumeFile.files[0];
  if (!file) return;
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = `${(file.size/1024).toFixed(2)} KB`;
  fileInfo.classList.add('active');
  analyzeBtn.disabled = false;
  uploadArea.style.display = 'none';
  errorMessage.classList.remove('active');
}

function removeFile() {
  resumeFile.value = '';
  fileInfo.classList.remove('active');
  analyzeBtn.disabled = true;
  uploadArea.style.display = 'block';
  errorMessage.classList.remove('active');
}

function showError(msg){
  errorMessage.textContent = msg;
  errorMessage.classList.add('active');
  loading.classList.remove('active');
  analyzeBtn.disabled = false;
}

async function analyzeResume(){
  const file = resumeFile.files[0];
  if(!file) return;
  loading.classList.add('active');
  analyzeBtn.disabled = true;
  results.classList.remove('active');
  errorMessage.classList.remove('active');

  let resumeText = '';
  try {
    if(file.name.endsWith(".pdf")){
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data:arrayBuffer,verbosity:0,disableAutoFetch:true,disableStream:true}).promise;
      for(let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        resumeText += content.items.map(item=>item.str).join(" ")+"\n";
      }
    } else if(file.name.endsWith(".docx")){
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({arrayBuffer});
      resumeText = result.value;
    } else throw new Error("Unsupported file format. Please upload PDF or DOCX.");
    if(!resumeText.trim()) throw new Error("Unable to extract text from file.");
    
    const analysis = analyzeResumeContent(resumeText);
    displayResults(analysis,resumeText);

  } catch(err){
    console.error(err);
    showError(`Error: ${err.message}`);
  } finally { loading.classList.remove('active'); analyzeBtn.disabled = false; }
}

function analyzeResumeContent(text){
  const lower = text.toLowerCase();
  const sections = {
    experience:/experience|work history|employment/i.test(text),
    education:/education|academic|degree/i.test(text),
    skills:/skills|technical|competencies/i.test(text),
    contact:/email|phone|linkedin/i.test(text),
    summary:/summary|objective|profile/i.test(text)
  };
  const sectionCount = Object.values(sections).filter(v=>v).length;
  const sectionScore = Math.min(30,sectionCount*6);
  const wordCount = text.split(/\s+/).filter(w=>w.length>0).length;
  const lengthScore = wordCount>=300&&wordCount<=1000?20:wordCount>1000?15:10;
  const hasBullets=/[•\-\*]/.test(text), hasNumbers=/\d+/.test(text), hasEmail=/\S+@\S+\.\S+/.test(text), hasPhone=/\d{3}[-.]?\d{3}[-.]?\d{4}/.test(text);
  const formatScore = (hasBullets?5:0)+(hasNumbers?5:0)+(hasEmail?5:0)+(hasPhone?5:0);
  const keywords=['managed','developed','led','created','implemented','achieved','improved','analyzed','designed','coordinated'];
  const keywordCount = keywords.filter(k=>lower.includes(k)).length;
  const keywordScore = Math.min(15,keywordCount*2);
  const actionVerbs=['achieved','improved','trained','mentored','created','designed','implemented','launched','reduced','increased'];
  const verbCount = actionVerbs.filter(v=>lower.includes(v)).length;
  const verbScore = Math.min(15,verbCount*2);
  const totalScore = sectionScore+lengthScore+formatScore+keywordScore+verbScore;
  return {score:totalScore,sections,sectionCount,wordCount,hasBullets,hasNumbers,hasEmail,hasPhone,keywordCount,verbCount,lengthScore,formatScore,sectionScore,keywordScore,verbScore};
}

function displayResults(a,text){
  const {score,sections,sectionCount,wordCount,hasBullets,hasNumbers,hasEmail,hasPhone,verbCount}=a;
  document.getElementById('scoreValue').textContent=score;
  let rating='',ratingClass='';
  if(score>=80){rating='🌟 Excellent'; ratingClass='status-good';}
  else if(score>=60){rating='👍 Good'; ratingClass='status-good';}
  else if(score>=40){rating='⚠️ Needs Improvement'; ratingClass='status-warning';}
  else{rating='❌ Poor'; ratingClass='status-error';}
  const ratingEl=document.getElementById('scoreRating');
  ratingEl.textContent=rating;
  ratingEl.className='score-rating '+ratingClass;

  const metricsHTML=`
    <div class="metric-card">
      <h4>📝 Sections Found</h4>
      <div class="metric-value">${sectionCount}/5</div>
      <span class="metric-status ${sectionCount>=4?'status-good':sectionCount>=3?'status-warning':'status-error'}">
        ${sectionCount>=4?'Complete':sectionCount>=3?'Acceptable':'Incomplete'}
      </span>
    </div>
    <div class="metric-card">
      <h4>📊 Word Count</h4>
      <div class="metric-value">${wordCount}</div>
      <span class="metric-status ${wordCount>=300&&wordCount<=1000?'status-good':'status-warning'}">
        ${wordCount>=300&&wordCount<=1000?'Optimal':wordCount<300?'Too Short':'Too Long'}
      </span>
    </div>
    <div class="metric-card">
      <h4>🎯 Action Verbs</h4>
      <div class="metric-value">${verbCount}</div>
      <span class="metric-status ${verbCount>=5?'status-good':verbCount>=3?'status-warning':'status-error'}">
        ${verbCount>=5?'Strong':verbCount>=3?'Fair':'Weak'}
      </span>
    </div>
    <div class="metric-card">
      <h4>🔑 Key Elements</h4>
      <div class="metric-value">${[hasBullets,hasNumbers,hasEmail,hasPhone].filter(v=>v).length}/4</div>
      <span class="metric-status ${[hasBullets,hasNumbers,hasEmail,hasPhone].filter(v=>v).length>=3?'status-good':'status-warning'}">
        ${[hasBullets,hasNumbers,hasEmail,hasPhone].filter(v=>v).length>=3?'Well Formatted':'Needs Work'}
      </span>
    </div>
  `;
  document.getElementById('metricsGrid').innerHTML=metricsHTML;

  const recommendations=[];
  if(!sections.experience) recommendations.push('Add a clear "Experience" section');
  if(!sections.education) recommendations.push('Include an "Education" section');
  if(!sections.skills) recommendations.push('Add a dedicated "Skills" section');
  if(!sections.contact) recommendations.push('Include complete contact information');
  if(!hasBullets) recommendations.push('Use bullet points for readability');
  if(!hasNumbers) recommendations.push('Quantify achievements with numbers');
  if(verbCount<5) recommendations.push('Use more action verbs');
  if(wordCount<300) recommendations.push('Expand your resume for details');
  if(wordCount>1000) recommendations.push('Consider condensing content');
  if(!sections.summary) recommendations.push('Add a professional summary at the top');
  if(recommendations.length===0){recommendations.push('Great job! Resume is well-optimized');}

  document.getElementById('recommendationsList').innerHTML=recommendations.map(r=>`<li>${r}</li>`).join('');
  document.getElementById('previewText').textContent=text.substring(0,2000)+(text.length>2000?'...':'');
  results.classList.add('active');
}

function resetAnalysis(){ results.classList.remove('active'); removeFile(); }
