export default function manifest() {
  return {
    name: "ResumeX – Free Resume Builder",
    short_name: "ResumeX",
    description: "Build a professional resume with a live PDF preview.",
    start_url: "/builder",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#007B7B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
