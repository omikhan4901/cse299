import React from 'react';
import { RESUME_VERSION } from "../../Config/constraints";

// --- Resume Sub-Components & Helpers ---

const BulletPoints = ({ text }) => {
    if (!text) return null;
    return (
        <ul className="list-disc list-inside space-y-1 mt-2 text-gray-700 dark:text-gray-300 ml-5">
            {text.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line.trim()}</li>
            ))}
        </ul>
    );
};

const ExperiencePreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">{item.title || 'Job Title'}</h4>
                <p className="text-md italic text-gray-600 dark:text-gray-400">{item.company || 'Company Name'}</p>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-500 flex-shrink-0 ml-4">{item.startDate} - {item.endDate}</span>
        </div>
        <BulletPoints text={item.description} />
    </div>
);

const EducationPreview = ({ item }) => (
    <div className="mb-4">
        <div className="flex justify-between items-start">
            <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">{item.degree || 'Degree'}</h4>
                <p className="text-md italic text-gray-600 dark:text-gray-400">{item.institution || 'Institution Name'}</p>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-500 flex-shrink-0 ml-4">{item.startYear} - {item.endYear}</span>
        </div>
    </div>
);

const ResumePreview = ({ data }) => {
    return (
        <div id="resume-document" className="p-8 bg-white dark:bg-gray-800 shadow-xl min-h-[11in] w-full max-w-[8.5in] mx-auto print:shadow-none print:p-0 print:m-0 transition-shadow duration-300 hover:shadow-2xl">
            {/* Header / Personal Info */}
            <header className="text-center pb-3 border-b-2 border-indigo-600 dark:border-indigo-400 mb-4">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">{data.personal.name || 'Your Name'}</h1>
                <p className="text-md font-medium text-indigo-700 dark:text-indigo-400 mb-2">{data.personal.title || 'Professional Title'}</p>
                <div className="text-sm text-gray-600 dark:text-gray-400 flex justify-center flex-wrap gap-x-4">
                    <span>{data.personal.phone}</span> |
                    <span className="text-indigo-600 dark:text-indigo-400">{data.personal.email}</span> |
                    <span>{data.personal.city}</span> |
                    <span className="text-indigo-600 dark:text-indigo-400">{data.personal.linkedin}</span>
                </div>
            </header>

            {/* Summary */}
            {data.summary && (
                <section className="mb-4">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-gray-300 dark:border-gray-700 pb-1 mb-2">Summary</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{data.summary}</p>
                </section>
            )}

            {/* Experience */}
            {data.experience.length > 0 && (
                <section className="mb-4">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-gray-300 dark:border-gray-700 pb-1 mb-2">Experience</h2>
                    {data.experience.map(item => <ExperiencePreview key={item.id} item={item} />)}
                </section>
            )}

            {/* Education */}
            {data.education.length > 0 && (
                <section className="mb-4">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-gray-300 dark:border-gray-700 pb-1 mb-2">Education</h2>
                    {data.education.map(item => <EducationPreview key={item.id} item={item} />)}
                </section>
            )}

            {/* Skills */}
            {data.skills && (
                <section>
                    <h2 className="text-lg font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-gray-300 dark:border-gray-700 pb-1 mb-2">Skills</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{data.skills}</p>
                </section>
            )}
            <footer className="mt-8 text-xs text-gray-400 dark:text-gray-600 text-center border-t pt-2 print:hidden">
                Version {RESUME_VERSION} - Powered by Gemini AI
            </footer>
        </div>
    );
};

export default ResumePreview;
