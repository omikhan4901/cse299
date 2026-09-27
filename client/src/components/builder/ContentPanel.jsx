"use client";

import { useState } from "react";
import { Input, Button, Select, Checkbox, Tooltip, Popconfirm, App } from "antd";
import {
  User, FileText, Briefcase, GraduationCap, FolderGit2, Award, Wrench, Languages,
  ChevronDown, ChevronUp, ArrowUp, ArrowDown, Copy, Trash2, Plus, Camera, X,
} from "lucide-react";
import { dateRange, splitList } from "@/lib/resume";
import { processPhoto } from "./photo";
import { AiButton } from "./ai";

const { TextArea } = Input;

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span> : null}
    </label>
  );
}

function SectionCard({ icon: Icon, title, meta, open, onToggle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,31,42,0.04)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${open ? "bg-brand text-white" : "bg-brand-50 text-brand"}`}>
          <Icon size={17} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          {meta ? <span className="block text-xs text-slate-400">{meta}</span> : null}
        </span>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open ? <div className="border-t border-slate-100 px-4 pt-4 pb-5">{children}</div> : null}
    </section>
  );
}

function PersonalForm({ personal, setPersonal }) {
  const { message } = App.useApp();
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPersonal("profilePic", await processPhoto(file));
    } catch (err) {
      message.error(err.message);
    }
  };
  const input = (field, props = {}) => (
    <Input value={personal[field]} onChange={(e) => setPersonal(field, e.target.value)} {...props} />
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          {personal.profilePic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={personal.profilePic} alt="Profile" className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Camera size={24} />
            </div>
          )}
          {personal.profilePic ? (
            <button type="button" onClick={() => setPersonal("profilePic", "")} className="absolute -top-1 -right-1 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-500" aria-label="Remove photo">
              <X size={12} />
            </button>
          ) : null}
        </div>
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand">
            <Camera size={15} /> {personal.profilePic ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPhoto} />
          </label>
          <p className="mt-1.5 text-[11px] text-slate-400">Optional. Shown on templates with a photo area.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" className="col-span-2 sm:col-span-1">{input("name", { placeholder: "Jane Doe", autoComplete: "name" })}</Field>
        <Field label="Job title" className="col-span-2 sm:col-span-1">{input("title", { placeholder: "Full Stack Developer" })}</Field>
        <Field label="Email" className="col-span-2 sm:col-span-1">{input("email", { placeholder: "you@example.com", type: "email", autoComplete: "email" })}</Field>
        <Field label="Phone" className="col-span-2 sm:col-span-1">{input("phone", { placeholder: "+880 1XXX-XXXXXX", autoComplete: "tel" })}</Field>
        <Field label="Location" className="col-span-2 sm:col-span-1">{input("city", { placeholder: "Dhaka, Bangladesh" })}</Field>
        <Field label="LinkedIn" className="col-span-2 sm:col-span-1">{input("linkedin", { placeholder: "linkedin.com/in/username" })}</Field>
        <Field label="Website or portfolio" className="col-span-2">{input("website", { placeholder: "github.com/username or yoursite.com" })}</Field>
      </div>
    </div>
  );
}

const LISTS = {
  experience: {
    title: "Experience",
    icon: Briefcase,
    add: "Add position",
    heading: (it) => it.title || "Untitled position",
    sub: (it) => [it.company, dateRange(it.startDate, it.endDate)].filter(Boolean).join(" · "),
    fields: [
      { name: "title", label: "Job title", placeholder: "Software Engineer" },
      { name: "company", label: "Company", placeholder: "Acme Inc." },
      { name: "startDate", label: "Start date", placeholder: "Jan 2022" },
      { name: "endDate", label: "End date", placeholder: "Dec 2023", present: true },
      { name: "location", label: "Location", placeholder: "Remote", wide: true },
      { name: "description", label: "What you achieved", textarea: 5, wide: true, ai: true, placeholder: "Built …\nReduced … by 30%\nLed …", hint: "One point per line. Start with a strong verb and add numbers where you can." },
    ],
  },
  education: {
    title: "Education",
    icon: GraduationCap,
    add: "Add education",
    heading: (it) => it.degree || it.institution || "Untitled education",
    sub: (it) => [it.degree ? it.institution : "", dateRange(it.startYear, it.endYear)].filter(Boolean).join(" · "),
    fields: [
      { name: "institution", label: "School or university", placeholder: "North South University", wide: true },
      { name: "degree", label: "Degree", placeholder: "B.Sc. in Computer Science", wide: true },
      { name: "startYear", label: "Start", placeholder: "2021" },
      { name: "endYear", label: "End", placeholder: "2025", present: true },
      { name: "details", label: "Details (optional)", textarea: 2, wide: true, placeholder: "CGPA 3.8/4.0 · Dean's List" },
    ],
  },
  projects: {
    title: "Projects",
    icon: FolderGit2,
    add: "Add project",
    heading: (it) => it.name || "Untitled project",
    sub: (it) => it.link,
    fields: [
      { name: "name", label: "Project name", placeholder: "ResumeX" },
      { name: "link", label: "Link", placeholder: "github.com/you/project" },
      { name: "description", label: "Description", textarea: 3, wide: true, placeholder: "What it does and what you built", hint: "One point per line." },
    ],
  },
  certifications: {
    title: "Certifications",
    icon: Award,
    add: "Add certification",
    heading: (it) => it.name || "Untitled certification",
    sub: (it) => [it.issuer, it.date].filter(Boolean).join(" · "),
    fields: [
      { name: "name", label: "Certification", placeholder: "AWS Certified Cloud Practitioner", wide: true },
      { name: "issuer", label: "Issued by", placeholder: "Amazon Web Services" },
      { name: "date", label: "Year", placeholder: "2024" },
    ],
  },
};

function ListForm({ section, items, editor, onRefine, refiningId }) {
  const cfg = LISTS[section];
  const [openId, setOpenId] = useState(items.length === 1 ? items[0].id : null);

  return (
    <div className="space-y-2.5">
      {items.length === 0 ? <p className="text-sm text-slate-400">Nothing here yet — this section is hidden on your resume until you add something.</p> : null}
      {items.map((item, index) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className={`rounded-xl border ${open ? "border-brand-200 bg-brand-50/30" : "border-slate-200"}`}>
            <div className="flex items-center gap-1 py-1.5 pr-1.5 pl-3">
              <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => setOpenId(open ? null : item.id)}>
                <span className="block truncate text-sm font-medium text-ink">{cfg.heading(item)}</span>
                {cfg.sub(item) ? <span className="block truncate text-xs text-slate-400">{cfg.sub(item)}</span> : null}
              </button>
              <Tooltip title="Move up">
                <Button type="text" size="small" icon={<ArrowUp size={14} />} disabled={index === 0} onClick={() => editor.moveItem(section, index, -1)} />
              </Tooltip>
              <Tooltip title="Move down">
                <Button type="text" size="small" icon={<ArrowDown size={14} />} disabled={index === items.length - 1} onClick={() => editor.moveItem(section, index, 1)} />
              </Tooltip>
              <Tooltip title="Duplicate">
                <Button type="text" size="small" icon={<Copy size={14} />} onClick={() => editor.duplicateItem(section, item.id)} />
              </Tooltip>
              <Popconfirm title="Delete this entry?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => editor.removeItem(section, item.id)}>
                <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
              </Popconfirm>
            </div>
            {open ? (
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-3 pt-3 pb-4">
                {cfg.fields.map((f) => {
                  const value = item[f.name];
                  const set = (v) => editor.updateItem(section, item.id, { [f.name]: v });
                  const isPresent = f.present && /^present$/i.test(value.trim());
                  return (
                    <Field key={f.name} label={f.label} hint={f.hint} className={f.wide ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                      {f.textarea ? (
                        <TextArea value={value} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} autoSize={{ minRows: f.textarea, maxRows: 14 }} />
                      ) : (
                        <Input value={value} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} disabled={isPresent} />
                      )}
                      {f.present ? (
                        <Checkbox className="!mt-1.5 !text-xs" checked={isPresent} onChange={(e) => set(e.target.checked ? "Present" : "")}>
                          {section === "education" ? "Currently studying" : "I currently work here"}
                        </Checkbox>
                      ) : null}
                      {f.ai && onRefine ? (
                        <div className="mt-2">
                          <AiButton loading={refiningId === item.id} onClick={() => onRefine(item.id, value)}>
                            Improve with AI
                          </AiButton>
                        </div>
                      ) : null}
                    </Field>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      <Button
        block
        type="dashed"
        icon={<Plus size={15} />}
        onClick={() => setOpenId(editor.addItem(section))}
        className="!h-10"
      >
        {cfg.add}
      </Button>
    </div>
  );
}

function TagsField({ value, onChange, placeholder, suggestions = [] }) {
  const tags = splitList(value);
  return (
    <Select
      mode="tags"
      value={tags}
      tokenSeparators={[","]}
      onChange={(list) => onChange(list.map((s) => s.trim()).filter(Boolean).join(", "))}
      placeholder={placeholder}
      className="w-full"
      open={suggestions.length ? undefined : false}
      options={suggestions.filter((s) => !tags.includes(s)).map((s) => ({ value: s, label: s }))}
      suffixIcon={null}
    />
  );
}

const SKILL_SUGGESTIONS = ["Communication", "Teamwork", "Problem Solving", "Leadership", "JavaScript", "Python", "React", "SQL", "Excel", "Git"];

export default function ContentPanel({ editor, onRefineSummary, onRefineItem, refiningId }) {
  const { resume, setPersonal, setField } = editor;
  const [open, setOpen] = useState("personal");
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));
  const count = (n, word) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "Empty");

  return (
    <div className="space-y-3">
      <SectionCard icon={User} title="Personal details" meta={resume.personal.name || "Name, contact and photo"} open={open === "personal"} onToggle={() => toggle("personal")}>
        <PersonalForm personal={resume.personal} setPersonal={setPersonal} />
      </SectionCard>

      <SectionCard icon={FileText} title="About me" meta={resume.summary ? `${resume.summary.trim().split(/\s+/).length} words` : "Empty"} open={open === "summary"} onToggle={() => toggle("summary")}>
        <TextArea value={resume.summary} onChange={(e) => setField("summary", e.target.value)} autoSize={{ minRows: 5, maxRows: 16 }} placeholder="Two to four sentences about who you are, what you're great at and what you want next." />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">Aim for 40–80 words.</span>
          <AiButton loading={refiningId === "summary"} onClick={onRefineSummary}>
            Improve with AI
          </AiButton>
        </div>
      </SectionCard>

      {["experience", "education", "projects"].map((section) => (
        <SectionCard key={section} icon={LISTS[section].icon} title={LISTS[section].title} meta={count(resume[section].length, "entry").replace("entrys", "entries")} open={open === section} onToggle={() => toggle(section)}>
          <ListForm section={section} items={resume[section]} editor={editor} onRefine={section === "experience" ? onRefineItem : null} refiningId={refiningId} />
        </SectionCard>
      ))}

      <SectionCard icon={Wrench} title="Skills" meta={count(splitList(resume.skills).length, "skill")} open={open === "skills"} onToggle={() => toggle("skills")}>
        <TagsField value={resume.skills} onChange={(v) => setField("skills", v)} placeholder="Type a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
        <p className="mt-2 text-[11px] text-slate-400">Press Enter or type a comma after each skill. 6–12 skills works best.</p>
      </SectionCard>

      <SectionCard icon={Award} title="Certifications" meta={count(resume.certifications.length, "certification")} open={open === "certifications"} onToggle={() => toggle("certifications")}>
        <ListForm section="certifications" items={resume.certifications} editor={editor} />
      </SectionCard>

      <SectionCard icon={Languages} title="Languages" meta={count(splitList(resume.languages).length, "language")} open={open === "languages"} onToggle={() => toggle("languages")}>
        <TagsField value={resume.languages} onChange={(v) => setField("languages", v)} placeholder="e.g. English (Fluent)" suggestions={["English (Fluent)", "Bangla (Native)", "Hindi (Conversational)"]} />
      </SectionCard>
    </div>
  );
}
