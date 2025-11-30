import React from "react";
import { useAuth, useRouter } from "./Context/context-definitions";
import {
  Row,
  Col,
  Button,
  Typography,
  Card,
  Space,
  Avatar,
  Carousel,
  Tag,
} from "antd";
import {
  RocketOutlined,
  ThunderboltOutlined,
  FilePdfOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
  RobotOutlined,
  UploadOutlined,
  StarFilled,
  TeamOutlined,
} from "@ant-design/icons";
import ResumeIllustration from "./ResumeIllustration";
import { motion } from "framer-motion";

const { Title, Paragraph, Text } = Typography;

// --- Animations ---
const textHoverVariant = {
  hover: { y: -5, scale: 1.1, transition: { type: "spring", stiffness: 300 } },
};

const buttonHoverVariant = {
  hover: {
    y: -5,
    scale: 1.05,
    boxShadow: "0 10px 20px rgba(0, 123, 123, 0.2)",
    transition: { type: "spring", stiffness: 300 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const HomePage = () => {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { navigate } = useRouter();

  const handleGetStarted = () => {
    if (isAuthenticated) navigate("/builder");
    else setAuthModalOpen("register");
  };

  return (
    <div style={{ backgroundColor: "#fff", overflowX: "hidden" }}>
      {/* ================= 1. HERO SECTION ================= */}
      <div
        style={{
          backgroundColor: "#f0f9f9",
          minHeight: "calc(93vh)",
          padding: "40px 80px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          width: "100%",
          // REMOVED: borderBottomRightRadius: '120px',
          position: "relative",
          zIndex: 1,
        }}
      >
        <Row align="middle" style={{ width: "100%" }}>
          <Col xs={24} lg={11} style={{ paddingRight: "40px" }}>
            <Title
              level={1}
              style={{
                fontSize: "54px",
                fontWeight: 700,
                lineHeight: "1.2",
                marginBottom: "24px",
                color: "#002A3A",
              }}
            >
              Unlock the{" "}
              <motion.span
                style={{
                  color: "#007B7B",
                  display: "inline-block",
                  cursor: "pointer",
                }}
                variants={textHoverVariant}
                whileHover="hover"
              >
                Resume
              </motion.span>{" "}
              That{" "}
              <motion.span
                style={{
                  color: "#007B7B",
                  display: "inline-block",
                  cursor: "pointer",
                }}
                variants={textHoverVariant}
                whileHover="hover"
              >
                lands the job
              </motion.span>
            </Title>
            <Paragraph
              style={{ fontSize: "18px", color: "#555", margin: "20px 0 30px" }}
            >
              With our state-of-the-art AI-driven resume maker, you will finally
              unlock the full potential of your career story.
            </Paragraph>

            <motion.div
              style={{ display: "inline-block" }}
              variants={buttonHoverVariant}
              whileHover="hover"
            >
              <Button
                type="primary"
                size="large"
                style={{ height: "50px", fontSize: "18px", padding: "0 32px" }}
                onClick={handleGetStarted}
              >
                {isAuthenticated ? "Go to Builder" : "Get Started"}
              </Button>
            </motion.div>
          </Col>

          {/* Right Column: Illustration */}
          <Col xs={24} lg={13}>
            <ResumeIllustration />
          </Col>
        </Row>
      </div>

{/* ================= 2. TRUSTED TECH STACK ================= */}
      <div style={{ background: '#002A3A', padding: '60px 24px' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
              <Text style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>
                  Powering the Next Generation of Resumes
              </Text>
              
              <Row justify="center" align="middle" gutter={[64, 32]} style={{ marginTop: '32px' }}>
                  {/* Gemini */}
                  <Col>
                      <Space size="small" align="center" style={{ cursor: 'default' }}>
                          <RobotOutlined style={{ fontSize: '28px', color: '#4fd1c5' }} />
                          <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>Gemini 1.5</span>
                      </Space>
                  </Col>
                  
                  {/* React */}
                  <Col>
                      <Space size="small" align="center" style={{ cursor: 'default' }}>
                          <RocketOutlined style={{ fontSize: '28px', color: '#63b3ed' }} />
                          <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>React</span>
                      </Space>
                  </Col>

                  {/* MongoDB */}
                  <Col>
                      <Space size="small" align="center" style={{ cursor: 'default' }}>
                          <ThunderboltOutlined style={{ fontSize: '28px', color: '#68d391' }} />
                          <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>MongoDB</span>
                      </Space>
                  </Col>
                  
                  {/* Security */}
                  <Col>
                      <Space size="small" align="center" style={{ cursor: 'default' }}>
                          <SafetyCertificateOutlined style={{ fontSize: '28px', color: '#f6e05e' }} />
                          <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>Secure</span>
                      </Space>
                  </Col>
              </Row>
          </div>
      </div>
      {/* ================= 3. HOW IT WORKS ================= */}
      <div
        style={{ padding: "100px 24px", maxWidth: "1200px", margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: "70px" }}>
          <Tag color="blue">Simple Process</Tag>
          <Title level={2} style={{ color: "#002A3A", marginTop: "12px" }}>
            Three Steps to Your Dream Job
          </Title>
          <Text type="secondary" style={{ fontSize: "16px" }}>
            Professional results in minutes, not hours.
          </Text>
        </div>

        <Row gutter={[48, 32]}>
          {[
            {
              icon: <UploadOutlined />,
              title: "1. Import or Start",
              text: "Upload an old PDF to auto-fill your data instantly, or start fresh.",
            },
            {
              icon: <ThunderboltOutlined />,
              title: "2. Refine with AI",
              text: "Our AI consultant rewrites boring text into impactful achievements.",
            },
            {
              icon: <FilePdfOutlined />,
              title: "3. Export PDF",
              text: "Choose a design and download a pixel-perfect, ATS-friendly resume.",
            },
          ].map((step, index) => (
            <Col xs={24} md={8} key={index}>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
              >
                <Card
                  bordered={false}
                  style={{
                    textAlign: "center",
                    height: "100%",
                    borderRadius: "16px",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      background: "#f0f9f9",
                      color: "#007B7B",
                      borderRadius: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      margin: "0 auto 24px",
                      boxShadow: "0 10px 20px rgba(0, 123, 123, 0.1)",
                    }}
                  >
                    {step.icon}
                  </div>
                  <Title level={4} style={{ marginBottom: "16px" }}>
                    {step.title}
                  </Title>
                  <Paragraph style={{ color: "#666", fontSize: "15px" }}>
                    {step.text}
                  </Paragraph>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </div>

      {/* ================= 4. FEATURES SECTION ================= */}
      <div style={{ backgroundColor: "#f8fafc", padding: "100px 24px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Row gutter={[64, 48]} align="middle">
            <Col xs={24} md={12}>
              <Title
                level={2}
                style={{ color: "#002A3A", marginBottom: "24px" }}
              >
                Why is ResumeX different?
              </Title>
              <Paragraph
                style={{
                  fontSize: "16px",
                  color: "#555",
                  marginBottom: "32px",
                }}
              >
                Most resume builders are just dumb text editors. ResumeX
                understands your career context. By analyzing your job title and
                skills, our AI suggests improvements that actually make sense.
              </Paragraph>

              <Space direction="vertical" size="large">
                {[
                  "Context-Aware AI Suggestions",
                  "Real-time Content Scoring",
                  "Dark Mode & Creative Templates",
                  "Privacy-First (No Data Selling)",
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <CheckCircleFilled
                      style={{ color: "#007B7B", fontSize: "20px" }}
                    />
                    <Text strong style={{ fontSize: "16px", color: "#333" }}>
                      {item}
                    </Text>
                  </div>
                ))}
              </Space>
            </Col>
            <Col xs={24} md={12}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                  background: "#fff",
                  padding: "40px",
                  borderRadius: "24px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -20,
                    background: "#007B7B",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                  }}
                >
                  <ThunderboltOutlined /> AI Powered
                </div>
                <div
                  style={{
                    borderBottom: "1px solid #eee",
                    paddingBottom: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "40%",
                      height: "24px",
                      background: "#f0f0f0",
                      borderRadius: "4px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <div
                    style={{
                      width: "25%",
                      height: "16px",
                      background: "#f5f5f5",
                      borderRadius: "4px",
                    }}
                  ></div>
                </div>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "12px",
                      background: "#f5f5f5",
                      borderRadius: "4px",
                    }}
                  ></div>
                  <div
                    style={{
                      width: "90%",
                      height: "12px",
                      background: "#f5f5f5",
                      borderRadius: "4px",
                    }}
                  ></div>
                  <div
                    style={{
                      width: "95%",
                      height: "12px",
                      background: "#e6fffa",
                      borderRadius: "4px",
                      border: "1px solid #b5f5ec",
                    }}
                  ></div>{" "}
                  {/* Highlighted line */}
                  <div
                    style={{
                      width: "80%",
                      height: "12px",
                      background: "#f5f5f5",
                      borderRadius: "4px",
                    }}
                  ></div>
                </Space>
                <div style={{ marginTop: "32px", textAlign: "center" }}>
                  <Button
                    type="primary"
                    shape="round"
                    icon={<ThunderboltOutlined />}
                  >
                    Refine Selection
                  </Button>
                </div>
              </motion.div>
            </Col>
          </Row>
        </div>
      </div>
      {/* ================= 5. TESTIMONIALS ================= */}
      <div
        style={{ padding: "100px 24px", maxWidth: "1000px", margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <Title level={2} style={{ color: "#002A3A" }}>
            Loved by Students
          </Title>
        </div>
        <Row gutter={[24, 24]}>
          {[
            {
              name: "Wasif Haider",
              role: "CS Student",
              text: "The AI refinement is magic. It turned my basic bullet points into professional achievements instantly.",
            },
            {
              name: "Oni Hasan",
              role: "Intern Applicant",
              text: "I used the Modern template and got compliments on the design during my first interview!",
            },
            {
              name: "Samin Yeaser",
              role: "Business Major",
              text: "Finally, a resume builder that doesn't charge me to download the PDF. Lifesaver.",
            },
          ].map((review, i) => (
            <Col xs={24} md={8} key={i}>
              <Card
                bordered={false}
                style={{
                  background: "#fff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                  borderRadius: "12px",
                  height: "100%",
                }}
              >
                <Space style={{ marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <StarFilled key={s} style={{ color: "#ffec3d" }} />
                  ))}
                </Space>
                <Paragraph
                  style={{
                    fontStyle: "italic",
                    color: "#555",
                    minHeight: "80px",
                  }}
                >
                  "{review.text}"
                </Paragraph>
                <Space align="center">
                  <Avatar
                    icon={<TeamOutlined />}
                    style={{ backgroundColor: "#007B7B" }}
                  />
                  <div>
                    <Text strong style={{ display: "block" }}>
                      {review.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                      {review.role}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* ================= 6. FINAL CTA ================= */}
      <div
        style={{
          padding: "100px 24px",
          textAlign: "center",
          background: "linear-gradient(to bottom, #fff, #f0f9f9)",
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          variants={fadeInUp}
          style={{ maxWidth: "800px", margin: "0 auto" }}
        >
          <Title
            level={2}
            style={{ color: "#002A3A", marginBottom: "24px", fontSize: "36px" }}
          >
            Ready to build your masterpiece?
          </Title>
          <Paragraph
            style={{ fontSize: "18px", color: "#666", marginBottom: "40px" }}
          >
            Join thousands of students using ResumeX to stand out from the
            crowd.
          </Paragraph>
          <Button
            type="primary"
            size="large"
            style={{
              height: "60px",
              padding: "0 60px",
              fontSize: "20px",
              borderRadius: "30px",
              boxShadow: "0 10px 30px rgba(0, 123, 123, 0.4)",
            }}
            onClick={handleGetStarted}
          >
            Create My Resume Now
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default HomePage;
