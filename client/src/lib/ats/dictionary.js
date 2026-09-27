/**
 * Vocabulary for the ATS checker. SKILLS maps a canonical skill name to the
 * other ways people write it; matching is case-insensitive on whole words.
 */
export const SKILLS = {
  // Programming languages
  JavaScript: ["javascript", "js", "ecmascript", "es6"],
  TypeScript: ["typescript", "ts"],
  Python: ["python", "python3"],
  Java: ["java"],
  "C++": ["c++", "cpp"],
  "C#": ["c#", "csharp", "c sharp"],
  C: ["c programming", "ansi c"],
  Go: ["golang", "go lang", "=Go"],
  Rust: ["=Rust"],
  Ruby: ["ruby"],
  PHP: ["php"],
  Kotlin: ["kotlin"],
  Swift: ["=Swift"],
  "Objective-C": ["objective-c", "objective c"],
  Scala: ["scala"],
  R: ["r programming", "r language", "rstudio"],
  MATLAB: ["matlab"],
  Dart: ["=Dart"],
  Perl: ["perl"],
  Bash: ["bash", "shell scripting", "shell script"],
  PowerShell: ["powershell"],
  SQL: ["sql"],
  "HTML": ["html", "html5"],
  CSS: ["css", "css3"],
  Sass: ["sass", "scss"],
  GraphQL: ["graphql"],
  Solidity: ["solidity"],
  // Front end
  React: ["react", "reactjs", "react.js"],
  "React Native": ["react native"],
  "Next.js": ["next.js", "nextjs", "next js"],
  Angular: ["angular", "angularjs"],
  "Vue.js": ["vue", "vue.js", "vuejs"],
  Svelte: ["svelte", "sveltekit"],
  Redux: ["redux", "redux toolkit"],
  "Tailwind CSS": ["tailwind", "tailwind css", "tailwindcss"],
  Bootstrap: ["bootstrap"],
  jQuery: ["jquery"],
  Webpack: ["webpack"],
  Vite: ["vite"],
  "Responsive design": ["responsive design", "responsive web design", "mobile-first"],
  Accessibility: ["accessibility", "a11y", "wcag"],
  // Back end
  "Node.js": ["node.js", "nodejs", "node"],
  Express: ["express.js", "expressjs", "=Express"],
  NestJS: ["nestjs", "nest.js"],
  Fastify: ["fastify"],
  Django: ["django"],
  Flask: ["=Flask"],
  FastAPI: ["fastapi"],
  Spring: ["spring boot", "springboot", "=Spring"],
  ".NET": [".net", "dotnet", "asp.net", ".net core"],
  Laravel: ["laravel"],
  "Ruby on Rails": ["rails", "ruby on rails", "ror"],
  "REST APIs": ["rest", "restful", "rest api", "rest apis", "restful api"],
  gRPC: ["grpc"],
  Microservices: ["microservices", "microservice", "micro-services"],
  WebSockets: ["websocket", "websockets", "socket.io"],
  // Data stores
  PostgreSQL: ["postgresql", "postgres", "psql"],
  MySQL: ["mysql"],
  MongoDB: ["mongodb", "mongo", "mongoose"],
  Redis: ["redis"],
  SQLite: ["sqlite"],
  "SQL Server": ["sql server", "mssql", "t-sql"],
  Oracle: ["oracle", "oracle db", "pl/sql"],
  DynamoDB: ["dynamodb"],
  Cassandra: ["cassandra"],
  Elasticsearch: ["elasticsearch", "elastic search", "opensearch"],
  Firebase: ["firebase", "firestore"],
  Supabase: ["supabase"],
  Snowflake: ["snowflake"],
  BigQuery: ["bigquery", "big query"],
  // Cloud & DevOps
  AWS: ["aws", "amazon web services", "ec2", "s3", "lambda"],
  Azure: ["azure", "microsoft azure"],
  "Google Cloud": ["gcp", "google cloud", "google cloud platform"],
  Docker: ["docker", "containerization", "containers"],
  Kubernetes: ["kubernetes", "k8s", "eks", "aks", "gke"],
  Terraform: ["terraform"],
  Ansible: ["ansible"],
  "CI/CD": ["ci/cd", "cicd", "continuous integration", "continuous delivery", "continuous deployment"],
  Jenkins: ["jenkins"],
  "GitHub Actions": ["github actions"],
  GitLab: ["gitlab", "gitlab ci"],
  Git: ["git", "version control"],
  Linux: ["linux", "unix", "ubuntu"],
  Nginx: ["nginx"],
  Serverless: ["serverless"],
  Monitoring: ["monitoring", "observability", "prometheus", "grafana", "datadog"],
  // Testing & quality
  Jest: ["jest"],
  Cypress: ["cypress"],
  Playwright: ["playwright"],
  Selenium: ["selenium"],
  "Unit testing": ["unit testing", "unit tests", "tdd", "test-driven"],
  "Automated testing": ["automated testing", "test automation", "qa automation"],
  // Data & AI
  "Machine learning": ["machine learning", "ml"],
  "Deep learning": ["deep learning", "neural networks"],
  "Artificial intelligence": ["artificial intelligence", "ai"],
  "Natural language processing": ["natural language processing", "nlp"],
  "Computer vision": ["computer vision", "opencv"],
  "Large language models": ["llm", "llms", "large language models", "generative ai", "genai"],
  TensorFlow: ["tensorflow", "keras"],
  PyTorch: ["pytorch", "torch"],
  "scikit-learn": ["scikit-learn", "sklearn"],
  Pandas: ["pandas"],
  NumPy: ["numpy"],
  Spark: ["spark", "apache spark", "pyspark"],
  Hadoop: ["hadoop"],
  Airflow: ["airflow"],
  ETL: ["etl", "elt", "data pipelines", "data pipeline"],
  "Data analysis": ["data analysis", "data analytics", "analytics"],
  "Data visualization": ["data visualization", "data visualisation", "dashboards"],
  Statistics: ["statistics", "statistical analysis", "a/b testing", "hypothesis testing"],
  Tableau: ["tableau"],
  "Power BI": ["power bi", "powerbi"],
  Excel: ["excel", "microsoft excel", "spreadsheets", "vlookup", "pivot tables"],
  "Google Analytics": ["google analytics", "ga4"],
  Looker: ["looker"],
  // Mobile
  Android: ["android"],
  iOS: ["ios"],
  Flutter: ["flutter"],
  SwiftUI: ["swiftui"],
  Expo: ["=Expo"],
  // Security
  Cybersecurity: ["cybersecurity", "cyber security", "information security", "infosec"],
  "Penetration testing": ["penetration testing", "pentesting", "pen testing"],
  OAuth: ["oauth", "oauth2", "openid connect", "sso"],
  JWT: ["jwt", "json web token"],
  // Design & product
  Figma: ["figma"],
  "Adobe Photoshop": ["photoshop"],
  "Adobe Illustrator": ["illustrator"],
  "Adobe XD": ["adobe xd"],
  "UI design": ["ui design", "user interface design", "visual design"],
  "UX design": ["ux", "ux design", "user experience", "user research", "usability testing"],
  Wireframing: ["wireframing", "wireframes", "prototyping", "prototypes"],
  "Product management": ["product management", "product manager", "roadmap", "roadmaps"],
  // Ways of working
  Agile: ["agile", "agile methodologies"],
  Scrum: ["scrum", "sprint planning"],
  Kanban: ["kanban"],
  Jira: ["jira"],
  Confluence: ["confluence"],
  "Project management": ["project management", "pmp", "prince2"],
  "Stakeholder management": ["stakeholder management", "stakeholders"],
  "System design": ["system design", "software architecture", "systems architecture", "distributed systems"],
  "Object-oriented programming": ["object-oriented", "oop", "object oriented programming"],
  "Data structures": ["data structures", "algorithms"],
  // Business, marketing, sales
  SEO: ["seo", "search engine optimization", "search engine optimisation"],
  SEM: ["sem", "google ads", "ppc", "paid search"],
  "Content marketing": ["content marketing", "content strategy", "copywriting"],
  "Social media marketing": ["social media marketing", "social media", "smm"],
  "Email marketing": ["email marketing", "mailchimp", "hubspot"],
  "Digital marketing": ["digital marketing", "performance marketing", "growth marketing"],
  "Market research": ["market research", "competitive analysis"],
  Salesforce: ["salesforce", "sfdc"],
  CRM: ["crm", "customer relationship management"],
  "Business development": ["business development", "lead generation", "prospecting"],
  Sales: ["sales", "b2b sales", "b2c sales", "account management", "quota"],
  Negotiation: ["negotiation", "negotiating"],
  "Customer service": ["customer service", "customer support", "client relations"],
  "Business analysis": ["business analysis", "business analyst", "requirements gathering"],
  "Financial analysis": ["financial analysis", "financial modeling", "financial modelling", "valuation"],
  Accounting: ["accounting", "bookkeeping", "gaap", "ifrs", "reconciliation", "accounts payable", "accounts receivable"],
  Budgeting: ["budgeting", "forecasting", "financial planning"],
  Auditing: ["auditing", "audit", "internal audit"],
  QuickBooks: ["quickbooks"],
  SAP: ["sap", "sap erp"],
  ERP: ["erp"],
  "Supply chain": ["supply chain", "logistics", "procurement", "inventory management"],
  Operations: ["operations management", "process improvement", "=Lean", "six sigma"],
  // People
  Recruiting: ["recruiting", "recruitment", "talent acquisition", "sourcing"],
  "Human resources": ["human resources", "hr", "hris", "onboarding", "payroll"],
  Training: ["training", "mentoring", "coaching"],
  // Healthcare & science
  "Patient care": ["patient care", "clinical care"],
  EHR: ["ehr", "emr", "electronic health records", "epic"],
  HIPAA: ["hipaa"],
  "Laboratory skills": ["laboratory", "lab techniques", "pcr"],
  // Engineering (non-software)
  AutoCAD: ["autocad"],
  SolidWorks: ["solidworks"],
  "CAD": ["cad", "computer-aided design"],
  PLC: ["plc", "scada"],
  // Office
  "Microsoft Office": ["microsoft office", "ms office", "office 365", "microsoft 365"],
  PowerPoint: ["powerpoint", "presentations"],
  "Google Workspace": ["google workspace", "g suite", "google sheets", "google docs"],
};

/** Soft skills are matched too but weigh less than hard skills. */
export const SOFT_SKILLS = {
  Communication: ["communication", "communicate", "communicating", "communication skills"],
  Leadership: ["leadership", "team lead", "led a team", "led teams"],
  Teamwork: ["teamwork", "collaboration", "collaborate", "collaborative", "cross-functional"],
  "Problem solving": ["problem solving", "problem-solving", "troubleshooting"],
  "Time management": ["time management", "prioritization", "prioritisation", "deadlines"],
  "Attention to detail": ["attention to detail", "detail-oriented", "detail oriented"],
  Adaptability: ["adaptability", "adaptable", "fast-paced"],
  Mentoring: ["mentoring", "mentored", "mentor"],
  "Critical thinking": ["critical thinking", "analytical", "analytical skills"],
};

/** Strong verbs recruiters expect at the start of a bullet. */
export const ACTION_VERBS = new Set(
  `accelerated accomplished achieved acquired adapted addressed administered advanced advised advocated analysed analyzed
  answered anticipated applied appointed appraised approved architected arranged assembled assessed assigned attained audited authored
  automated balanced boosted briefed budgeted built calculated campaigned captured catalogued centralized chaired championed changed
  clarified classified closed coached coded collaborated collected combined commissioned communicated compiled completed composed computed
  conceived conceptualized conducted configured consolidated constructed consulted contracted contributed controlled converted
  coordinated corrected counseled created critiqued cultivated customized cut debugged decreased defined delegated delivered demonstrated
  deployed designed detected determined developed devised diagnosed directed discovered dispatched distributed documented doubled drafted
  drove earned edited educated eliminated enabled encouraged engineered enhanced enlarged ensured established estimated evaluated examined
  exceeded executed expanded expedited experimented explained explored facilitated finalized fixed forecasted formed formulated fostered
  founded gained gathered generated grew guided halved handled headed helped identified illustrated implemented improved improvised
  increased influenced informed initiated innovated inspected inspired installed instituted instructed integrated interpreted interviewed
  introduced invented investigated launched lectured led leveraged lifted maintained managed mapped marketed maximized measured mediated
  mentored merged migrated minimized mobilized modeled modelled moderated modernized monitored motivated navigated negotiated onboarded
  opened operated optimized orchestrated organized originated outperformed overhauled oversaw partnered performed persuaded piloted pioneered
  planned predicted prepared presented prioritized processed produced programmed projected promoted proposed prototyped proved provided
  published purchased qualified quantified raised ranked rebuilt received recommended reconciled recorded recruited redesigned reduced
  refactored refined regulated rehabilitated reorganized repaired replaced reported represented researched resolved restored restructured
  retained revamped reviewed revised revitalized saved scaled scheduled screened secured selected served shaped shipped simplified
  sold solved spearheaded specified sped standardized steered streamlined strengthened structured succeeded supervised supported surpassed
  surveyed synthesized systematized tackled targeted taught tested tracked trained transformed translated tripled troubleshot tutored
  uncovered unified upgraded validated verified visualized won wrote`.split(/\s+/)
);

/** Phrases that describe duties instead of results. */
export const WEAK_PHRASES = [
  "responsible for", "duties included", "duties include", "tasked with", "worked on", "helped with", "helped to", "assisted with",
  "assisted in", "involved in", "participated in", "in charge of", "was part of", "handled various", "various tasks",
];

/** Overused filler that recruiters (and some ranking models) discount. */
export const CLICHES = [
  "team player", "hard-working", "hardworking", "hard working", "go-getter", "self-starter", "self starter", "detail-oriented",
  "results-driven", "results driven", "think outside the box", "synergy", "go the extra mile", "dynamic", "passionate", "motivated",
  "fast learner", "quick learner", "proven track record", "strategic thinker", "best of breed", "rockstar", "ninja", "guru",
  "wear many hats", "people person", "excellent communication skills", "works well under pressure", "detail oriented",
];

export const PRONOUNS = /\b(i|me|my|mine|we|our|us)\b/i;

/** Section headings that ATS parsers recognise for each part of a resume. */
export const STANDARD_HEADINGS = {
  experience: ["experience", "work experience", "professional experience", "employment history", "work history", "employment"],
  education: ["education", "academic background", "education and training"],
  skills: ["skills", "technical skills", "core skills", "key skills", "skills and abilities", "core competencies"],
  summary: ["summary", "professional summary", "profile", "about me", "career summary", "objective", "professional profile"],
  projects: ["projects", "personal projects", "key projects"],
  certifications: ["certifications", "certificates", "licenses", "licenses and certifications"],
};

export const DEGREE_LEVELS = [
  { level: 4, words: ["phd", "ph.d", "doctorate", "doctoral"] },
  { level: 3, words: ["master", "masters", "master's", "msc", "m.sc", "ms", "m.s", "mba", "ma", "m.a", "meng", "m.eng"] },
  { level: 2, words: ["bachelor", "bachelors", "bachelor's", "bsc", "b.sc", "bs", "b.s", "ba", "b.a", "beng", "b.eng", "btech", "b.tech", "bba", "undergraduate", "degree"] },
  { level: 1, words: ["associate", "associate's", "diploma", "hsc", "a levels", "a-levels"] },
];

export const STOPWORDS = new Set(
  `a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its
  we you your our they their them he she his her i me my us will would should could can may might must shall do does did done has
  have had having not no yes all any each every some such more most other into over under about above below up down out off than
  too very just also only own same so both few many much new well via per etc eg ie using use used work working job role team
  company years year experience ability strong excellent good great knowledge understanding skills skill including include includes
  across within while where when who whom which what why how including plus preferred required requirements responsibilities
  qualifications candidate ideal looking join help build ensure make across based`.split(/\s+/)
);
