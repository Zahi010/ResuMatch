const API_BASE_URL = 'http://localhost:8000/api/v1';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ANALYZE_JOB') {
    handleJobAnalysis(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate we will send response asynchronously
    return true; 
  } else if (request.action === 'SAVE_JOB') {
    handleSaveJob(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
      
    return true;
  }
});

async function handleSaveJob(jobData) {
  const storage = await chrome.storage.local.get(['token', 'activeResumeId']);
  
  if (!storage.token) {
    throw new Error('Not logged in. Please log in via the extension popup.');
  }
  
  const payload = {
    job_title: jobData.job_title,
    company: jobData.company,
    url: jobData.url,
    job_description_id: jobData.job_description_id,
    status: "Saved",
    location: jobData.location,
    application_method: jobData.application_method,
    contact_person: jobData.contact_person,
    contact_url: jobData.contact_url,
    work_mode: jobData.work_mode,
    job_type: jobData.job_type,
    resume_id: storage.activeResumeId || null
  };

  const res = await fetch(`${API_BASE_URL}/tracker/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${storage.token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error('Failed to save job to tracker.');
  }

  return await res.json();
}

async function handleJobAnalysis(jobData) {
  // 1. Get token and active resume
  const storage = await chrome.storage.local.get(['token', 'activeResumeId']);
  
  if (!storage.token) {
    throw new Error('Not logged in. Please log in via the extension popup.');
  }
  
  if (!storage.activeResumeId) {
    throw new Error('No resume selected. Please select an active resume in the extension popup.');
  }

  // 2. Create Job Description
  const jdPayload = {
    title: jobData.title || "Unknown Job",
    company: jobData.company || "Unknown Company",
    raw_text: jobData.description
  };

  const jdRes = await fetch(`${API_BASE_URL}/job-descriptions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${storage.token}`
    },
    body: JSON.stringify(jdPayload)
  });

  if (!jdRes.ok) {
    throw new Error('Failed to create Job Description on the server.');
  }
  
  const jd = await jdRes.json();

  // 3. Trigger Analysis
  const analyzePayload = {
    resume_id: storage.activeResumeId,
    job_description_id: jd.id
  };

  const analyzeRes = await fetch(`${API_BASE_URL}/analyses/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${storage.token}`
    },
    body: JSON.stringify(analyzePayload)
  });

  if (!analyzeRes.ok) {
    throw new Error('Failed to analyze the resume.');
  }

  const analysisResult = await analyzeRes.json();
  return analysisResult;
}
