const express = require('express');
const router = express.Router(); 

const pdf = require('pdf-parse'); // For PDF
const mammoth = require('mammoth'); // For DOCX
const { protect } = require('./auth'); // Import protect middleware
const fetch = global.fetch;

// Base URL for the Gemini API and the chosen model
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

// --- UTILITIES ---

// Function to handle API call with exponential backoff for stability
const callGeminiApi = async (url, options, maxRetries = 3) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            if (response.ok || (response.status < 500 && response.status !== 429)) {
                return response;
            }

            const delay = Math.pow(2, attempt) * 1000;
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            throw new Error(`API call failed with status: ${response.status}`);
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
        }
    }
};
 
const getGeminiResponse = async (systemInstruction, contents, res, generationConfig = {}) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        }, 
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
    };

    const apiUrl = `${API_BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`;

    try {
        const response = await callGeminiApi(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error('Gemini API response missing text:', result);
            return res.status(500).json({
                success: false,
                error: 'AI generation failed or returned no text.',
            });
        }
        return generatedText.trim();

    } catch (err) {
        console.error('Error calling Gemini API:', err.message);
        res.status(500).json({ success: false, error: 'Internal server error during AI processing.' });
        return null; 
    }
}


// --- 1. Simple Refinement Endpoint ---

// @route   POST /api/ai/refine
// @desc    Refine resume text using the Gemini model (single shot)
// @access  Private
router.post('/refine', protect, async (req, res) => {
    const { resumeText } = req.body;

    if (!resumeText) {
        return res.status(400).json({ success: false, error: 'Please provide resumeText to refine.' });
    }
    
    const systemInstruction = "You are a professional resume assistant. Improve grammar, phrasing, and structure of this resume content while keeping it professional and concise. Maintain bullet point formatting where appropriate. Provide only the refined text in your response.";
    
    const userQuery = `Refine the following resume section text: "${resumeText}"`;
    
    const contents = [{ parts: [{ text: userQuery }] }];

    const refinedText = await getGeminiResponse(systemInstruction, contents, res);

    if (refinedText) {
        res.status(200).json({
            success: true,
            refinedText: refinedText
        });
    }
});


// --- 2. Conversational Chat Endpoint ---

// @route   POST /api/ai/chat
// @desc    Refine resume text using conversational context
// @access  Private
router.post('/chat', protect, async (req, res) => {
    const { conversation, resumeText } = req.body;

    if (!conversation || !resumeText) {
        return res.status(400).json({ success: false, error: 'Both conversation history and resumeText are required.' });
    }

    const chatHistoryParts = conversation.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const initialContext = {
        role: 'user',
        parts: [{ text: `[CONTEXT] The resume section I am working on is currently: \n\n${resumeText}` }]
    };

    const fullContents = [initialContext, ...chatHistoryParts];

    const systemInstruction = `You are a highly specialized, conversational resume assistant focused on editing the provided [CONTEXT]. 
    Analyze the user's latest request in the conversation history. 
    You MUST provide a clear, conversational response. 
    If the user makes a specific edit request, your reply should start with the updated, refined resume text followed by a quick acknowledgment/suggestion. If no edit is requested, simply respond conversationally.
    You must maintain the original formatting (like bullet points) unless explicitly asked to change it.`;
    
    const responseText = await getGeminiResponse(systemInstruction, fullContents, res);

    if (responseText) {
        res.status(200).json({
            success: true,
            response: responseText
        });
    }
});


// --- 3. Resume Parsing Endpoint ---

const RESUME_SCHEMA = {
    type: "OBJECT",
    properties: {
        personal: {
            type: "OBJECT",
            description: "Personal contact information.",
            properties: {
                name: { type: "STRING" },
                title: { type: "STRING" },
                phone: { type: "STRING" },
                email: { type: "STRING" },
                linkedin: { type: "STRING" },
                city: { type: "STRING" }
            }
        },
        summary: { type: "STRING", description: "A concise professional summary." },
        experience: {
            type: "ARRAY",
            description: "List of work experiences. The description should be a multi-line string containing bullet points.",
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
            description: "List of educational degrees and institutions.",
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
        skills: { type: "STRING", description: "All technical and soft skills as a single comma-separated string." }
    }
};


// @route   POST /api/ai/parse
// @desc    Parse an uploaded resume file and extract structured JSON data
// @access  Private 
// NOTE: Multer middleware is applied in server.js before this route handler.
router.post('/parse', protect, async (req, res) => {
    
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded or file field name is incorrect (expected "resumeFile").' });
    }

    const file = req.file;
    let resumeText = '';

    try {
        // 1. Extract raw text from the file buffer
        if (file.mimetype === 'application/pdf') {
            const data = await pdf(file.buffer);
            resumeText = data.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.endsWith('.docx')) {
            const data = await mammoth.extractRawText({ buffer: file.buffer });
            resumeText = data.value;
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload a PDF or DOCX file.' });
        }
        
        if (!resumeText.trim()) {
             return res.status(400).json({ success: false, error: 'Could not extract text from the file. Please try a different file.' });
        }


        // 2. Configure Gemini API for structured JSON output
        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: RESUME_SCHEMA,
        };

        const systemInstruction = "You are a highly accurate data extraction engine. Your task is to extract all relevant resume data from the provided text and format it STRICTLY as the requested JSON object. Do not include any commentary or surrounding text. Ensure all fields are filled to the best of your ability. Skills must be comma-separated.";
        
        const userQuery = `Extract structured resume information from this raw text: \n\n${resumeText}`;
        
        const contents = [{ parts: [{ text: userQuery }] }];

        // 3. Call Gemini API
        const jsonString = await getGeminiResponse(systemInstruction, contents, res, generationConfig);

        if (jsonString) {
            const parsedData = JSON.parse(jsonString);

            // 4. Success: Send the structured data back
            res.status(200).json({
                success: true,
                extractedData: parsedData
            });
        }

    } catch (err) {
        console.error('Error during file processing or AI parsing:', err.message);
        res.status(500).json({ success: false, error: 'Failed to process resume file.' });
    }
});

module.exports = router;
