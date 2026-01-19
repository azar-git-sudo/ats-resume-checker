// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const uploadArea=document.getElementById('uploadArea');
const resumeFile=document.getElementById('resumeFile');
const fileInfo=document.getElementById('fileInfo');
const analyzeBtn=document.getElementById('analyzeBtn');
const loading=document.getElementById('loading');
const results=document.getElementById('results');
const errorMessage=document.getElementById('errorMessage');

uploadArea.addEventListener('dragover',e=>{ e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave',()=>uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop',e=>{ e.preventDefault(); uploadArea.classList.remove('dragover'); 
    const files=e.dataTransfer.files; if(files.length>0){resumeFile.files=files; handleFileSelect();} });

resumeFile.addEventListener('change', handleFileSelect);

function handleFileSelect(){
    const file=resumeFile.files[0];
    if(file){
        document.getElementById('fileName').textContent=file.name;
        document.getElementById('fileSize').textContent=`${(file.size/1024).toFixed(2)} KB`;
        fileInfo.classList.add('active'); analyzeBtn.disabled=false; uploadArea.style.display='none';
        errorMessage.classList.remove('active');
    }
}

function removeFile(){ resumeFile.value=''; fileInfo.classList.remove('active'); analyzeBtn.disabled=true; uploadArea.style.display='block'; errorMessage.classList.remove('active'); }

function showError(msg){ errorMessage.textContent=msg; errorMessage.classList.add('active'); loading.classList.remove('active'); analyzeBtn.disabled=false; }

async function analyzeResume(){
    const file=resumeFile.files[0]; if(!file) return;
    loading.classList.add('active'); analyzeBtn.disabled=true; results.classList.remove('active'); errorMessage.classList.remove('active');
    let resumeText="";

    try{
        if(file.name.endsWith(".pdf")){
            const arrayBuffer=await file.arrayBuffer();
            const pdf=await pdfjsLib.getDocument({data:arrayBuffer,disableAutoFetch:true,disableStream:true}).promise;
            for(let i=1;i<=pdf.numPages;i++){ const page=await pdf.getPage(i); const content=await page.getTextContent(); resumeText+=content.items.map(item=>item.str).join(" ")+"\n"; }
        } else if(file.name.endsWith(".docx")){
            const arrayBuffer=await file.arrayBuffer();
            const result=await mammoth.extractRawText({arrayBuffer});
            resumeText=result.value;
        } else throw new Error("Unsupported file format.");
        if(!resumeText.trim()) throw new Error("Unable to extract text from file.");

        // Send to OpenAI API
        const analysis=await analyzeWithAI(resumeText);
        displayResultsAI(analysis,resumeText);

    } catch(err){ console.error(err); showError(err.message); }
    finally{ loading.classList.remove('active'); analyzeBtn.disabled=false; }
}

// Replace with your OpenAI API key
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';

async function analyzeWithAI(resumeText){
    const prompt=`You are an expert career advisor and ATS analyzer. Analyze the following resume text. 
Provide:
1. ATS score out of 100
2. Areas of improvement in bullet points
3. Summary of strengths
4. Suggestions for improvement
Return JSON like: { "score": 85, "recommendations": ["..."], "summary":"..." } 
Resume Text: """${resumeText}"""`;

    const response=await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'Authorization':`Bearer ${OPENAI_API_KEY}`
        },
        body:JSON.stringify({
            model:'gpt-4',
            messages:[{role:'user',content:prompt}],
            temperature:0.3,
            max_tokens:500
        })
    });

    const data=await response.json();
    let text=data.choices[0].message.content;
    try { return JSON.parse(text); }
    catch { 
        // fallback parsing if AI returns string
        return {score:80,recommendations:[text],summary:text};
    }
}

function displayResultsAI(analysis,resumeText){
    document.getElementById('scoreValue').textContent=analysis.score;
    let rating='',ratingClass='';
    if(analysis.score>=80){ rating='🌟 Excellent'; ratingClass='status-good'; }
    else if(analysis.score>=60){ rating='👍 Good'; ratingClass='status-good'; }
    else if(analysis.score>=40){ rating='⚠️ Needs Improvement'; ratingClass='status-warning'; }
    else{ rating='❌ Poor'; ratingClass='status-error'; }

    const ratingEl=document.getElementById('scoreRating');
    ratingEl.textContent=rating; ratingEl.className='score-rating '+ratingClass;

    document.getElementById('recommendationsList').innerHTML=analysis.recommendations.map(r=>`<li>${r}</li>`).join('');
    document.getElementById('previewText').textContent=resumeText.substring(0,2000)+(resumeText.length>2000?'...':'');
    results.classList.add('active');
}

// Reset
function resetAnalysis(){ results.classList.remove('active'); removeFile(); }

// PDF Report generation
function generatePDF(){
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF();
    doc.setFontSize(20); doc.text("ATS Resume Analysis Report",20,20);
    doc.setFontSize(12); 
    doc.text(`Score: ${document.getElementById('scoreValue').textContent}`,20,40);
    doc.text("Recommendations:",20,50);
    const recommendations=[...document.querySelectorAll('#recommendationsList li')].map(li=>li.textContent);
    recommendations.forEach((r,i)=>doc.text(`- ${r}`,20,60+i*10));
    doc.save('ATS_Report.pdf');
}
