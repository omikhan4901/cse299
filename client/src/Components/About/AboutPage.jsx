import React from "react";
import {
  Layout,
  Row,
  Col,
  Card,
  Typography,
  Button,
  Collapse,
  Tag,
  Avatar,
  Space,
  Timeline,
} from "antd";
import {
  ThunderboltOutlined,
  UploadOutlined,
  MessageOutlined,
  UserOutlined,
  TeamOutlined,
  GithubOutlined,
  LinkedinFilled,
  ExperimentOutlined,
  RocketOutlined,
  FlagOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useAuth, useRouter } from "../../Context/context-definitions";
 
const { Title, Paragraph, Text } = Typography;

// --- Animation Variants ---
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const AboutPage = () => {
  const { navigate } = useRouter();
  const { setAuthModalOpen } = useAuth();

  const techStack = [
    "React.js",
    "Node.js",
    "Express",
    "MongoDB",
    "Ant Design",
    "Generative AI",
    "Tailwind CSS",
  ];

  const faqItems = [
    {
      key: "1",
      label: "How does the AI Resume Parser work?",
      children:
        "We use an advanced Large Language Model (LLM) to analyze the raw text of your PDF/DOCX. It identifies patterns like dates, job titles, and skills, mapping them into a structured JSON format that our builder can edit.",
    },
    {
      key: "2",
      label: "Is my data private?",
      children:
        "Yes. Your data is stored in a secure MongoDB database protected by JWT authentication. We do not sell your data. The AI processing happens on-demand and your resume context is only used to generate your specific suggestions.",
    },
    {
      key: "3",
      label: "Can I create multiple resumes?",
      children:
        'Absolutely. You can create a "Master Profile" with all your data, and then create tailored versions (e.g., "Frontend Resume", "Manager Resume") based on that master data.',
    },
  ];

  return (
    <Layout style={{ background: "#fff" }}>
      {/* --- 1. HERO SECTION --- */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        style={{
          backgroundColor: "#f0f9f9",
          padding: "100px 24px",
          textAlign: "center",
          borderBottom: "1px solid #e6f7ff",
        }}
      >
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <Tag
            color="cyan"
            style={{ marginBottom: 16, padding: "4px 12px", fontSize: "14px" }}
          >
            CSE299 Final Project
          </Tag>
          <Title
            level={1}
            style={{
              color: "#002A3A",
              fontSize: "48px",
              fontWeight: 800,
              marginBottom: 24,
            }}
          >
            Smarter Resumes,{" "}
            <span style={{ color: "#007B7B" }}>Powered by AI</span>
          </Title>
          <Paragraph
            style={{
              color: "#555",
              fontSize: "20px",
              maxWidth: "700px",
              margin: "0 auto 40px",
              lineHeight: "1.6",
            }}
          >
            ResumeX isn't just a template filler. It's an intelligent career
            assistant that parses, refines, and formats your professional story
            instantly.
          </Paragraph>
          <Button
            type="primary"
            size="large"
            style={{
              height: "56px",
              padding: "0 40px",
              fontSize: "18px",
              fontWeight: "bold",
              boxShadow: "0 4px 14px rgba(0, 123, 123, 0.3)",
            }}
            onClick={() => setAuthModalOpen("register")}
          >
            Build My Resume
          </Button>
        </div>
      </motion.div>

      {/* --- 2. TECH STACK BANNER --- */}
      <div
        style={{
          background: "#fff",
          padding: "24px",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}
        >
          <Text
            type="secondary"
            style={{
              display: "block",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontSize: "12px",
            }}
          >
            Engineered With Modern Technologies
          </Text>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {techStack.map((tech) => (
              <Tag
                key={tech}
                style={{
                  padding: "6px 16px",
                  fontSize: "14px",
                  borderRadius: "20px",
                  border: "1px solid #d9d9d9",
                  color: "#666",
                }}
              >
                {tech}
              </Tag>
            ))}
          </div>
        </div>
      </div>

      {/* --- 3. FEATURES GRID --- */}
      <div style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <Title level={2} style={{ color: "#002A3A" }}>
              Why ResumeX?
            </Title>
            <Text type="secondary" style={{ fontSize: "16px" }}>
              Three distinct AI layers working together to land you the job.
            </Text>
          </div>

          <Row gutter={[32, 32]}>
            {[
              {
                icon: <UploadOutlined />,
                title: "Context-Aware Parser",
                text: "Don't start from scratch. Our AI reads your PDF, understands the structure, and auto-fills the builder for you.",
              },
              {
                icon: <ThunderboltOutlined />,
                title: "Smart Refinement",
                text: "Turn 'I did sales' into 'Generated 20% revenue growth'. The AI suggests impactful verbs based on your specific job title.",
              },
              {
                icon: <MessageOutlined />,
                title: "Career Consultant Chat",
                text: "Ask the AI questions like 'Is my resume good for a Senior Dev role?' It reads your full profile context to give advice.",
              },
            ].map((feature, idx) => (
              <Col xs={24} md={8} key={idx}>
                <motion.div
                  whileHover={{ y: -10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card
                    bordered={false}
                    style={{
                      height: "100%",
                      textAlign: "center",
                      background: "#f9f9f9",
                      borderRadius: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "40px",
                        color: "#007B7B",
                        marginBottom: "24px",
                        background: "#e6fffa",
                        width: "80px",
                        height: "80px",
                        lineHeight: "80px",
                        borderRadius: "50%",
                        margin: "0 auto 24px",
                      }}
                    >
                      {feature.icon}
                    </div>
                    <Title level={4} style={{ color: "#002A3A" }}>
                      {feature.title}
                    </Title>
                    <Paragraph style={{ color: "#666" }}>
                      {feature.text}
                    </Paragraph>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* --- 4. PROJECT ROADMAP (NEW SECTION) --- */}
      <div style={{ padding: "80px 24px", background: "#f0f9f9" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <Title level={2} style={{ color: "#002A3A" }}>
              The Project Journey
            </Title>
            <Text type="secondary" style={{ fontSize: "16px" }}>
              How ResumeX went from a concept to a full-stack AI platform.
            </Text>
          </div>

          <Timeline
            mode="alternate"
            items={[
              {
                color: "blue",
                dot: <ExperimentOutlined style={{ fontSize: "20px" }} />,
                children: (
                  <>
                    <Title level={4} style={{ margin: 0 }}>
                      The Problem
                    </Title>
                    <Paragraph style={{ color: "#666" }}>
                      Resume formatting is tedious. Existing tools are either
                      expensive or lack intelligent feedback. We identified a
                      need for a smart, free alternative for students.
                    </Paragraph>
                  </>
                ),
              },
              {
                color: "green",
                dot: <CodeOutlined style={{ fontSize: "20px" }} />,
                children: (
                  <>
                    <Title level={4} style={{ margin: 0 }}>
                      The Architecture
                    </Title>
                    <Paragraph style={{ color: "#666" }}>
                      We selected the MERN stack for scalability and Ant Design
                      for a professional UI. The core challenge was integrating
                      advanced context-aware LLMs for text generation.
                    </Paragraph>
                  </>
                ),
              },
              {
                color: "purple",
                dot: <ThunderboltOutlined style={{ fontSize: "20px" }} />,
                children: (
                  <>
                    <Title level={4} style={{ margin: 0 }}>
                      Development
                    </Title>
                    <Paragraph style={{ color: "#666" }}>
                      Built a custom PDF rendering engine using CSS print rules,
                      implemented JWT authentication, and developed the "Master
                      Profile" system for data reusability.
                    </Paragraph>
                  </>
                ),
              },
              {
                color: "#007B7B",
                dot: <RocketOutlined style={{ fontSize: "20px" }} />,
                children: (
                  <>
                    <Title level={4} style={{ margin: 0 }}>
                      Launch (v1.0)
                    </Title>
                    <Paragraph style={{ color: "#666" }}>
                      A complete SaaS MVP featuring multi-profile management,
                      dark mode templates, and an AI consultant that understands
                      your specific skills and experience.
                    </Paragraph>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
      {/* --- 5. FAQ --- */}
      <div style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          <Title
            level={2}
            style={{ textAlign: "center", marginBottom: 40, color: "#002A3A" }}
          >
            Common Questions
          </Title>

          <Collapse
            accordion
            size="large"
            items={faqItems.map((item) => ({
              ...item,
              // Style individual panels to be stable cards
              style: {
                marginBottom: 16,
                background: "#fafafa",
                borderRadius: 8,
                border: "1px solid #f0f0f0",
                overflow: "hidden",
              },
            }))}
            // Remove default borders from the main container
            bordered={false}
            style={{ background: "transparent" }}
          />
        </div>
      </div>

      {/* --- 7. FINAL CTA --- */}
      <div
        style={{
          background: "#002A3A",
          padding: "60px 24px",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <Title level={2} style={{ color: "#fff", marginBottom: 16 }}>
          Ready to upgrade your career?
        </Title>
        <Paragraph style={{ color: "rgba(255,255,255,0.6)", marginBottom: 32 }}>
          It's free, it's fast, and it's powered by AI.
        </Paragraph>
        <Button
          type="primary"
          size="large"
          onClick={() => setAuthModalOpen("register")}
          style={{
            height: "50px",
            padding: "0 40px",
            background: "#007B7B",
            border: "none",
          }}
        >
          Get Started for Free
        </Button>
      </div>
    </Layout>
  );
};

export default AboutPage;
