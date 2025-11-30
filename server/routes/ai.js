const express = require('express');
const router = express.Router(); 
const pdf = require('pdf-parse'); 
const mammoth = require('mammoth'); 
const { protect } = require('./auth'); 
const fetch = global.fetch;

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

// --- UTILITIES (Same as before) ---
const callGeminiApi = async (url, options, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok || (response.status < 500 && response.status !== 429)) return response;
            const delay = Math.pow(2, attempt) * 1000;
            if (attempt < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delay));
            else throw new Error(`API call failed with status: ${response.status}`);
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
        }
    }
};
 
const getGeminiResponse = async (systemInstruction, contents, res, generationConfig = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing.' });

    const payload = {
        contents: contents,
        systemInstruction: { parts: [{ text: systemInstruction }] }, 
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    };

    try {
        const response = await callGeminiApi(
            `${API_BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`, 
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) return res.status(500).json({ success: false, error: 'AI generation failed.' });
        return generatedText.trim();
    } catch (err) {
        console.error('Gemini API Error:', err.message);
        res.status(500).json({ success: false, error: 'Internal AI error.' });
        return null; 
    }
}

// --- 1. Context-Aware Refinement ---
router.post('/refine', protect, async (req, res) => {
    const { resumeText, fullResume, sectionType } = req.body; // Get sectionType

    if (!resumeText) return res.status(400).json({ success: false, error: 'No text provided.' });
    
    // Build Context (Same as before)
    let contextStr = "";
    if (fullResume) {
        contextStr = `
        CONTEXT FROM USER'S RESUME:
        - Job Title: ${fullResume.personal?.title || 'N/A'}
        - Skills: ${fullResume.skills || 'N/A'}
        - Experience Keywords: ${fullResume.experience?.map(e => e.title).join(', ') || ''}
        `;
    }

    // --- NEW: DYNAMIC PROMPT LOGIC ---
    let specificInstruction = "";

    if (sectionType === 'summary') {
        // PROMPT FOR "ABOUT ME" (First Person, Narrative)
        specificInstruction = `
        This is an "About Me" section.
        Refine the text to be a first-person narrative (using "I", "my", "I am").
        It should sound personal but professional, highlighting the user's strengths and goals.
        Do NOT use bullet points. Write it as a cohesive paragraph. Try to mention what the user did from the data provided to you to add a personal touch.
        Please Keep it VERY short. 3-4 lines maximum.
        Try to make it unique and sound Human-like.
        `;
    } else {
        // PROMPT FOR "EXPERIENCE" (Action Verbs, No "I")
        specificInstruction = `
        This is a "Work Experience" section.
        Refine the text to be action-oriented, impactful, and concise. 
        Each sentence should be a new line, a lot like bullet points without the bullet.
        Keep it Short.
        `;
    }

    const systemInstruction = `You are a professional resume editor. 
    ${contextStr}
    
    YOUR INSTRUCTIONS:
    ${specificInstruction}
    
    Use the context provided (Skills/Job Title) to enhance the content.`;
    
    const contents = [{ parts: [{ text: `Refine this text: "${resumeText}"` }] }];

    const refinedText = await getGeminiResponse(systemInstruction, contents, res);
    if (refinedText) res.status(200).json({ success: true, refinedText });
});

// --- 2. Context-Aware Chat ---
router.post('/chat', protect, async (req, res) => {
    // NOW ACCEPTING fullResume
    const { conversation, fullResume } = req.body;

    if (!conversation) return res.status(400).json({ success: false, error: 'No conversation history.' });

    const chatHistoryParts = conversation.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    // Inject the full resume as the "System Context" for the user
    const resumeContext = fullResume ? JSON.stringify(fullResume, null, 2) : "No resume data available.";

    const systemInstruction = `You are an expert resume consultant named "Gemini Assistant".
    
    CURRENT RESUME DATA (JSON):
    ${resumeContext}

    INSTRUCTIONS:
    1. Use the JSON data above to answer specific questions (e.g., "What skills am I missing for a React job?").  
    2. Be encouraging but professional.
    `;
    
    // We don't need to inject context in the message history anymore, the system instruction handles it.
    const responseText = await getGeminiResponse(systemInstruction, chatHistoryParts, res);

    if (responseText) res.status(200).json({ success: true, response: responseText });
});

// --- 3. Parsing (Unchanged) ---
router.post('/parse', protect, async (req, res) => {
    // ... (Keep your existing parsing logic exactly as is) ...
    //
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded.' });
    const file = req.file;
    let resumeText = '';

    try {
        if (file.mimetype === 'application/pdf') {
            const data = await pdf(file.buffer);
            resumeText = data.text;
        } else if (file.originalname.endsWith('.docx')) {
            const data = await mammoth.extractRawText({ buffer: file.buffer });
            resumeText = data.value;
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported file type.' });
        }
        
        const RESUME_SCHEMA = {
            type: "OBJECT",
            properties: {
                personal: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING" },
                        title: { type: "STRING" },
                        phone: { type: "STRING" },
                        email: { type: "STRING" },
                        linkedin: { type: "STRING" },
                        city: { type: "STRING" }
                    }
                },
                summary: { type: "STRING" },
                experience: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            company: { type: "STRING" },
                            title: { type: "STRING" },
                            startDate: { type: "STRING" },
                            endDate: { type: "STRING" },
                            description: { type: "STRING" }
                        }
                    }
                },
                education: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            institution: { type: "STRING" },
                            degree: { type: "STRING" },
                            startYear: { type: "STRING" },
                            endYear: { type: "STRING" }
                        }
                    }
                },
                skills: { type: "STRING" }
            }
        };

        const generationConfig = { responseMimeType: "application/json", responseSchema: RESUME_SCHEMA };
        const systemInstruction = "Extract resume data from the text below into strict JSON.";
        const contents = [{ parts: [{ text: resumeText }] }];
        const jsonString = await getGeminiResponse(systemInstruction, contents, res, generationConfig);

        if (jsonString) {
            res.status(200).json({ success: true, extractedData: JSON.parse(jsonString) });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Parse failed' });
    }
});

// --- 4. Cover Letter Generation ---
router.post('/cover-letter', protect, async (req, res) => {
    const { resumeData, jobDescription } = req.body;

    if (!resumeData || !jobDescription) {
        return res.status(400).json({ success: false, error: 'Missing data.' });
    }

    const systemInstruction = `
        You are an expert career coach and professional copywriter.
        
        TASK:
        Write a highly tailored, professional Cover Letter based on the candidate's Resume and the target Job Description.
        
        CANDIDATE CONTEXT:
        Name: ${resumeData.personal?.name}
        Title: ${resumeData.personal?.title}
        Skills: ${resumeData.skills}
        Experience: ${JSON.stringify(resumeData.experience?.map(e => ({ title: e.title, company: e.company })))}

        JOB DESCRIPTION:
        "${jobDescription.substring(0, 2000)}" (truncated for brevity)

        GUIDELINES:
        1. Structure: Professional Header -> Hook (Intro) -> The "Why Me" (Match skills to JD) -> The "Why You" (Company fit) -> Call to Action.
        2. Tone: Confident, professional, yet human. Avoid generic fluff like "I am writing to apply...". Start strong.
        3. Formatting: Use standard business letter formatting.
        4. Output: Return ONLY the cover letter text. No markdown block wrapper.\
        5. The response must not contain any markdown, citation markers, tags, or text in square brackets. Provide the output as plain text.
        6. Add bulletpoints if you think they are necessary.
    `;

    const contents = [{ parts: [{ text: "Generate my cover letter." }] }];

    const coverLetter = await getGeminiResponse(systemInstruction, contents, res);
    
    if (coverLetter) {
        res.status(200).json({ success: true, coverLetter });
    }
});




module.exports = router;