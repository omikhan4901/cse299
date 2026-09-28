import Link from "next/link";
import { BuilderLink } from "./BuilderLauncher";
import { Heart } from "lucide-react";
import { GithubIcon as Github } from "./BrandIcons";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-navy text-white/70 print:hidden">
      <div className="container-x grid gap-10 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo href="/" light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            A free ATS resume builder and CV maker with 50 designer templates, a live PDF preview, a real ATS check and one-click downloads. Built to help students and professionals land their next role.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Product</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><BuilderLink className="hover:text-white">Resume builder</BuilderLink></li>
            <li><Link className="hover:text-white" href="/templates">Resume templates</Link></li>
            <li><Link className="hover:text-white" href="/ats-checker">ATS resume checker</Link></li>
            <li><Link className="hover:text-white" href="/about">About &amp; FAQ</Link></li>
            <li><Link className="hover:text-white" href="/privacy">Privacy policy</Link></li>
            <li><Link className="hover:text-white" href="/terms">Terms of service</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Resources</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-white" href="/resume-guide">How to write a resume</Link></li>
            <li><Link className="hover:text-white" href="/guides/fresh-graduate-resume">Fresh graduate resume</Link></li>
            <li><Link className="hover:text-white" href="/templates/category/ats-friendly">ATS-friendly templates</Link></li>
            <li><Link className="hover:text-white" href="/templates/category/student-entry-level">Student templates</Link></li>
            <li><Link className="hover:text-white" href="/guides">All guides</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Built by</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a className="inline-flex items-center gap-2 hover:text-white" href="https://github.com/omikhan4901" target="_blank" rel="noopener noreferrer">
                <Github size={15} /> Mehboob Ehsan Khan
              </a>
            </li>
            <li>
              <a className="inline-flex items-center gap-2 hover:text-white" href="https://github.com/Nabigah274" target="_blank" rel="noopener noreferrer">
                <Github size={15} /> Nabigah Bin Sayeed
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-x flex items-center justify-center gap-1.5 py-5 text-xs text-white/50">
          © {new Date().getFullYear()} ResumeX · Made with <Heart size={12} className="fill-rose-400 text-rose-400" /> for CSE299
        </p>
      </div>
    </footer>
  );
}
