"use client";

import { useState } from "react";
import { Input, Button, Select, Checkbox, Tooltip, Popconfirm, App, AutoComplete, Switch } from "antd";
import { AnimatePresence, motion } from "motion/react";
import {
  User, FileText, Briefcase, GraduationCap, FolderGit2, Award, Wrench, Languages, HeartHandshake, Trophy, BookOpen,
  Library, Contact, Smile, LayoutList, Link2, ChevronDown, ArrowUp, ArrowDown, Copy, Trash2, Plus, Camera, X, Crop, Lightbulb, ChevronRight, IdCard,
} from "lucide-react";
import { dateRange, splitList, newId, EMPTY_CUSTOM_ITEM } from "@/lib/resume";
import { readPhoto } from "./photo";
import PhotoCropModal from "./PhotoCropModal";
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
    <section className={`rounded-2xl border bg-white transition-shadow duration-300 ${open ? "border-brand-200 shadow-md" : "border-slate-200 shadow-[0_1px_2px_rgba(15,31,42,0.04)] hover:shadow-md"}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={open}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${open ? "scale-105 bg-brand text-white shadow-md shadow-brand/30" : "bg-brand-50 text-brand"}`}>
          <Icon size={17} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          {meta ? <span className="block text-xs text-slate-400">{meta}</span> : null}
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-4 pt-4 pb-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function PersonalForm({ personal, setPersonal }) {
  const { message } = App.useApp();
  // { src, initial } while the crop dialog is open.
  const [cropping, setCropping] = useState(null);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setCropping({ src: await readPhoto(file), initial: null });
    } catch (err) {
      message.error(err.message);
    }
  };

  const adjust = () =>
    setCropping({
      src: personal.profilePicSource || personal.profilePic,
      initial: personal.profilePicSource ? personal.photoCrop : { crop: { x: 0, y: 0 }, zoom: 1 },
      legacy: !personal.profilePicSource,
    });

  const saveCrop = ({ image, source, settings }) => {
    setPersonal("profilePic", image);
    setPersonal("profilePicSource", source);
    setPersonal("photoCrop", settings);
    setCropping(null);
  };

  const removePhoto = () => {
    setPersonal("profilePic", "");
    setPersonal("profilePicSource", "");
    setPersonal("photoCrop", null);
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
            <button type="button" onClick={removePhoto} className="absolute -top-1 -right-1 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-500" aria-label="Remove photo">
              <X size={12} />
            </button>
          ) : null}
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand">
              <Camera size={15} /> {personal.profilePic ? "Change" : "Upload photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPhoto} />
            </label>
            {personal.profilePic ? (
              <button type="button" onClick={adjust} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand">
                <Crop size={15} /> Adjust
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Optional. Shown on templates with a photo area.</p>
        </div>
      </div>
      <PhotoCropModal open={!!cropping} src={cropping?.src} initial={cropping?.initial} legacy={cropping?.legacy} onCancel={() => setCropping(null)} onSave={saveCrop} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Full name" className="col-span-2 sm:col-span-1">{input("name", { placeholder: "Jane Doe", autoComplete: "name" })}</Field>
        <Field label="Job title" className="col-span-2 sm:col-span-1">{input("title", { placeholder: "Full Stack Developer" })}</Field>
        <Field label="Email" className="col-span-2 sm:col-span-1">{input("email", { placeholder: "you@example.com", type: "email", autoComplete: "email" })}</Field>
        <Field label="Phone" className="col-span-2 sm:col-span-1">{input("phone", { placeholder: "+880 1XXX-XXXXXX", autoComplete: "tel" })}</Field>
        <Field label="Location" className="col-span-2 sm:col-span-1">{input("city", { placeholder: "Dhaka, Bangladesh" })}</Field>
        <Field label="LinkedIn" className="col-span-2 sm:col-span-1">{input("linkedin", { placeholder: "linkedin.com/in/username" })}</Field>
        <Field label="GitHub" className="col-span-2 sm:col-span-1">{input("github", { placeholder: "github.com/username" })}</Field>
        <Field label="Website or portfolio" className="col-span-2 sm:col-span-1">{input("website", { placeholder: "yoursite.com" })}</Field>
      </div>
      <details className="group rounded-xl border border-slate-200 px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-slate-600">
          More details <span className="text-xs font-normal text-slate-400">date of birth, nationality — only if expected where you apply</span>
          <ChevronDown size={15} className="text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 pb-1">
          <Field label="Date of birth" className="col-span-2 sm:col-span-1">{input("dateOfBirth", { placeholder: "12 March 2000" })}</Field>
          <Field label="Nationality" className="col-span-2 sm:col-span-1">{input("nationality", { placeholder: "Bangladeshi" })}</Field>
        </div>
      </details>
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
      { name: "location", label: "Location", placeholder: "Remote" },
      { name: "employmentType", label: "Type", placeholder: "Full-time", options: ["Full-time", "Part-time", "Internship", "Contract", "Freelance", "Apprenticeship"] },
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
      { name: "location", label: "Location", placeholder: "Dhaka" },
      { name: "gpa", label: "GPA / grade", placeholder: "3.8 / 4.0" },
      { name: "details", label: "Details (optional)", textarea: 2, wide: true, placeholder: "Thesis, honours, relevant coursework" },
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
      { name: "role", label: "Your role", placeholder: "Lead developer" },
      { name: "startDate", label: "Start", placeholder: "2024" },
      { name: "endDate", label: "End", placeholder: "Present", present: true },
      { name: "link", label: "Link", placeholder: "github.com/you/project", wide: true },
      { name: "technologies", label: "Technologies", placeholder: "React, Node.js, MongoDB", wide: true },
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
      { name: "link", label: "Credential link (optional)", placeholder: "credly.com/badges/…", wide: true },
    ],
  },
  volunteering: {
    title: "Volunteering",
    icon: HeartHandshake,
    add: "Add volunteering",
    heading: (it) => it.role || "Untitled role",
    sub: (it) => [it.organization, dateRange(it.startDate, it.endDate)].filter(Boolean).join(" · "),
    fields: [
      { name: "role", label: "Role", placeholder: "Mentor" },
      { name: "organization", label: "Organisation", placeholder: "Code Club" },
      { name: "startDate", label: "Start", placeholder: "2022" },
      { name: "endDate", label: "End", placeholder: "Present", present: true },
      { name: "location", label: "Location", placeholder: "Dhaka", wide: true },
      { name: "description", label: "What you did", textarea: 3, wide: true, hint: "One point per line." },
    ],
  },
  awards: {
    title: "Awards",
    icon: Trophy,
    add: "Add award",
    heading: (it) => it.title || "Untitled award",
    sub: (it) => [it.issuer, it.date].filter(Boolean).join(" · "),
    fields: [
      { name: "title", label: "Award", placeholder: "Dean's List", wide: true },
      { name: "issuer", label: "Awarded by", placeholder: "North South University" },
      { name: "date", label: "Year", placeholder: "2024" },
      { name: "description", label: "Details (optional)", textarea: 2, wide: true },
    ],
  },
  publications: {
    title: "Publications",
    icon: BookOpen,
    add: "Add publication",
    heading: (it) => it.title || "Untitled publication",
    sub: (it) => [it.publisher, it.date].filter(Boolean).join(" · "),
    fields: [
      { name: "title", label: "Title", wide: true },
      { name: "publisher", label: "Published in / by", placeholder: "IEEE, Medium, …" },
      { name: "date", label: "Date", placeholder: "2025" },
      { name: "link", label: "Link", placeholder: "doi.org/…", wide: true },
      { name: "description", label: "Summary (optional)", textarea: 2, wide: true },
    ],
  },
  courses: {
    title: "Courses",
    icon: Library,
    add: "Add course",
    heading: (it) => it.name || "Untitled course",
    sub: (it) => [it.institution, it.date].filter(Boolean).join(" · "),
    fields: [
      { name: "name", label: "Course", placeholder: "Machine Learning", wide: true },
      { name: "institution", label: "Provider", placeholder: "Coursera" },
      { name: "date", label: "Year", placeholder: "2024" },
    ],
  },
  references: {
    title: "References",
    icon: Contact,
    add: "Add reference",
    heading: (it) => it.name || "Unnamed reference",
    sub: (it) => [it.position, it.company].filter(Boolean).join(", "),
    fields: [
      { name: "name", label: "Name", wide: true },
      { name: "position", label: "Position", placeholder: "Professor" },
      { name: "company", label: "Organisation" },
      { name: "email", label: "Email" },
      { name: "phone", label: "Phone" },
    ],
  },
  links: {
    title: "Other links",
    icon: Link2,
    add: "Add link",
    heading: (it) => it.label || it.url || "New link",
    sub: (it) => (it.label ? it.url : ""),
    fields: [
      { name: "label", label: "Label", placeholder: "Portfolio, Behance, Kaggle…" },
      { name: "url", label: "URL", placeholder: "behance.net/you" },
    ],
  },
};

function ListForm({ section, items, editor, onRefine, refiningId }) {
  const cfg = LISTS[section];
  const [openId, setOpenId] = useState(items.length === 1 ? items[0].id : null);

  return (
    <div className="space-y-2.5">
      {items.length === 0 ? <p className="text-sm text-slate-400">Nothing here yet — this section is hidden on your resume until you add something.</p> : null}
      <AnimatePresence initial={false}>
      {items.map((item, index) => {
        const open = openId === item.id;
        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
            className={`rounded-xl border transition-colors ${open ? "border-brand-200 bg-brand-50/30" : "border-slate-200 hover:border-slate-300"}`}
          >
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
                      ) : f.options ? (
                        <AutoComplete value={value} onChange={set} options={f.options.map((o) => ({ value: o }))} placeholder={f.placeholder} className="w-full" filterOption={(input, o) => o.value.toLowerCase().includes(input.toLowerCase())} />
                      ) : (
                        <Input value={value} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} disabled={isPresent} />
                      )}
                      {f.present ? (
                        <Checkbox className="!mt-1.5 !text-xs" checked={isPresent} onChange={(e) => set(e.target.checked ? "Present" : "")}>
                          {section === "education" ? "Currently studying" : section === "experience" ? "I currently work here" : "Ongoing"}
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
          </motion.div>
        );
      })}
      </AnimatePresence>
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

function CustomSectionsForm({ sections, setResume }) {
  const update = (fn) => setResume((r) => ({ ...r, customSections: fn(r.customSections) }));
  const patchSection = (id, patch) => update((list) => list.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)));
  const patchItem = (sid, iid, patch) =>
    update((list) => list.map((sec) => (sec.id === sid ? { ...sec, items: sec.items.map((it) => (it.id === iid ? { ...it, ...patch } : it)) } : sec)));
  const addItem = (sid) => update((list) => list.map((sec) => (sec.id === sid ? { ...sec, items: [...sec.items, { id: newId(), ...EMPTY_CUSTOM_ITEM }] } : sec)));
  const removeItem = (sid, iid) => update((list) => list.map((sec) => (sec.id === sid ? { ...sec, items: sec.items.filter((it) => it.id !== iid) } : sec)));

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <div key={sec.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <Input value={sec.title} onChange={(e) => patchSection(sec.id, { title: e.target.value })} placeholder="Section title, e.g. Talks, Research, Leadership" className="!font-semibold" />
            <Popconfirm title="Delete this whole section?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => update((list) => list.filter((x) => x.id !== sec.id))}>
              <Button type="text" danger icon={<Trash2 size={15} />} aria-label="Delete section" />
            </Popconfirm>
          </div>
          <div className="mt-3 space-y-3">
            {sec.items.map((it) => (
              <div key={it.id} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5">
                <Input value={it.title} onChange={(e) => patchItem(sec.id, it.id, { title: e.target.value })} placeholder="Title" className="col-span-2 sm:col-span-1" />
                <Input value={it.subtitle} onChange={(e) => patchItem(sec.id, it.id, { subtitle: e.target.value })} placeholder="Subtitle / organisation" className="col-span-2 sm:col-span-1" />
                <Input value={it.date} onChange={(e) => patchItem(sec.id, it.id, { date: e.target.value })} placeholder="Date" className="col-span-2 sm:col-span-1" />
                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <Button type="text" size="small" danger icon={<Trash2 size={14} />} onClick={() => removeItem(sec.id, it.id)}>
                    Remove
                  </Button>
                </div>
                <TextArea value={it.description} onChange={(e) => patchItem(sec.id, it.id, { description: e.target.value })} placeholder="Details — one point per line" autoSize={{ minRows: 2, maxRows: 10 }} className="col-span-2" />
              </div>
            ))}
            <Button block type="dashed" size="small" icon={<Plus size={14} />} onClick={() => addItem(sec.id)}>
              Add item
            </Button>
          </div>
        </div>
      ))}
      <Button block type="dashed" icon={<Plus size={15} />} className="!h-10" onClick={() => update((list) => [...list, { id: newId(), title: "", items: [{ id: newId(), ...EMPTY_CUSTOM_ITEM }] }])}>
        Add a custom section
      </Button>
    </div>
  );
}

// Sections that only appear once they have content (or the user adds them).
const OPTIONAL = [
  { id: "volunteering", title: "Volunteering", icon: HeartHandshake, hint: "Causes and community work" },
  { id: "awards", title: "Awards", icon: Trophy, hint: "Honours and prizes" },
  { id: "publications", title: "Publications", icon: BookOpen, hint: "Papers, articles, books" },
  { id: "courses", title: "Courses", icon: Library, hint: "Online and short courses" },
  { id: "references", title: "References", icon: Contact, hint: "People who can vouch for you" },
  { id: "interests", title: "Interests", icon: Smile, hint: "Hobbies that say something about you" },
  { id: "custom", title: "Custom section", icon: LayoutList, hint: "Anything else: talks, research…" },
];
// V2: the details some Bangladeshi employers ask for. Offered in the builder only (never the profile).
const BIODATA = { id: "biodata", title: "Biodata details", icon: IdCard, hint: "Parents' names, addresses… if the employer asks" };
const BIODATA_INPUTS = [
  ["fatherName", "Father's name"], ["motherName", "Mother's name"], ["dateOfBirth", "Date of birth", "12 March 2000"], ["gender", "Gender"],
  ["maritalStatus", "Marital status"], ["religion", "Religion"], ["nationality", "Nationality", "Bangladeshi"],
  ["presentAddress", "Present address", "", true], ["permanentAddress", "Permanent address", "", true],
];

function BiodataForm({ biodata = {}, personal, setResume }) {
  const set = (patch) => setResume((r) => ({ ...r, biodata: { enabled: true, ...r.biodata, ...patch } }));
  return (
    <div>
      <label className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
        <span className="text-sm text-slate-700">Show on this resume</span>
        <Switch size="small" checked={!!biodata.enabled} onChange={(v) => set({ enabled: v })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {BIODATA_INPUTS.map(([key, label, placeholder, wide]) => (
          <Field key={key} label={label} className={wide ? "col-span-2" : "col-span-2 sm:col-span-1"}>
            <Input value={biodata[key] ?? ""} placeholder={placeholder || (key === "dateOfBirth" ? personal.dateOfBirth : key === "nationality" ? personal.nationality : "")} onChange={(e) => set({ [key]: e.target.value })} />
          </Field>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-slate-400">Kept in this resume only: not in your profile, not on share links and never sent to the AI. We never ask for your NID.</p>
    </div>
  );
}

export default function ContentPanel({ editor, onRefineSummary, onRefineItem, refiningId, onHelp, biodata = false }) {
  const { resume, setPersonal, setField, setResume } = editor;
  const [open, setOpen] = useState("personal");
  const [added, setAdded] = useState([]);
  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));
  const count = (n, word) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "Empty");

  const hasContent = (id) => {
    if (id === "interests") return splitList(resume.interests).length > 0;
    if (id === "references") return resume.references.length > 0 || resume.referencesOnRequest;
    if (id === "custom") return resume.customSections.length > 0;
    if (id === "biodata") return !!resume.biodata?.enabled;
    return resume[id].length > 0;
  };
  const options = biodata ? [...OPTIONAL, BIODATA] : OPTIONAL;
  const shown = options.filter((o) => hasContent(o.id) || added.includes(o.id));
  const available = options.filter((o) => !shown.includes(o));

  const addSection = (id) => {
    setAdded((a) => [...a, id]);
    setOpen(id);
    if (LISTS[id] && !resume[id].length) editor.addItem(id);
    if (id === "biodata") setResume((r) => ({ ...r, biodata: { ...r.biodata, enabled: true } }));
    if (id === "custom" && !resume.customSections.length) {
      setResume((r) => ({ ...r, customSections: [{ id: newId(), title: "", items: [{ id: newId(), ...EMPTY_CUSTOM_ITEM }] }] }));
    }
  };

  const optionalBody = (id) => {
    if (id === "interests") {
      return <TagsField value={resume.interests} onChange={(v) => setField("interests", v)} placeholder="e.g. Chess, Hiking, Photography" suggestions={["Reading", "Travel", "Photography", "Chess", "Football", "Cooking", "Music"]} />;
    }
    if (id === "custom") return <CustomSectionsForm sections={resume.customSections} setResume={setResume} />;
    if (id === "biodata") return <BiodataForm biodata={resume.biodata} personal={resume.personal} setResume={setResume} />;
    if (id === "references") {
      return (
        <>
          <Checkbox className="!mb-3" checked={resume.referencesOnRequest} onChange={(e) => setField("referencesOnRequest", e.target.checked)}>
            Just show “Available on request”
          </Checkbox>
          {resume.referencesOnRequest && !resume.references.length ? null : (
            <>
              <Checkbox className="!mb-3 !ml-0 flex" checked={resume.referenceSignatures} onChange={(e) => setField("referenceSignatures", e.target.checked)}>
                Add a signature line for each referee
                <span className="block text-xs text-slate-400">Print the resume and have your referees sign and date it as proof.</span>
              </Checkbox>
              <ListForm section="references" items={resume.references} editor={editor} />
            </>
          )}
        </>
      );
    }
    return <ListForm section={id} items={resume[id]} editor={editor} />;
  };
  const optionalMeta = (id) => {
    if (id === "interests") return count(splitList(resume.interests).length, "interest");
    if (id === "custom") return count(resume.customSections.length, "section");
    if (id === "biodata") return resume.biodata?.enabled ? "Shown on this resume" : "Hidden";
    if (id === "references" && resume.referencesOnRequest && !resume.references.length) return "Available on request";
    return count(resume[id].length, "entry").replace("entrys", "entries");
  };

  return (
    <div className="space-y-3" data-tour="sections">
      {onHelp ? (
        <button type="button" onClick={onHelp} data-tour="guide" className="group flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3 text-left transition hover:border-amber-300 hover:shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Lightbulb size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">How to write a good resume</span>
            <span className="block text-xs text-slate-500">Structure, strong bullet points, ATS keywords and common mistakes</span>
          </span>
          <ChevronRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5" />
        </button>
      ) : null}
      <SectionCard icon={User} title="Personal details" meta={resume.personal.name || "Name, contact and photo"} open={open === "personal"} onToggle={() => toggle("personal")}>
        <PersonalForm personal={resume.personal} setPersonal={setPersonal} />
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-slate-600">Other links</p>
          <ListForm section="links" items={resume.links} editor={editor} />
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="About me" meta={resume.summary ? `${resume.summary.trim().split(/\s+/).length} words` : "Empty"} open={open === "summary"} onToggle={() => toggle("summary")}>
        <TextArea value={resume.summary} onChange={(e) => setField("summary", e.target.value)} autoSize={{ minRows: 5, maxRows: 16 }} placeholder="Two to four sentences about who you are, what you're great at and what you want next." />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">Aim for 40–80 words.</span>
          {onRefineSummary ? (
            <AiButton loading={refiningId === "summary"} onClick={onRefineSummary}>
              Improve with AI
            </AiButton>
          ) : null}
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

      <AnimatePresence initial={false}>
        {shown.map((o) => (
          <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SectionCard icon={o.icon} title={o.title === "Custom section" ? "Custom sections" : o.title} meta={optionalMeta(o.id)} open={open === o.id} onToggle={() => toggle(o.id)}>
              {optionalBody(o.id)}
            </SectionCard>
          </motion.div>
        ))}
      </AnimatePresence>

      {available.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="mb-3 text-sm font-semibold text-ink">Add a section</p>
          <div className="grid grid-cols-2 gap-2">
            {available.map((o) => (
              <motion.button
                key={o.id}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => addSection(o.id)}
                className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <o.icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{o.title}</span>
                  <span className="block text-[11px] leading-tight text-slate-400">{o.hint}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
