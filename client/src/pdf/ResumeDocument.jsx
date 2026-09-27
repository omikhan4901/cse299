import { Document } from "@react-pdf/renderer";
import { templateById } from "./registry";
import Classic from "./templates/Classic";
import Modern from "./templates/Modern";
import Creative from "./templates/Creative";
import CoolBlue from "./templates/CoolBlue";
import BasicStylish from "./templates/BasicStylish";
import MinimalistBeige from "./templates/MinimalistBeige";
import ModernGothic from "./templates/ModernGothic";
import Compact from "./templates/Compact";

const COMPONENTS = {
  Classic: (props) => <Classic {...props} />,
  ClassicDark: (props) => <Classic {...props} dark />,
  Modern: (props) => <Modern {...props} />,
  ModernDark: (props) => <Modern {...props} dark />,
  Creative: (props) => <Creative {...props} />,
  CoolBlue: (props) => <CoolBlue {...props} />,
  BasicStylish: (props) => <BasicStylish {...props} />,
  // Serif headings over a sans body unless the user picked one font for everything.
  MinimalistBeige: (props) => <MinimalistBeige {...props} bodyFont={props.customFont ? props.font : "Lato"} />,
  ModernGothic: (props) => <ModernGothic {...props} />,
  Compact: (props) => <Compact {...props} />,
};

/** The full PDF document for a (normalized) resume. */
export default function ResumeDocument({ resume }) {
  const tpl = templateById(resume.template);
  const render = COMPONENTS[tpl.id] || COMPONENTS.Classic;
  const accent = resume.theme?.accent || tpl.accent;
  const font = resume.theme?.font || tpl.font;
  const size = resume.theme?.pageSize === "LETTER" ? "LETTER" : "A4";
  const name = resume.personal?.name || "Resume";
  return (
    <Document title={`${name} – Resume`} author={name} subject="Resume" creator="ResumeX" producer="ResumeX">
      {render({ data: resume, accent, font, size, customFont: !!resume.theme?.font })}
    </Document>
  );
}
