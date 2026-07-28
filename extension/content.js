console.log("ResuMatch: Content script loaded successfully on " + window.location.href);
let isAnalyzing = false;
let currentJobUrl = '';

function injectWidget(loading = false, data = null, error = null) {
  // Remove existing widget if any
  const existing = document.getElementById('resumatch-widget');
  if (existing) {
    existing.remove();
  }

  const widget = document.createElement('div');
  widget.id = 'resumatch-widget';
  widget.className = 'glass-panel';

  let content = `
    <div class="widget-header">
      <div class="widget-title">ResuMatch Analysis</div>
      <div style="font-size: 12px; color: #9ca3af;">LinkedIn Extension</div>
    </div>
  `;

  if (loading) {
    content += `
      <div style="text-align: center; padding: 20px 0;">
        <p style="color: #c084fc; font-weight: bold; margin: 0;">Analyzing against Active Resume...</p>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 5px;">This takes about 5-10 seconds.</p>
      </div>
    `;
  } else if (error) {
    content += `
      <div class="error-message">
        <strong>Error:</strong> ${error}
      </div>
      <button id="resumatch-retry" class="glass-button-secondary" style="width: 100%; padding: 8px; border-radius: 6px; color: #fff;">Retry</button>
    `;
  } else if (data) {
    content += `
      <div class="score-container">
        <div class="score-box">
          <div class="score-value" style="color: ${data.match_score >= 70 ? '#34d399' : (data.match_score >= 50 ? '#fbbf24' : '#ef4444')}">${data.match_score}%</div>
          <div class="score-label">Match Score</div>
        </div>
        <div class="score-box">
          <div class="score-value" style="color: ${data.ats_score >= 70 ? '#34d399' : (data.ats_score >= 50 ? '#fbbf24' : '#ef4444')}">${data.ats_score}%</div>
          <div class="score-label">ATS Score</div>
        </div>
      </div>
      <p style="font-size: 12px; color: #d1d5db; margin-bottom: 15px; line-height: 1.4;">
        ${data.analysis_results?.experience_analysis?.verdict || "Analysis complete."}
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="resumatch-view-full" class="glass-button" style="flex: 1; padding: 10px 0;">View Report</button>
        <button id="resumatch-save-tracker" class="glass-button" style="flex: 1; padding: 10px 0; background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); color: #60a5fa;">Save Job</button>
      </div>
    `;
  }

  widget.innerHTML = content;
  document.body.appendChild(widget);

  // Add event listeners if needed
  if (error) {
    document.getElementById('resumatch-retry')?.addEventListener('click', () => {
      isAnalyzing = false;
      checkAndAnalyzeJob();
    });
  } else if (data) {
    document.getElementById('resumatch-view-full')?.addEventListener('click', () => {
      window.open('http://localhost:3000/dashboard', '_blank');
    });

    document.getElementById('resumatch-save-tracker')?.addEventListener('click', (e) => {
      const btn = e.target;
      btn.innerText = "Saving...";
      btn.disabled = true;
      
      const titleText = data.job_description?.title || "Unknown Job";
      const companyText = data.job_description?.company || "Unknown Company";

      // Extract location (Bulletproof fallback)
      let locationText = "";
      try {
        const primaryDesc = document.querySelector('.job-details-jobs-unified-top-card__primary-description') || document.querySelector('.topcard__flavor--bullet');
        if (primaryDesc) {
          locationText = primaryDesc.innerText.split('·')[0].trim();
        }
        if (!locationText) {
          const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          const titleIdx = lines.findIndex(l => l.includes(titleText));
          if (titleIdx !== -1) {
            for (let i = titleIdx + 1; i < Math.min(titleIdx + 10, lines.length); i++) {
               const line = lines[i];
               if (line === companyText) continue;
               if (line.includes('·') || line.includes(',') || line.includes('Area') || line.includes('Remote') || line.includes('Hybrid') || line.includes('On-site')) {
                  locationText = line.split('·')[0].trim();
                  break;
               }
            }
          }
        }
      } catch(e) {
        console.error("ResuMatch: Failed to find location", e);
      }

      // Extract contact person using TreeWalker (ignores all LinkedIn class obfuscation)
      let contactText = "";
      let contactUrl = "";
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let foundMeetTeam = false;
        let node;
        while (node = walker.nextNode()) {
          const val = node.nodeValue.trim();
          if (!foundMeetTeam && val.toLowerCase().includes("meet the hiring team")) {
            foundMeetTeam = true;
            continue;
          }
          if (foundMeetTeam && val.length > 2 && !val.toLowerCase().includes("meet the hiring team")) {
            contactText = val;
            
            // Try to find the link to their profile
            let parent = node.parentElement;
            while (parent && parent.tagName !== 'A' && parent.tagName !== 'BODY') {
               parent = parent.parentElement;
            }
            if (parent && parent.tagName === 'A' && parent.href) {
               contactUrl = parent.href;
            }
            break;
          }
        }
      } catch (e) {
        console.error("ResuMatch: Failed to find contact", e);
      }

      // Extract badges (Work Mode, Job Type)
      let workMode = "";
      let jobType = "";
      
      const checkModeType = (t) => {
         if (!workMode) {
           if (t.includes("On-site") || t.includes("On-Site")) workMode = "On-site";
           else if (t.includes("Hybrid")) workMode = "Hybrid";
           else if (t.includes("Remote")) workMode = "Remote";
         }
         if (!jobType) {
           if (t.includes("Full-time") || t.includes("Full-Time")) jobType = "Full-time";
           else if (t.includes("Part-time") || t.includes("Part-Time")) jobType = "Part-time";
           else if (t.includes("Contract")) jobType = "Contract";
           else if (t.includes("Temporary")) jobType = "Temporary";
           else if (t.includes("Internship")) jobType = "Internship";
           else if (t.includes("Volunteer")) jobType = "Volunteer";
         }
      };

      try {
        const allSpans = Array.from(document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight span, .tvm__text, .ui-label'));
        for (const span of allSpans) {
           checkModeType(span.innerText.trim());
        }
        // Fallback: search raw text top 50 lines
        if (!workMode || !jobType) {
           const lines = document.body.innerText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
           for (let i = 0; i < 50 && i < lines.length; i++) {
              checkModeType(lines[i]);
           }
        }
      } catch (e) {}

      chrome.runtime.sendMessage({ 
        action: 'SAVE_JOB', 
        data: {
          job_title: titleText,
          company: companyText,
          url: window.location.href.split('?')[0],
          job_description_id: data.job_description_id,
          location: locationText,
          application_method: "LinkedIn",
          contact_person: contactText,
          contact_url: contactUrl,
          work_mode: workMode,
          job_type: jobType
        }
      }, (response) => {
        if (response && response.success) {
          btn.innerText = "Saved ✓";
          btn.style.backgroundColor = "rgba(52, 211, 153, 0.15)";
          btn.style.color = "#34d399";
          btn.style.borderColor = "rgba(52, 211, 153, 0.3)";
        } else {
          btn.innerText = "Error";
          btn.disabled = false;
        }
      });
    });
  }
}

function extractJobDetails() {
  console.log("ResuMatch: Attempting to extract job details...");
  
  // Resilient Title Extractors
  let titleNode = document.querySelector('.job-details-jobs-unified-top-card__job-title') || 
                  document.querySelector('.top-card-layout__title') ||
                  document.querySelector('.t-24.t-bold') ||
                  Array.from(document.querySelectorAll('h1')).find(h => h.innerText.length > 5 && !h.innerText.includes('notification'));
                  
  // Resilient Company Extractors
  let companyNode = document.querySelector('.job-details-jobs-unified-top-card__company-name') || 
                    document.querySelector('.job-details-jobs-unified-top-card__primary-description a') ||
                    document.querySelector('.topcard__org-name-link') ||
                    document.querySelector('.app-aware-link') ||
                    Array.from(document.querySelectorAll('a[href*="/company/"]')).find(a => a.innerText.trim().length > 0);

  // Ultimate Text-Slicing Extractor for Job Description
  let title = "";
  let company = "Unknown Company";
  let description = "";

  if (titleNode) {
    title = titleNode.innerText.trim();
  } else {
    const parts = document.title.split(/ [|\-] /);
    title = parts[0] ? parts[0].trim() : "Unknown Job";
  }

  if (companyNode) {
    company = companyNode.innerText.trim();
  }

  const pageText = document.body.innerText;
  const startRegex = /(About the job|Job description)/i;
  const endRegex = /(Set alert for similar jobs|Show more|Applicant education level|Unlock hiring insights|About\nAccessibility|Industry\n)/i;

  const startMatch = pageText.match(startRegex);
  if (startMatch) {
    let sliced = pageText.substring(startMatch.index);
    // Find the end marker within the sliced text
    const endMatch = sliced.match(endRegex);
    
    if (endMatch && endMatch.index > 100) {
      // Cut it off at the end marker
      description = sliced.substring(0, endMatch.index).trim();
    } else {
      // Fallback: just take the next 5000 characters
      description = sliced.substring(0, 5000).trim();
    }
    
    // Clean up the "About the job" header text
    description = description.replace(/^(About the job|Job description)\s*/i, '');
  } else {
    // If we can't find "About the job", just grab a chunk of the page text
    description = pageText.substring(0, 3000);
  }

  if (description.length < 150) {
    console.log("ResuMatch: Description too short (<150 chars). Still waiting for page load...");
    return null;
  }

  console.log("ResuMatch: Successfully extracted job:", title, "at", company);
  return { title, company, description };
}

function checkAndAnalyzeJob() {
  // Only trigger if URL changed or we haven't analyzed yet
  if (window.location.href === currentJobUrl && isAnalyzing) {
    return;
  }

  // Only run on job pages
  if (!window.location.href.includes('/jobs/')) {
    const existing = document.getElementById('resumatch-widget');
    if (existing) existing.remove();
    return;
  }

  const jobDetails = extractJobDetails();
  
  if (jobDetails && !isAnalyzing) {
    isAnalyzing = true;
    currentJobUrl = window.location.href;
    
    injectWidget(true); // Show loading

    chrome.runtime.sendMessage(
      { action: 'ANALYZE_JOB', data: jobDetails },
      (response) => {
        if (!response) {
          injectWidget(false, null, "Extension disconnected. Please reload the page.");
          return;
        }

        if (response.success) {
          injectWidget(false, response.data);
        } else {
          injectWidget(false, null, response.error);
        }
      }
    );
  }
}

// Fallback: Run every 2 seconds unconditionally
setInterval(() => {
  // If we changed pages, reset analyzer lock
  if (window.location.href !== currentJobUrl) {
    isAnalyzing = false;
  }
  
  // Try to analyze if we are on a job page and not already analyzing
  if (!isAnalyzing && window.location.href.includes('/jobs/')) {
    checkAndAnalyzeJob();
  }
}, 2000);
