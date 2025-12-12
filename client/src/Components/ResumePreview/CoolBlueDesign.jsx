import React from "react";
import { Button, Typography, Space } from "antd";
import {
  EditOutlined,
  PhoneFilled,
  MailFilled,
  EnvironmentFilled,
  GlobalOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph, Link } = Typography;

const CoolBlueDesign = ({ data, onEditSection, editingSection }) => {
  // --- Helper Components ---
  const EditButton = ({ section, className }) => (
    <Button
      type="primary"
      shape="circle"
      icon={<EditOutlined />}
      onClick={() => onEditSection(section)}
      className={`print:hidden absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 ${className}`}
    />
  );

  // Helper for active section styling (Teal themed)
  const getSectionClass = (sectionName) => {
      const isActive = editingSection === sectionName;
      return `relative transition-all duration-300 rounded-lg ${isActive ? 'ring-2 ring-teal-400 bg-teal-50/20 p-2 -m-2' : ''}`;
  };

  const ContactItem = ({ icon, text }) => (
    <div className="flex items-center gap-3 mb-4 text-slate-600">
      <span className="text-teal-600 text-lg">{icon}</span>
      <Text className="text-slate-600 text-sm">{text}</Text>
    </div>
  );

  // Timeline Header (e.g. "01 PROFESSIONAL PROFILE")
  const TimelineHeader = ({ number, title }) => (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-10 h-10 rounded-full border-2 border-rose-100 flex items-center justify-center text-slate-400 font-serif text-lg bg-white shrink-0">
        {number}
      </div>
      <h3 className="text-teal-700 uppercase tracking-widest font-bold text-sm m-0 border-b border-rose-100 w-full pb-1">
        {title}
      </h3>
    </div>
  );

  return (
    <div className="min-h-[11in] bg-white font-sans flex print:min-h-screen relative">
      {/* --- LEFT COLUMN (SIDEBAR) --- */}
      <div className="w-1/3 bg-[#effafa] pt-12 pb-12 px-8 relative border-r border-cyan-100">
        {/* Profile Picture (Overlapping Logic) */}
        <div className={`mb-16 z-20 text-center ${getSectionClass('personal')}`}>
          <EditButton section="personal" className="z-50 -top-2 -right-2" />
          <div className="w-58 h-58 mx-auto rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200 relative right-[-50%] transform translate-x-[-30%] md:right-[-40%] print:right-[-60px]">
            {data.personal.profilePic ? (
              <img
                src={data.personal.profilePic}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                No Photo
              </div>
            )}
          </div>
        </div>

        {/* Contact Section */}
        <div className={`group mb-12 mt-24 ${getSectionClass('personal')}`}>
          <EditButton section="personal" className="top-0 right-0" />
          <h4 className="text-slate-700 uppercase tracking-widest font-bold border-b border-slate-300 pb-2 mb-6">
            Contact
          </h4>

          <ContactItem icon={<PhoneFilled />} text={data.personal.phone} />
          <ContactItem icon={<MailFilled />} text={data.personal.email} />
          <ContactItem icon={<EnvironmentFilled />} text={data.personal.city} />
          {data.personal.linkedin && (
            <div className="flex items-center gap-3 mb-4 text-slate-600">
              <span className="text-teal-600 text-lg">
                <GlobalOutlined />
              </span>
              <Link
                href={`https://${data.personal.linkedin}`}
                target="_blank"
                className="text-slate-600 text-sm ellipsis"
              >
                {data.personal.linkedin}
              </Link>
            </div>
          )}
        </div>

        {/* Skills Section */}
        <div className={`group mb-12 ${getSectionClass('skills')}`}>
          <EditButton section="skills" className="top-0 right-0" />
          <h4 className="text-slate-700 uppercase tracking-widest font-bold border-b border-slate-300 pb-2 mb-6">
            Expertise
          </h4>
          <ul className="list-disc list-inside space-y-3 text-slate-600">
            {data.skills ? (
              data.skills.split(",").map((skill, i) => (
                <li key={i} className="text-sm font-medium">
                  {skill.trim()}
                </li>
              ))
            ) : (
              <li className="text-sm italic text-gray-400">Add skills...</li>
            )}
          </ul>
        </div>
      </div>

      {/* --- RIGHT COLUMN (MAIN CONTENT) --- */}
      <div className="w-2/3 flex flex-col relative">
        {/* Header Banner (Pink Area) */}
        <div className={`h-64 bg-[#fff0f3] flex flex-col justify-center px-12 pl-24 relative ${getSectionClass('personal')}`}>
          <EditButton section="personal" className="top-4 right-4" />

          <h1 className="text-4xl text-slate-700 font-bold uppercase tracking-wide mb-2">
            {data.personal.name ? data.personal.name.split(" ")[0] : "FIRST"}{" "}
            <span className="text-teal-700">
              {data.personal.name
                ? data.personal.name.split(" ").slice(1).join(" ")
                : "NAME"}
            </span>
          </h1>
          <p className="text-slate-500 uppercase tracking-[0.3em] text-sm font-medium">
            {data.personal.title || "PROFESSIONAL TITLE"}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-12 pl-16 pt-8 space-y-10">
          {/* 01 PROFILE */}
          <div className={`group/section ${getSectionClass('summary')}`}>
            <EditButton section="summary" className="-left-10 top-0" />
            <TimelineHeader number="01" title="Professional Profile" />
            <Paragraph className="text-slate-600 leading-relaxed text-sm text-justify">
              {data.summary ||
                "Add a professional summary to introduce yourself..."}
            </Paragraph>
          </div>

          {/* 02 EDUCATION */}
          <div className={`group/section ${getSectionClass('education')}`}>
            <EditButton section="education" className="-left-10 top-0" />
            <TimelineHeader number="02" title="Education" />

            <div className="space-y-6 border-l border-rose-100 ml-5 pl-6 pb-2">
              {(data.education || []).map((item) => (
                <div key={item.id} className="relative break-inside-avoid">
                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white ring-1 ring-rose-100"></div>
                  <h4 className="font-bold text-slate-700 text-base m-0">
                    {item.degree}
                  </h4>
                  <div className="text-sm text-slate-500 mb-1">
                    {item.institution}
                  </div>
                  <div className="text-xs text-teal-600 font-semibold">
                    {item.startYear} - {item.endYear}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 03 EXPERIENCE */}
          <div className={`group/section ${getSectionClass('experience')}`}>
            <EditButton section="experience" className="-left-10 top-0" />
            <TimelineHeader number="03" title="Experience" />

            <div className="space-y-8 border-l border-rose-100 ml-5 pl-6">
              {(data.experience || []).map((item) => (
                <div key={item.id} className="relative break-inside-avoid">
                  <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white ring-1 ring-rose-100"></div>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-bold text-slate-700 text-base m-0">
                      {item.company}
                    </h4>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">
                      {item.startDate} - {item.endDate}
                    </span>
                  </div>
                  <div className="text-sm text-teal-700 font-bold mb-2 uppercase tracking-wide">
                    {item.title}
                  </div>
                  <ul className="list-disc list-outside ml-4 text-sm text-slate-600 space-y-1">
                    {item.description &&
                      item.description
                        .split("\n")
                        .map(
                          (line, i) =>
                            line && (
                              <li key={i}>{line.replace(/^[•-]\s*/, "")}</li>
                            )
                        )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoolBlueDesign;
